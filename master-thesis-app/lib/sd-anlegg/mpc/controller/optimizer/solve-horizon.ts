import {
  zeroControlVector,
  clampDeltaU,
  addControlVectors,
  clampControlVector,
  controlVectorNormSq,
  deltaControlVectors,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import {
  advancePlantHorizonState,
  type PlantHorizonState,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/plant-horizon-rollout";
import {
  actuatorCostWeight,
  MPC_OPTIMIZER_KEY_ORDER,
  supplySetpointAffectsPower,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/actuator-cost-sensitivity";
import { zeroDisabledDeltaComponents } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import { emulateBaselineControl } from "@/lib/sd-anlegg/mpc/controller/envelope-model/fit-baseline-emulator";
import { isDisturbedOperationStep } from "@/lib/sd-anlegg/mpc/config/constraints/normal-drift-step";
import { alignEmulatedControlWithMeasured } from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
  resolvePowerFlowAnchor,
  stepEnergyCostKr,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import { buildPriceThresholdsFromSteps } from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import {
  comfortViolation,
  shouldUseFallback,
} from "@/lib/sd-anlegg/mpc/config/mpc-comfort";
import {
  resolveMpcSearchAnchorMode,
  type MpcSearchAnchorMode,
} from "@/lib/sd-anlegg/mpc/config/mpc-config";
import type { ComfortBandC } from "@/lib/sd-anlegg/mpc/config/parse-building-comfort-band";
import type {
  MpcCalibrationBundle,
  MpcControlVector,
  MpcSolverConfig,
  MpcTimestep,
} from "@/lib/sd-anlegg/mpc/shared/types";

/** Ekstra move-straff på SP-δu uten effekt-kobling (komfort-only i plantmodell). */
const COMFORT_ONLY_SETPOINT_MOVE = 0.4;

const ALL_CHANNELS_ENABLED: Record<keyof MpcControlVector, boolean> = {
  supplySetpointC: true,
  supplyFanPct: true,
  exhaustFanPct: true,
  heatingValvePct: true,
  coolingValvePct: true,
  districtTr002ValvePct: true,
  districtTr003ValvePct: true,
};

export type MpcHorizonInput = {
  startIndex: number;
  steps: readonly MpcTimestep[];
  uBmsSimHorizon: readonly MpcControlVector[];
  tExtInitial: number;
  tRecInitial?: number | null;
  config: MpcSolverConfig;
  calibration: MpcCalibrationBundle;
  channelEnabledHorizon?: ReadonlyArray<
    Record<keyof MpcControlVector, boolean>
  >;
  comfortBandHorizon?: readonly ComfortBandC[];
  comfortLambdaHorizon?: readonly number[];
  lambdaMoveHorizon?: readonly number[];
  /** Receding-horizon warm-start — forrige δu-plan shifted ett steg. */
  warmStartDeltaHorizon?: readonly MpcControlVector[];
  /**
   * Thesis replay / counterfactual: kjør optimizer selv når deploy-gate ville blokkert
   * (alarm/pumpe). `usedFallback` i replay markerer fortsatt felt-deploy-nei.
   */
  counterfactualOptimize?: boolean;
};

function enabledAtStep(
  channelEnabledHorizon: MpcHorizonInput["channelEnabledHorizon"],
  index: number,
): Record<keyof MpcControlVector, boolean> {
  return channelEnabledHorizon?.[index] ?? ALL_CHANNELS_ENABLED;
}

export type MpcHorizonSolution = {
  deltaHorizon: MpcControlVector[];
  uHorizon: MpcControlVector[];
  predictedExtractC: number[];
  totalCost: number;
  peakElectricKw: number;
  comfortPenalty: number;
};

function marginalPrice(step: MpcTimestep): number | null {
  return step.effectiveMarginalKrPerKwh ?? step.spotKrPerKwh;
}

function withDeltaAt(
  horizon: MpcControlVector[],
  index: number,
  delta: MpcControlVector,
): MpcControlVector[] {
  const next = horizon.slice();
  next[index] = delta;
  return next;
}

function medianMarginalPrice(steps: readonly MpcTimestep[]): number {
  const prices = steps
    .map((step) => marginalPrice(step))
    .filter((p): p is number => p != null && Number.isFinite(p));
  if (prices.length === 0) return 1;
  const sorted = prices.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Pris-bevisst δu-seed for coordinate descent. */
function seedEconomicDeltaHorizon(input: {
  horizonSteps: readonly MpcTimestep[];
  uBmsSimHorizon: readonly MpcControlVector[];
  bounds: MpcSolverConfig["bounds"];
  tExtInitial: number;
  tRecInitial?: number | null;
  calibration: MpcCalibrationBundle;
  comfortBandHorizon?: readonly ComfortBandC[];
  defaultComfortBand: ComfortBandC;
  channelEnabledHorizon?: MpcHorizonInput["channelEnabledHorizon"];
}): MpcControlVector[] {
  const thresholds = buildPriceThresholdsFromSteps(input.horizonSteps);
  let tExt = input.tExtInitial;
  let tRec = input.tRecInitial ?? null;

  return input.horizonSteps.map((step, i) => {
    const enabled = enabledAtStep(input.channelEnabledHorizon, i);
    const u = input.uBmsSimHorizon[i]!;
    const price =
      marginalPrice(step) ?? medianMarginalPrice(input.horizonSteps);
    const isHighPrice = price >= thresholds.high * 0.98;
    const isLowPrice =
      thresholds.low < thresholds.high && price <= thresholds.low * 1.02;
    const delta = zeroControlVector();

    const rolled = advancePlantHorizonState({
      plant: input.calibration.plant,
      state: { tExt, tRec },
      u,
      step,
    });
    const pred = rolled.extractPred;
    tExt = rolled.state.tExt;
    tRec = rolled.state.tRec;

    const band = input.comfortBandHorizon?.[i] ?? input.defaultComfortBand;
    const headroomAbove = pred != null ? pred - band.min : 1.5;
    const headroomBelow = pred != null ? band.max - pred : 1.5;
    const priceIntensity =
      thresholds.high > 0
        ? Math.min(2.5, Math.max(0.35, price / thresholds.high - 0.85))
        : 0.5;

    if (isHighPrice) {
      if (headroomAbove > 0.6 && enabled.supplyFanPct && u.supplyFanPct > 5) {
        const trim = Math.min(
          12,
          u.supplyFanPct * 0.14 * Math.max(0.4, priceIntensity),
        );
        delta.supplyFanPct = -trim;
        if (enabled.exhaustFanPct) delta.exhaustFanPct = -trim;
      }
      if (
        enabled.heatingValvePct &&
        u.heatingValvePct > 10 &&
        headroomAbove > 0.8
      ) {
        delta.heatingValvePct = -Math.min(
          15,
          u.heatingValvePct * 0.18 * Math.max(0.4, priceIntensity),
        );
      }
      if (
        enabled.districtTr002ValvePct &&
        step.heatingActive &&
        u.districtTr002ValvePct > 10 &&
        headroomAbove > 0.8
      ) {
        delta.districtTr002ValvePct = -Math.min(
          12,
          u.districtTr002ValvePct * 0.16 * Math.max(0.4, priceIntensity),
        );
      }
      if (
        enabled.districtTr003ValvePct &&
        step.heatingActive &&
        u.districtTr003ValvePct > 10 &&
        headroomAbove > 0.8
      ) {
        delta.districtTr003ValvePct = -Math.min(
          12,
          u.districtTr003ValvePct * 0.16 * Math.max(0.4, priceIntensity),
        );
      }
      if (
        enabled.coolingValvePct &&
        step.coolingActive &&
        u.coolingValvePct > 10 &&
        headroomAbove > 0.6
      ) {
        delta.coolingValvePct = -Math.min(
          15,
          u.coolingValvePct * 0.16 * Math.max(0.4, priceIntensity),
        );
      }
      if (
        enabled.supplySetpointC &&
        step.coolingActive &&
        u.coolingValvePct > 8 &&
        headroomAbove > 0.5
      ) {
        delta.supplySetpointC = Math.min(
          1,
          0.45 * Math.max(0.4, priceIntensity),
        );
      }
    } else if (isLowPrice && headroomBelow > 0.4) {
      const cheapIntensity = Math.min(
        2,
        thresholds.high > 0 ? thresholds.high / Math.max(0.05, price) - 1 : 0.5,
      );
      if (enabled.heatingValvePct && step.heatingActive) {
        delta.heatingValvePct = Math.min(12, 8 * cheapIntensity);
      }
      if (enabled.districtTr002ValvePct && step.heatingActive) {
        delta.districtTr002ValvePct = Math.min(10, 6 * cheapIntensity);
      }
      if (enabled.districtTr003ValvePct && step.heatingActive) {
        delta.districtTr003ValvePct = Math.min(10, 6 * cheapIntensity);
      }
      if (enabled.supplySetpointC) {
        delta.supplySetpointC = Math.min(1.2, 0.6 * cheapIntensity);
      }
    }

    return zeroDisabledDeltaComponents(
      clampDeltaU(delta, input.bounds),
      enabled,
    );
  });
}

function applyCoordinateDescentStep(input: {
  deltaHorizon: MpcControlVector[];
  stepIndex: number;
  key: keyof MpcControlVector;
  enabled: Record<keyof MpcControlVector, boolean>;
  config: MpcSolverConfig;
  evalInput: Omit<Parameters<typeof evaluateHorizon>[0], "deltaHorizon">;
  horizonSteps: readonly MpcTimestep[];
  uBmsSim: MpcControlVector;
}): void {
  const {
    deltaHorizon,
    stepIndex,
    key,
    enabled,
    config,
    evalInput,
    horizonSteps,
    uBmsSim,
  } = input;
  if (!enabled[key]) return;

  const step = horizonSteps[stepIndex]!;
  const costWeight = actuatorCostWeight({ key, u: uBmsSim, step });
  if (costWeight < 0.08) return;

  const eps = key === "supplySetpointC" ? 0.05 : 1;
  const base = deltaHorizon[stepIndex]!;
  const costUp = evaluateHorizon({
    deltaHorizon: withDeltaAt(
      deltaHorizon,
      stepIndex,
      zeroDisabledDeltaComponents(
        clampDeltaU({ ...base, [key]: base[key] + eps }, config.bounds),
        enabled,
      ),
    ),
    ...evalInput,
  }).cost;
  const costDown = evaluateHorizon({
    deltaHorizon: withDeltaAt(
      deltaHorizon,
      stepIndex,
      zeroDisabledDeltaComponents(
        clampDeltaU({ ...base, [key]: base[key] - eps }, config.bounds),
        enabled,
      ),
    ),
    ...evalInput,
  }).cost;

  const grad = (costUp - costDown) / (2 * eps);
  if (!Number.isFinite(grad) || Math.abs(grad) < 1e-12) return;

  const stepPrice = marginalPrice(horizonSteps[stepIndex]!) ?? 1;
  const median = medianMarginalPrice(horizonSteps);
  const priceScale = Math.min(
    2.5,
    Math.max(0.75, stepPrice / Math.max(0.05, median)),
  );
  const baseStep = -config.learningRate * priceScale * costWeight * grad;

  let bestDelta = base;
  let bestCost = evaluateHorizon({ deltaHorizon, ...evalInput }).cost;

  for (const alpha of [0.25, 0.5, 1, 2, 4]) {
    const trial = zeroDisabledDeltaComponents(
      clampDeltaU(
        { ...base, [key]: base[key] + alpha * baseStep },
        config.bounds,
      ),
      enabled,
    );
    const trialCost = evaluateHorizon({
      deltaHorizon: withDeltaAt(deltaHorizon, stepIndex, trial),
      ...evalInput,
    }).cost;
    if (trialCost < bestCost) {
      bestCost = trialCost;
      bestDelta = trial;
    }
  }

  deltaHorizon[stepIndex] = bestDelta;
}

/** Minimum skaleringsfaktor — unngår at flat kost-gradient dreper all δu-aktivitet. */
export const ADAPTIVE_LAMBDA_MOVE_MIN_SCALE = 0.35;

export function scaleAdaptiveLambdaMove(
  meanCostPerStepKr: number,
  lambdaMove: number,
): number {
  if (meanCostPerStepKr < 0.003) {
    return lambdaMove * ADAPTIVE_LAMBDA_MOVE_MIN_SCALE;
  }
  if (meanCostPerStepKr < 0.008) {
    return lambdaMove * 0.55;
  }
  if (meanCostPerStepKr < 0.015) {
    return lambdaMove * 0.7;
  }
  if (meanCostPerStepKr < 0.03) {
    return lambdaMove * 0.85;
  }
  return lambdaMove;
}

/** Economic MPC — vekt energikost etter relativ spot vs horisont-median. */
export function marginalEnergyWeight(
  stepPrice: number,
  medianPrice: number,
): number {
  const ratio = stepPrice / Math.max(0.05, medianPrice);
  return Math.min(2.35, Math.max(0.85, ratio ** 1.2));
}

/** Lav λ_move ved høy pris (load shift) og moderat ved lav pris (forvarming). */
export function horizonMovePenaltyScale(input: {
  stepPrice: number;
  priceThresholds: { high: number; low: number };
}): number {
  const { stepPrice, priceThresholds } = input;
  if (stepPrice >= priceThresholds.high * 0.98) return 0.12;
  if (
    priceThresholds.low < priceThresholds.high &&
    stepPrice <= priceThresholds.low * 1.02
  ) {
    return 0.55;
  }
  return 1;
}

function adaptiveLambdaMove(input: {
  config: MpcSolverConfig;
  horizonSteps: readonly MpcTimestep[];
  uBmsSimHorizon: readonly MpcControlVector[];
  powerParams: import("@/lib/sd-anlegg/mpc/shared/types").PowerProxyParams;
}): number {
  let totalEnergyCost = 0;
  for (let i = 0; i < input.horizonSteps.length; i++) {
    const step = input.horizonSteps[i]!;
    const u = input.uBmsSimHorizon[i]!;
    const powerAnchor = resolvePowerFlowAnchor(step.uMeas, u);
    const marginal = marginalPrice(step) ?? 0;
    const electricKw = estimateControllableElectricKw({
      u,
      buildingElectricityKwh: step.buildingElectricityKwh,
      outdoorTempC: step.outdoorTempC,
      params: input.powerParams,
      step,
      uReference: powerAnchor,
    });
    const heatKw = estimateControllableHeatKw({
      u,
      outdoorTempC: step.outdoorTempC,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      params: input.powerParams,
      step,
      uReference: powerAnchor,
    });
    totalEnergyCost += stepEnergyCostKr({
      electricKw,
      heatKw,
      stepMinutes: input.config.stepMinutes,
      marginalKrPerKwh: marginal,
      heatKrPerKwh: step.heatKrPerKwh,
    });
  }
  const mean =
    input.horizonSteps.length > 0
      ? totalEnergyCost / input.horizonSteps.length
      : 0;
  return scaleAdaptiveLambdaMove(mean, input.config.lambdaMove);
}

function evaluateHorizon(input: {
  deltaHorizon: MpcControlVector[];
  horizonSteps: MpcTimestep[];
  uBmsSimHorizon: MpcControlVector[];
  tExtInitial: number;
  tRecInitial?: number | null;
  config: MpcSolverConfig;
  calibration: MpcCalibrationBundle;
  lambdaMoveEffective: number;
  channelEnabledHorizon?: ReadonlyArray<
    Record<keyof MpcControlVector, boolean>
  >;
  comfortBandHorizon?: readonly ComfortBandC[];
  comfortLambdaHorizon?: readonly number[];
  lambdaMoveHorizon?: readonly number[];
}): {
  cost: number;
  peakElectricKw: number;
  comfortPenalty: number;
  uHorizon: MpcControlVector[];
  predictedExtractC: number[];
} {
  const { config, calibration } = input;
  const powerParams = calibration.power;
  const plantParams = calibration.plant;
  const priceThresholds = buildPriceThresholdsFromSteps(input.horizonSteps);
  const medianMarginal = medianMarginalPrice(input.horizonSteps);
  let plantState: PlantHorizonState = {
    tExt: input.tExtInitial,
    tRec: input.tRecInitial ?? null,
  };
  let cost = 0;
  let peakElectricKw = 0;
  let comfortPenalty = 0;
  const uHorizon: MpcControlVector[] = [];
  const predictedExtractC: number[] = [];
  let previousU: MpcControlVector | null = null;

  for (let i = 0; i < input.horizonSteps.length; i++) {
    const step = input.horizonSteps[i]!;
    const stepPrice = marginalPrice(step) ?? medianMarginal;
    const enabled = enabledAtStep(input.channelEnabledHorizon, i);
    const delta = zeroDisabledDeltaComponents(
      input.deltaHorizon[i] ?? zeroControlVector(),
      enabled,
    );
    const u = clampControlVector(
      addControlVectors(input.uBmsSimHorizon[i]!, delta),
      config.bounds,
    );
    uHorizon.push(u);

    const rolled = advancePlantHorizonState({
      plant: plantParams,
      state: plantState,
      u,
      step,
    });
    plantState = rolled.state;
    const pred = rolled.extractPred;
    if (pred != null) {
      predictedExtractC.push(pred);
      const band = input.comfortBandHorizon?.[i] ?? input.config.comfortBandC;
      const viol = comfortViolation(pred, band);
      const lambdaComfort =
        input.comfortLambdaHorizon?.[i] ?? input.config.lambdaComfort;
      const highPrice = stepPrice >= priceThresholds.high * 0.98;
      const comfortScale = highPrice ? 0.55 : 1;
      comfortPenalty += viol ** 2;
      cost += lambdaComfort * comfortScale * viol ** 2;
    } else {
      predictedExtractC.push(plantState.tExt);
    }

    const powerAnchor = resolvePowerFlowAnchor(
      step.uMeas,
      input.uBmsSimHorizon[i]!,
    );

    const electricKw = estimateControllableElectricKw({
      u,
      buildingElectricityKwh: step.buildingElectricityKwh,
      outdoorTempC: step.outdoorTempC,
      params: powerParams,
      step,
      uReference: powerAnchor,
    });
    const heatKw = estimateControllableHeatKw({
      u,
      outdoorTempC: step.outdoorTempC,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      params: powerParams,
      step,
      uReference: powerAnchor,
    });
    peakElectricKw = Math.max(peakElectricKw, electricKw);

    cost +=
      marginalEnergyWeight(stepPrice, medianMarginal) *
      stepEnergyCostKr({
        electricKw,
        heatKw,
        stepMinutes: config.stepMinutes,
        marginalKrPerKwh: stepPrice,
        heatKrPerKwh: step.heatKrPerKwh,
      });
    const moveScale = input.lambdaMoveHorizon?.[i] ?? 1;
    const movePenaltyScale = horizonMovePenaltyScale({
      stepPrice,
      priceThresholds,
    });
    cost +=
      input.lambdaMoveEffective *
      moveScale *
      movePenaltyScale *
      controlVectorNormSq(delta);
    if (previousU != null && config.lambdaMoveTemporal > 0) {
      cost +=
        config.lambdaMoveTemporal *
        moveScale *
        movePenaltyScale *
        controlVectorNormSq(deltaControlVectors(u, previousU));
    }
    previousU = u;
    if (
      !supplySetpointAffectsPower({ u, step }) &&
      Math.abs(delta.supplySetpointC) > 1e-6
    ) {
      cost +=
        COMFORT_ONLY_SETPOINT_MOVE *
        input.lambdaMoveEffective *
        moveScale *
        delta.supplySetpointC ** 2;
    }
  }

  cost += config.lambdaPeak * peakElectricKw;

  return {
    cost,
    peakElectricKw,
    comfortPenalty,
    uHorizon,
    predictedExtractC,
  };
}

/**
 * Løser eq. method_mpc_objective med projected gradient over δu.
 * u^MPC = u^BMS,sim + δu (Methods eq. method_mpc_delta_control).
 */
export function solveMpcHorizon(input: MpcHorizonInput): MpcHorizonSolution {
  const { config, calibration, steps, startIndex } = input;
  const H = Math.min(
    config.horizonSteps,
    steps.length - startIndex,
    input.uBmsSimHorizon.length,
  );

  const horizonSteps = steps.slice(startIndex, startIndex + H);
  const uBmsSimHorizon = input.uBmsSimHorizon.slice(0, H);

  const currentStep = steps[startIndex]!;
  if (!input.counterfactualOptimize && shouldUseFallback(currentStep)) {
    const zeros = Array.from({ length: H }, () => zeroControlVector());
    const evalResult = evaluateHorizon({
      deltaHorizon: zeros,
      horizonSteps,
      uBmsSimHorizon,
      tExtInitial: input.tExtInitial,
      tRecInitial: input.tRecInitial,
      config,
      calibration,
      lambdaMoveEffective: adaptiveLambdaMove({
        config,
        horizonSteps,
        uBmsSimHorizon,
        powerParams: calibration.power,
      }),
      channelEnabledHorizon: input.channelEnabledHorizon,
      comfortBandHorizon: input.comfortBandHorizon,
      comfortLambdaHorizon: input.comfortLambdaHorizon?.slice(0, H),
      lambdaMoveHorizon: input.lambdaMoveHorizon?.slice(0, H),
    });
    return {
      deltaHorizon: zeros,
      uHorizon: evalResult.uHorizon,
      predictedExtractC: evalResult.predictedExtractC,
      totalCost: evalResult.cost,
      peakElectricKw: evalResult.peakElectricKw,
      comfortPenalty: evalResult.comfortPenalty,
    };
  }

  let deltaHorizon = input.warmStartDeltaHorizon?.length
    ? input.warmStartDeltaHorizon.slice(0, H).map((d) => ({ ...d }))
    : seedEconomicDeltaHorizon({
        horizonSteps,
        uBmsSimHorizon,
        bounds: config.bounds,
        tExtInitial: input.tExtInitial,
        tRecInitial: input.tRecInitial,
        calibration,
        comfortBandHorizon: input.comfortBandHorizon?.slice(0, H),
        defaultComfortBand: config.comfortBandC,
        channelEnabledHorizon: input.channelEnabledHorizon,
      });
  const zeroDeltaHorizon = Array.from({ length: H }, () => zeroControlVector());
  const lambdaMoveEffective = adaptiveLambdaMove({
    config,
    horizonSteps,
    uBmsSimHorizon,
    powerParams: calibration.power,
  });
  const evalInput = {
    horizonSteps,
    uBmsSimHorizon,
    tExtInitial: input.tExtInitial,
    tRecInitial: input.tRecInitial,
    config,
    calibration,
    lambdaMoveEffective,
    channelEnabledHorizon: input.channelEnabledHorizon,
    comfortBandHorizon: input.comfortBandHorizon?.slice(0, H),
    comfortLambdaHorizon: input.comfortLambdaHorizon?.slice(0, H),
    lambdaMoveHorizon: input.lambdaMoveHorizon?.slice(0, H),
  };
  const seededEval = evaluateHorizon({ deltaHorizon, ...evalInput });
  const zeroEval = evaluateHorizon({
    deltaHorizon: zeroDeltaHorizon,
    ...evalInput,
  });
  if (seededEval.cost >= zeroEval.cost) {
    deltaHorizon = zeroDeltaHorizon;
  }
  let bestDeltaHorizon = deltaHorizon.map((d) => ({ ...d }));
  let best = seededEval.cost < zeroEval.cost ? seededEval : zeroEval;
  let bestCost = best.cost;

  for (let iter = 0; iter < config.maxIterations; iter++) {
    const prevCost = bestCost;
    for (let i = 0; i < H; i++) {
      const enabled = enabledAtStep(input.channelEnabledHorizon, i);
      const uBmsSim = uBmsSimHorizon[i]!;
      for (const key of MPC_OPTIMIZER_KEY_ORDER) {
        applyCoordinateDescentStep({
          deltaHorizon,
          stepIndex: i,
          key,
          enabled,
          config,
          evalInput,
          horizonSteps,
          uBmsSim,
        });
      }
    }

    const evalResult = evaluateHorizon({ deltaHorizon, ...evalInput });

    if (evalResult.cost < bestCost) {
      bestCost = evalResult.cost;
      best = evalResult;
      bestDeltaHorizon = deltaHorizon.map((d) => ({ ...d }));
    }

    const relImprovement =
      prevCost > 0 ? Math.abs(prevCost - bestCost) / prevCost : 0;
    if (relImprovement < 5e-5 && iter >= 8) {
      break;
    }
  }

  return {
    deltaHorizon: bestDeltaHorizon,
    uHorizon: best.uHorizon,
    predictedExtractC: best.predictedExtractC,
    totalCost: bestCost,
    peakElectricKw: best.peakElectricKw,
    comfortPenalty: best.comfortPenalty,
  };
}

export function buildBmsSimHorizon(
  steps: readonly MpcTimestep[],
  startIndex: number,
  horizon: number,
  calibration: MpcCalibrationBundle,
  tExtInitial?: number | null,
): MpcControlVector[] {
  const out: MpcControlVector[] = [];
  const firstStep = steps[startIndex];
  let tExt =
    tExtInitial ??
    firstStep?.extractTempC ??
    calibration.emulator.defaultExtractSetpointC ??
    21;
  let tRec = firstStep?.heatRecoveryAfterTempC ?? null;

  for (let i = 0; i < horizon; i++) {
    const step = steps[startIndex + i];
    if (!step) break;
    const disturbed = isDisturbedOperationStep(step);
    const u = alignEmulatedControlWithMeasured(
      emulateBaselineControl(calibration.emulator, step, {
        tExtPrev: tExt,
        disturbed,
      }),
      step.uMeas,
    );
    out.push(u);

    if (calibration.plant?.featureNames?.length) {
      const advanced = advancePlantHorizonState({
        plant: calibration.plant,
        state: { tExt, tRec },
        u,
        step,
      });
      tExt = advanced.state.tExt;
      tRec = advanced.state.tRec;
    } else if (step.extractTempC != null) {
      tExt = step.extractTempC;
    }
  }
  return out;
}

/** δu-senter: hybrid holder receding-horizon nær målt BMS ved k=0 (Theory + Walnum retrofit). */
export function buildMpcSearchAnchorHorizon(
  steps: readonly MpcTimestep[],
  startIndex: number,
  horizon: number,
  calibration: MpcCalibrationBundle,
  mode: MpcSearchAnchorMode = resolveMpcSearchAnchorMode(),
  tExtInitial?: number | null,
): MpcControlVector[] {
  const sim = buildBmsSimHorizon(
    steps,
    startIndex,
    horizon,
    calibration,
    tExtInitial,
  );
  if (mode === "emulated") return sim;

  return sim.map((uSim, i) => {
    const step = steps[startIndex + i];
    const uMeas = step?.uMeas;
    if (!uMeas) return uSim;
    if (mode === "observed") return uMeas;
    return i === 0 ? uMeas : uSim;
  });
}
