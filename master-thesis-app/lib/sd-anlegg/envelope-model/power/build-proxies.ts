import type { MpcControlVector, MpcTimestep, PowerProxyParams } from "@/lib/sd-anlegg/mpc/shared/types";
import { COOLING_VALVE_MIN_ACTIVE_PCT } from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";
import {
  clampShareToAttestPrior,
  resolveMpcScopePrior,
} from "@/lib/sd-anlegg/energy-attest";
import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import {
  stepDistrictHeatKw,
  stepDistrictHeatTargetKw,
} from "./district-heat-ground-truth";

/** Methods eq. method_fan_power — kubisk vifte-proxy (kW). */
export function clampControlPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function clampPct(value: number): number {
  return clampControlPct(value);
}

/**
 * Felles flow/TR003-anker for alle policy-spor: målt u_k når tilgjengelig.
 * Counterfactual u skaleres fra samme luftmengde-måling, ikke fra emulert referanse.
 */
export function resolvePowerFlowAnchor(
  uMeas: MpcControlVector | null | undefined,
  fallback: MpcControlVector,
): MpcControlVector {
  return uMeas ?? fallback;
}

type FanFlowContext = Pick<MpcTimestep, "supplyFanFlowM3h" | "exhaustFanFlowM3h">;

function flowNormFromM3h(input: {
  supplyFlowM3h: number;
  exhaustFlowM3h: number;
}): number {
  const qSa = Math.max(0, input.supplyFlowM3h) / 1000;
  const qEa = Math.max(0, input.exhaustFlowM3h) / 1000;
  return qSa ** 3 + qEa ** 3;
}

function scaledFanFlows(input: {
  u: MpcControlVector;
  uReference: MpcControlVector;
  step: FanFlowContext;
}): { supplyFlowM3h: number; exhaustFlowM3h: number } | null {
  const baseSa = input.step.supplyFanFlowM3h;
  const baseEa = input.step.exhaustFanFlowM3h;
  if ((baseSa ?? 0) < 50 && (baseEa ?? 0) < 50) return null;

  const refSaf = Math.max(5, clampPct(input.uReference.supplyFanPct));
  const refEaf = Math.max(5, clampPct(input.uReference.exhaustFanPct));
  const safRatio = clampPct(input.u.supplyFanPct) / refSaf;
  const eafRatio = clampPct(input.u.exhaustFanPct) / refEaf;
  return {
    supplyFlowM3h: (baseSa ?? 0) * safRatio,
    exhaustFlowM3h: (baseEa ?? 0) * eafRatio,
  };
}

function estimateFanElectricKw(
  u: MpcControlVector,
  betaFan: number,
): number {
  const saf = clampPct(u.supplyFanPct) / 100;
  const eaf = clampPct(u.exhaustFanPct) / 100;
  return betaFan * (saf ** 3 + eaf ** 3);
}

function estimateFanElectricKwWithContext(input: {
  u: MpcControlVector;
  params: PowerProxyParams;
  step?: FanFlowContext | null;
  uReference?: MpcControlVector | null;
}): number {
  const betaFanFlow = input.params.betaFanFlow;
  if (
    betaFanFlow != null &&
    betaFanFlow > 0 &&
    input.step &&
    input.uReference
  ) {
    const flows = scaledFanFlows({
      u: input.u,
      uReference: input.uReference,
      step: input.step,
    });
    if (flows) {
      return betaFanFlow * flowNormFromM3h(flows);
    }
  }
  return estimateFanElectricKw(input.u, input.params.betaFan);
}

/** Methods eq. method_heating_power — forenklet (kW). */
function averageDistrictValveLoad(u: MpcControlVector): number {
  return (
    clampPct(u.districtTr002ValvePct) / 100 + clampPct(u.districtTr003ValvePct) / 100
  ) / 2;
}

function estimateDistrictHeatKw(input: {
  u: MpcControlVector;
  outdoorTempC: number | null;
  buildingDistrictHeatingKwh: number;
  params: PowerProxyParams;
}): number {
  const beta = input.params.betaDistrictHeat ?? 0;
  if (beta <= 0) return 0;
  const load = averageDistrictValveLoad(input.u);
  if (load < 0.02) return 0;
  if (input.outdoorTempC != null) {
    const delta = Math.max(0, 18 - input.outdoorTempC);
    return beta * load * delta;
  }
  const stepHours = MPC_STEP_MINUTES / 60;
  return beta * load * (input.buildingDistrictHeatingKwh / stepHours);
}

function estimateHeatingKw(input: {
  u: MpcControlVector;
  outdoorTempC: number | null;
  betaHeat: number;
}): number {
  if (input.outdoorTempC == null) return 0;
  const delta = Math.max(0, input.u.supplySetpointC - input.outdoorTempC);
  return (
    input.betaHeat *
    (input.u.heatingValvePct / 100) *
    delta
  );
}

export type HeatingDemandBreakdownKw = {
  batteryKw: number;
  districtKw: number;
  totalKw: number;
};

type HeatingDemandInput = {
  u: MpcControlVector;
  outdoorTempC: number | null;
  buildingDistrictHeatingKwh: number;
  params: PowerProxyParams;
};

/** Modellert oppvarmingsbehov — varmebatteri + FV-ventiler (kW), uten TR003-anker. */
export function breakdownHeatingDemandKw(
  input: HeatingDemandInput,
): HeatingDemandBreakdownKw {
  const batteryKw = estimateHeatingKw({
    u: input.u,
    outdoorTempC: input.outdoorTempC,
    betaHeat: input.params.betaHeat,
  });
  const districtKw = estimateDistrictHeatKw(input);
  return {
    batteryKw,
    districtKw,
    totalKw: batteryKw + districtKw,
  };
}

export function isHeatingDemandActive(u: MpcControlVector): boolean {
  return (
    clampPct(u.heatingValvePct) > 8 ||
    clampPct(u.districtTr002ValvePct) > 8 ||
    clampPct(u.districtTr003ValvePct) > 8
  );
}

/**
 * Minimum effektiv ΔT når kjøleventilen er aktiv uten positiv utetemp-setpunkt-delta
 * (avfukting, internlast, sensibel kjøling mot lavere utetemp enn tilluft-SP).
 */
export const COOLING_MIN_EFFECTIVE_DELTA_C = 1;

function coolingValveLoad(u: MpcControlVector): number {
  const load = clampPct(u.coolingValvePct) / 100;
  return load >= COOLING_VALVE_MIN_ACTIVE_PCT / 100 ? load : 0;
}

function effectiveCoolingDeltaC(input: {
  outdoorTempC: number | null;
  supplySetpointC: number;
}): number {
  if (input.outdoorTempC == null) return COOLING_MIN_EFFECTIVE_DELTA_C;
  const thermalDelta = Math.max(0, input.outdoorTempC - input.supplySetpointC);
  return Math.max(COOLING_MIN_EFFECTIVE_DELTA_C, thermalDelta);
}

/** Methods eq. method_cooling_power — forenklet (kW). */
function estimateCoolingKw(input: {
  u: MpcControlVector;
  outdoorTempC: number | null;
  betaCool: number;
}): number {
  const load = coolingValveLoad(input.u);
  if (load <= 0) return 0;
  return (
    input.betaCool *
    load *
    effectiveCoolingDeltaC({
      outdoorTempC: input.outdoorTempC,
      supplySetpointC: input.u.supplySetpointC,
    })
  );
}

export type ControllablePowerEstimateInput = {
  u: MpcControlVector;
  buildingElectricityKwh: number;
  outdoorTempC?: number | null;
  params: PowerProxyParams;
  /** Målt luftmengde fra eval — skaleres med vifte-% når u avviker fra uReference. */
  step?: FanFlowContext | null;
  uReference?: MpcControlVector | null;
};

/**
 * Kontrollerbar effekt for MPC-objektiv og replay.
 * Bruker luftmengde-proxy når tilgjengelig, ellers kubisk vifte-%.
 */
export function estimateControllableElectricKw(
  input: ControllablePowerEstimateInput,
): number {
  return (
    estimateFanElectricKwWithContext(input) +
    estimateCoolingKw({
      u: input.u,
      outdoorTempC: input.outdoorTempC ?? null,
      betaCool: input.params.betaCool,
    })
  );
}

export type ControllableHeatEstimateInput = {
  u: MpcControlVector;
  outdoorTempC: number | null;
  buildingDistrictHeatingKwh: number;
  params: PowerProxyParams;
  /** TR003 effekt — anker proxy når u avviker fra uReference. */
  step?: Pick<MpcTimestep, "districtMeterTr003PowerKw"> | null;
  uReference?: MpcControlVector | null;
};

function modelHeatKw(input: {
  u: MpcControlVector;
  outdoorTempC: number | null;
  buildingDistrictHeatingKwh: number;
  params: PowerProxyParams;
}): number {
  return (
    estimateHeatingKw({
      u: input.u,
      outdoorTempC: input.outdoorTempC,
      betaHeat: input.params.betaHeat,
    }) + estimateDistrictHeatKw(input)
  );
}

function valveActuatorLoad(u: MpcControlVector): number {
  return (
    clampPct(u.heatingValvePct) +
    clampPct(u.districtTr002ValvePct) +
    clampPct(u.districtTr003ValvePct)
  );
}

function capControllableHeatKw(
  heatKw: number,
  input: ControllableHeatEstimateInput,
): number {
  if (heatKw <= 0) return 0;

  const stepHours = MPC_STEP_MINUTES / 60;
  const caps: number[] = [];
  const scopePrior = resolveMpcScopePrior();
  const attestHeatShare =
    scopePrior?.ventilationHeatShareOfDistrictHeat ??
    clampHeatShare(input.params.controllableHeatShare, 0.05);

  const tr003Kw = input.step?.districtMeterTr003PowerKw;
  if (tr003Kw != null && tr003Kw > 0) {
    caps.push(tr003Kw);
  }

  const bhccKw = (input.buildingDistrictHeatingKwh ?? 0) / stepHours;
  if (bhccKw > 0) {
    caps.push(bhccKw);
    if (tr003Kw == null || tr003Kw <= 0) {
      caps.push(bhccKw * attestHeatShare);
    }
  }

  if (caps.length === 0) return heatKw;
  return Math.min(heatKw, Math.min(...caps));
}

export function estimateControllableHeatKw(
  input: ControllableHeatEstimateInput,
): number {
  const modelHeat = modelHeatKw(input);
  const measuredKw = input.step?.districtMeterTr003PowerKw;
  if (measuredKw != null && measuredKw > 0.2 && input.uReference) {
    const refModel = modelHeatKw({ ...input, u: input.uReference });
    const scopePrior = resolveMpcScopePrior();
    const attestShare =
      scopePrior?.ventilationHeatShareOfDistrictHeat ??
      clampHeatShare(input.params.controllableHeatShare, 0.05);
    // Anker på modellert referansebelastning — ikke full TR003 (base load på krets).
    const anchorKw =
      refModel > 0.02
        ? refModel
        : Math.min(measuredKw, measuredKw * attestShare);

    const refActuator = valveActuatorLoad(input.uReference);
    const actuator = valveActuatorLoad(input.u);
    if (refActuator > 8) {
      return capControllableHeatKw(
        Math.max(0, anchorKw * (actuator / refActuator)),
        input,
      );
    }
    if (refModel > 0.02) {
      return capControllableHeatKw(
        Math.max(0, anchorKw * (modelHeat / refModel)),
        input,
      );
    }
  }
  return capControllableHeatKw(modelHeat, input);
}

export function scalePowerProxyParams(
  params: PowerProxyParams,
  scale: {
    elShare?: number;
    heatShare?: number;
    beta?: number;
  },
): PowerProxyParams {
  const el = scale.elShare ?? 1;
  const heat = scale.heatShare ?? 1;
  const beta = scale.beta ?? 1;
  return {
    ...params,
    controllableElectricShare: params.controllableElectricShare * el,
    controllableHeatShare: params.controllableHeatShare * heat,
    betaFan: Math.round(params.betaFan * beta * 1000) / 1000,
    betaFanFlow:
      params.betaFanFlow != null
        ? Math.round(params.betaFanFlow * beta * 1000) / 1000
        : params.betaFanFlow,
    betaHeat: Math.round(params.betaHeat * beta * 1000) / 1000,
    betaDistrictHeat:
      params.betaDistrictHeat != null
        ? Math.round(params.betaDistrictHeat * beta * 1000) / 1000
        : params.betaDistrictHeat,
    betaCool: Math.round(params.betaCool * beta * 1000) / 1000,
  };
}

export function fitPowerProxyParams(
  train: readonly MpcTimestep[],
): PowerProxyParams {
  const fanRows: { x: number; y: number }[] = [];
  const fanFlowRows: { x: number; y: number }[] = [];
  const heatRows: { x: number; y: number }[] = [];
  const districtHeatRows: { x: number; y: number }[] = [];
  const coolRows: { x: number; y: number }[] = [];

  for (const step of train) {
    if (!step.uMeas) continue;
    const stepHours = MPC_STEP_MINUTES / 60;
    const buildingKw = step.buildingElectricityKwh / stepHours;
    const saf = clampPct(step.uMeas.supplyFanPct) / 100;
    const eaf = clampPct(step.uMeas.exhaustFanPct) / 100;
    const fanNorm = saf ** 3 + eaf ** 3;
    if (fanNorm > 0.01 && buildingKw > 0) {
      fanRows.push({ x: fanNorm, y: buildingKw * 0.25 });
    }

    const flowNorm = flowNormFromM3h({
      supplyFlowM3h: step.supplyFanFlowM3h ?? 0,
      exhaustFlowM3h: step.exhaustFanFlowM3h ?? 0,
    });
    if (flowNorm > 0.001 && buildingKw > 0) {
      fanFlowRows.push({ x: flowNorm, y: buildingKw * 0.25 });
    }

    const heatTargetKw = stepDistrictHeatTargetKw(step);

    if (step.outdoorTempC != null && step.uMeas.heatingValvePct > 8) {
      const delta = Math.max(0, step.uMeas.supplySetpointC - step.outdoorTempC);
      const x = (step.uMeas.heatingValvePct / 100) * delta;
      if (x > 0 && heatTargetKw > 0) {
        heatRows.push({ x, y: heatTargetKw * 0.85 });
      }
    }

    const districtLoad = averageDistrictValveLoad(step.uMeas);
    if (step.outdoorTempC != null && districtLoad > 0.02) {
      const delta = Math.max(0, 18 - step.outdoorTempC);
      const districtTargetKw =
        stepDistrictHeatKw(step) ?? stepDistrictHeatTargetKw(step);
      if (districtTargetKw > 0) {
        districtHeatRows.push({
          x: districtLoad * delta,
          y: districtTargetKw * 0.9,
        });
      }
    }

    const coolLoad = coolingValveLoad(step.uMeas);
    if (coolLoad > 0) {
      const delta = effectiveCoolingDeltaC({
        outdoorTempC: step.outdoorTempC,
        supplySetpointC: step.uMeas.supplySetpointC,
      });
      const x = coolLoad * delta;
      const coolingTargetKw =
        (step.buildingCoolingKwh ?? 0) > 0
          ? (step.buildingCoolingKwh ?? 0) / stepHours
          : buildingKw * 0.15;
      if (x > 0 && coolingTargetKw > 0) {
        coolRows.push({ x, y: coolingTargetKw });
      }
    }
  }

  const betaFan = scaleFit(fanRows, 0.5);
  const betaFanFlow =
    fanFlowRows.length >= 8 ? scaleFit(fanFlowRows, betaFan) : null;
  const betaHeat = scaleFit(heatRows, 2);
  const betaDistrictHeat = scaleFit(districtHeatRows, betaHeat * 0.8);
  const betaCool = scaleFit(coolRows, betaHeat * 0.6);
  const shares = fitControllableShares(train, {
    betaFan,
    betaFanFlow,
    betaHeat,
    betaDistrictHeat: districtHeatRows.length >= 4 ? betaDistrictHeat : 0,
    betaCool,
  });

  return {
    version: betaFanFlow != null ? "power-v3" : "power-v2",
    betaFan,
    betaFanFlow,
    betaHeat,
    betaDistrictHeat: districtHeatRows.length >= 4 ? betaDistrictHeat : 0,
    betaCool,
    controllableElectricShare: shares.controllableElectricShare,
    controllableHeatShare: shares.controllableHeatShare,
  };
}

function fitControllableShares(
  train: readonly MpcTimestep[],
  betas: {
    betaFan: number;
    betaFanFlow: number | null;
    betaHeat: number;
    betaDistrictHeat: number;
    betaCool: number;
  },
): { controllableElectricShare: number; controllableHeatShare: number } {
  const stepHours = MPC_STEP_MINUTES / 60;
  const elRatios: number[] = [];
  const heatRatios: number[] = [];
  const params: PowerProxyParams = {
    version: betas.betaFanFlow != null ? "power-v3" : "power-v2",
    betaFan: betas.betaFan,
    betaFanFlow: betas.betaFanFlow,
    betaHeat: betas.betaHeat,
    betaDistrictHeat: betas.betaDistrictHeat,
    betaCool: betas.betaCool,
    controllableElectricShare: 0.1,
    controllableHeatShare: 0.05,
  };

  for (const step of train) {
    if (!step.uMeas) continue;

    const buildingElKw = step.buildingElectricityKwh / stepHours;

    if (buildingElKw > 0.02) {
      const modelKw = estimateControllableElectricKw({
        u: step.uMeas,
        buildingElectricityKwh: step.buildingElectricityKwh,
        outdoorTempC: step.outdoorTempC,
        params,
        step,
        uReference: step.uMeas,
      });
      if (modelKw > 0.01) {
        elRatios.push(modelKw / buildingElKw);
      }
    }

    const heatTargetKw = stepDistrictHeatTargetKw(step);
    if (heatTargetKw > 0.02 && step.outdoorTempC != null) {
      const modelHeat = estimateControllableHeatKw({
        u: step.uMeas,
        outdoorTempC: step.outdoorTempC,
        buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
        params,
        step,
        uReference: step.uMeas,
      });
      if (modelHeat > 0.01) {
        heatRatios.push(modelHeat / heatTargetKw);
      }
    }
  }

  return {
    controllableElectricShare: clampShare(
      clampShareToAttestPrior(
        medianRatio(elRatios),
        resolveMpcScopePrior()?.fanElectricityShareOfDeliveredElectricity ?? 0,
        0.1,
      ),
      0.1,
    ),
    controllableHeatShare: clampHeatShare(
      clampShareToAttestPrior(
        medianRatio(heatRatios),
        resolveMpcScopePrior()?.ventilationHeatShareOfDistrictHeat ?? 0,
        0.05,
      ),
      0.05,
    ),
  };
}

function medianRatio(ratios: readonly number[]): number | null {
  if (ratios.length === 0) return null;
  const sorted = ratios.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function clampShare(value: number | null, fallback: number): number {
  return clampShareInRange(value, fallback, 0.04, 0.4);
}

function clampHeatShare(value: number | null, fallback: number): number {
  return clampShareInRange(value, fallback, 0.05, 0.85);
}

function clampShareInRange(
  value: number | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.round(Math.min(max, Math.max(min, value)) * 1000) / 1000;
}

function scaleFit(
  rows: readonly { x: number; y: number }[],
  fallback: number,
): number {
  if (rows.length === 0) return fallback;
  const ratios: number[] = [];
  for (const row of rows) {
    if (row.x > 1e-6) ratios.push(row.y / row.x);
  }
  if (ratios.length === 0) return fallback;
  const sorted = ratios.toSorted((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  if (!Number.isFinite(median) || median <= 0) return fallback;
  // Unngå at avrunding til 3 desimaler nullstiller betaFan (f.eks. 0.0004 → 0).
  if (median < 0.001) return fallback;
  return Math.round(median * 1000) / 1000;
}

export function stepEnergyCostKr(input: {
  electricKw: number;
  heatKw: number;
  stepMinutes: number;
  marginalKrPerKwh: number | null;
  heatKrPerKwh: number | null;
}): number {
  const hours = input.stepMinutes / 60;
  const elKwh = input.electricKw * hours;
  const heatKwh = input.heatKw * hours;
  const elCost = elKwh * (input.marginalKrPerKwh ?? 0);
  const heatCost = heatKwh * (input.heatKrPerKwh ?? 0);
  return elCost + heatCost;
}
