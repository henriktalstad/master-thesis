import { controlHourKeyFromIso } from "./control-time-buckets";
import {
  buildDistrictDeltaTCrossValidation,
  type DistrictDeltaTStats,
} from "./district-delta-t-cross-validation";
import type {
  MpcCalibrationBundle,
  MpcControlVector,
  MpcReplayStep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import {
  resolveTr003GroundTruthKwh,
  summarizeTr003MeasuredEnergy,
} from "@/lib/sd-anlegg/envelope-model/power/district-heat-ground-truth";
import type { Tr003GroundTruthSource } from "@/lib/sd-anlegg/envelope-model/power/energy-quantity";
import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { filterReplayStepsToEvalWindow } from "./replay-eval-window";
import { summarizeHeatingDemandFromSteps } from "./summarize-heating-demand";

const STEP_HOURS = MPC_STEP_MINUTES / 60;

export type MpcEnergyReconcileMeasured = {
  electricityKwh: number;
  districtHeatingKwh: number;
  totalCostKr: number;
  hours: number;
};

export type MpcEnergyReconcileProxyTrack = {
  elKwh: number;
  heatKwh: number;
  costKr: number;
};

export type MpcEnergyReconcileSummary = {
  evalStart: string;
  evalEnd: string;
  hoursAligned: number;
  measured: MpcEnergyReconcileMeasured;
  proxy: {
    observed: MpcEnergyReconcileProxyTrack;
    emulated: MpcEnergyReconcileProxyTrack;
    mpc: MpcEnergyReconcileProxyTrack;
  };
  shares: {
    controllableElectricShare: number;
    controllableHeatShare: number;
    proxyElectricShareOfMeasured: number | null;
    /** Proxy vs hele bygg BHCC FV. */
    proxyHeatShareOfMeasured: number | null;
    /** Proxy vs TR003 kretssnitt (320003OE001) når tilgjengelig. */
    proxyHeatShareOfCircuit: number | null;
    heatGroundTruth: Tr003GroundTruthSource;
  };
  deltaMpcVsEmulated: {
    costKr: number;
    costPct: number;
    elKwh: number;
    heatKwh: number;
  };
  /** OE001 kretssnitt mot BHCC fjernvarme (WM001). */
  circuitMeter?: {
    tr003EnergyKwh: number;
    tr003PowerKwh: number;
    bhccDistrictHeatingKwh: number;
    gapPct: number | null;
    proxyShareOfCircuitPct: number | null;
    proxyShareOfBhccPct: number | null;
    hoursWithBoth: number;
    hoursWithPower: number;
  };
  /** ΔT tur/retur per TR-krets — BMS vs OE001-måler (uavhengig varmeeffekt-estimat). */
  districtDeltaT: DistrictDeltaTStats[];
  /** Oppvarmingsbehov — modellert batteri + FV vs TR003/BHCC. */
  heatingDemand: import("./summarize-heating-demand").HeatingDemandSummary;
};

export type MpcEnergyReconcileHourRow = {
  hour: string;
  measuredElectricityKwh: number;
  measuredDistrictHeatingKwh: number;
  measuredCostKr: number;
  proxyObservedElKwh: number;
  proxyEmulatedElKwh: number;
  proxyMpcElKwh: number;
  proxyObservedHeatKwh: number;
  proxyEmulatedHeatKwh: number;
  proxyMpcHeatKwh: number;
  proxyObservedCostKr: number;
  proxyEmulatedCostKr: number;
  proxyMpcCostKr: number;
};

export type BhccHourRow = {
  hour: Date;
  electricityVolumeKwh: number | null;
  districtHeatingVolumeKwh: number | null;
  electricityTotalCost: number | null;
  districtHeatingTotalCost: number | null;
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** BHCC-time kan mangle timer — fall tilbake til kalibrert andel kun uten målt grunnlag. */
export function proxyShareOfMeasured(input: {
  proxyKwh: number;
  measuredKwh: number;
  calibratedShare?: number;
}): number | null {
  if (input.measuredKwh > 0 && input.proxyKwh >= 0) {
    return round2(Math.min(100, (input.proxyKwh / input.measuredKwh) * 100));
  }
  if (input.calibratedShare != null && input.calibratedShare > 0) {
    return round2(input.calibratedShare * 100);
  }
  return null;
}

export function proxyShareLooksInflated(
  proxyKwh: number,
  measuredKwh: number,
  warnAbovePct = 55,
): boolean {
  if (measuredKwh <= 0 || proxyKwh <= 0) return false;
  return (proxyKwh / measuredKwh) * 100 > warnAbovePct;
}

function stepElHeatKwh(
  u: MpcControlVector | null | undefined,
  uReference: MpcControlVector | null | undefined,
  step: MpcReplayStep,
  power: MpcCalibrationBundle["power"],
): { elKwh: number; heatKwh: number } {
  if (!u) return { elKwh: 0, heatKwh: 0 };
  const elKw = estimateControllableElectricKw({
    u,
    buildingElectricityKwh: step.buildingElectricityKwh ?? 0,
    outdoorTempC: step.outdoorTempC,
    params: power,
    step,
    uReference: uReference ?? u,
  });
  const heatKw = estimateControllableHeatKw({
    u,
    outdoorTempC: step.outdoorTempC,
    buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh ?? 0,
    params: power,
    step,
    uReference: uReference ?? u,
  });
  return { elKwh: elKw * STEP_HOURS, heatKwh: heatKw * STEP_HOURS };
}

type HourBucket = {
  proxyObservedElKwh: number;
  proxyEmulatedElKwh: number;
  proxyMpcElKwh: number;
  proxyObservedHeatKwh: number;
  proxyEmulatedHeatKwh: number;
  proxyMpcHeatKwh: number;
  proxyObservedCostKr: number;
  proxyEmulatedCostKr: number;
  proxyMpcCostKr: number;
};

function emptyBucket(): HourBucket {
  return {
    proxyObservedElKwh: 0,
    proxyEmulatedElKwh: 0,
    proxyMpcElKwh: 0,
    proxyObservedHeatKwh: 0,
    proxyEmulatedHeatKwh: 0,
    proxyMpcHeatKwh: 0,
    proxyObservedCostKr: 0,
    proxyEmulatedCostKr: 0,
    proxyMpcCostKr: 0,
  };
}

function sumProxyTrack(
  hours: readonly MpcEnergyReconcileHourRow[],
  pick: (row: MpcEnergyReconcileHourRow) => {
    el: number;
    heat: number;
    cost: number;
  },
): MpcEnergyReconcileProxyTrack {
  return hours.reduce(
    (acc, row) => {
      const v = pick(row);
      acc.elKwh += v.el;
      acc.heatKwh += v.heat;
      acc.costKr += v.cost;
      return acc;
    },
    { elKwh: 0, heatKwh: 0, costKr: 0 },
  );
}

export function buildMpcEnergyReconcile(input: {
  evalStart: string;
  evalEnd: string;
  steps: readonly MpcReplayStep[];
  calibration: MpcCalibrationBundle;
  bhccRows: readonly BhccHourRow[];
}): {
  summary: MpcEnergyReconcileSummary;
  hours: MpcEnergyReconcileHourRow[];
} {
  const power = input.calibration.power;
  const steps = filterReplayStepsToEvalWindow(
    input.steps,
    input.evalStart,
    input.evalEnd,
  );
  const proxyByHour = new Map<string, HourBucket>();

  for (const step of steps) {
    const hourKey = controlHourKeyFromIso(step.t);
    const bucket = proxyByHour.get(hourKey) ?? emptyBucket();

    const obs =
      step.proxyElKwhBaseline != null || step.proxyHeatKwhBaseline != null
        ? {
            elKwh: step.proxyElKwhBaseline ?? 0,
            heatKwh: step.proxyHeatKwhBaseline ?? 0,
          }
        : stepElHeatKwh(step.uBmsMeas, step.uBmsMeas, step, power);
    const emu =
      step.proxyElKwhEmulated != null || step.proxyHeatKwhEmulated != null
        ? {
            elKwh: step.proxyElKwhEmulated ?? 0,
            heatKwh: step.proxyHeatKwhEmulated ?? 0,
          }
        : stepElHeatKwh(step.uBmsSim, step.uBmsSim, step, power);
    const mpc =
      step.proxyElKwhMpc != null || step.proxyHeatKwhMpc != null
        ? {
            elKwh: step.proxyElKwhMpc ?? 0,
            heatKwh: step.proxyHeatKwhMpc ?? 0,
          }
        : stepElHeatKwh(step.uMpc, step.uBmsSim, step, power);

    bucket.proxyObservedElKwh += obs.elKwh;
    bucket.proxyObservedHeatKwh += obs.heatKwh;
    bucket.proxyEmulatedElKwh += emu.elKwh;
    bucket.proxyEmulatedHeatKwh += emu.heatKwh;
    bucket.proxyMpcElKwh += mpc.elKwh;
    bucket.proxyMpcHeatKwh += mpc.heatKwh;
    bucket.proxyObservedCostKr += step.costBaselineKr;
    bucket.proxyEmulatedCostKr += step.costEmulatedKr ?? step.costBaselineKr;
    bucket.proxyMpcCostKr += step.costMpcKr;

    proxyByHour.set(hourKey, bucket);
  }

  const measuredByHour = new Map<
    string,
    { el: number; dh: number; cost: number }
  >();
  for (const row of input.bhccRows) {
    const key = controlHourKeyFromIso(row.hour.toISOString());
    const el = row.electricityVolumeKwh ?? 0;
    const dh = row.districtHeatingVolumeKwh ?? 0;
    const cost =
      (row.electricityTotalCost ?? 0) + (row.districtHeatingTotalCost ?? 0);
    if (el <= 0 && dh <= 0 && cost <= 0) continue;
    const prev = measuredByHour.get(key) ?? { el: 0, dh: 0, cost: 0 };
    measuredByHour.set(key, {
      el: prev.el + el,
      dh: prev.dh + dh,
      cost: prev.cost + cost,
    });
  }

  const hourKeys = new Set([...proxyByHour.keys(), ...measuredByHour.keys()]);
  const hours: MpcEnergyReconcileHourRow[] = [...hourKeys]
    .sort()
    .map((hourKey) => {
      const proxy = proxyByHour.get(hourKey) ?? emptyBucket();
      const measured = measuredByHour.get(hourKey) ?? { el: 0, dh: 0, cost: 0 };
      return {
        hour: new Date(`${hourKey}:00:00.000Z`).toISOString(),
        measuredElectricityKwh: round2(measured.el),
        measuredDistrictHeatingKwh: round2(measured.dh),
        measuredCostKr: round2(measured.cost),
        proxyObservedElKwh: round2(proxy.proxyObservedElKwh),
        proxyEmulatedElKwh: round2(proxy.proxyEmulatedElKwh),
        proxyMpcElKwh: round2(proxy.proxyMpcElKwh),
        proxyObservedHeatKwh: round2(proxy.proxyObservedHeatKwh),
        proxyEmulatedHeatKwh: round2(proxy.proxyEmulatedHeatKwh),
        proxyMpcHeatKwh: round2(proxy.proxyMpcHeatKwh),
        proxyObservedCostKr: round2(proxy.proxyObservedCostKr),
        proxyEmulatedCostKr: round2(proxy.proxyEmulatedCostKr),
        proxyMpcCostKr: round2(proxy.proxyMpcCostKr),
      };
    });

  const measuredTotal = hours.reduce(
    (acc, row) => {
      if (row.measuredElectricityKwh > 0 || row.measuredDistrictHeatingKwh > 0) {
        acc.hours += 1;
      }
      acc.electricityKwh += row.measuredElectricityKwh;
      acc.districtHeatingKwh += row.measuredDistrictHeatingKwh;
      acc.totalCostKr += row.measuredCostKr;
      return acc;
    },
    { electricityKwh: 0, districtHeatingKwh: 0, totalCostKr: 0, hours: 0 },
  );

  const observed = sumProxyTrack(hours, (r) => ({
    el: r.proxyObservedElKwh,
    heat: r.proxyObservedHeatKwh,
    cost: r.proxyObservedCostKr,
  }));
  const emulated = sumProxyTrack(hours, (r) => ({
    el: r.proxyEmulatedElKwh,
    heat: r.proxyEmulatedHeatKwh,
    cost: r.proxyEmulatedCostKr,
  }));
  const mpc = sumProxyTrack(hours, (r) => ({
    el: r.proxyMpcElKwh,
    heat: r.proxyMpcHeatKwh,
    cost: r.proxyMpcCostKr,
  }));

  const deltaCostKr = round2(mpc.costKr - emulated.costKr);
  const deltaCostPct =
    emulated.costKr > 0 ? round2((deltaCostKr / emulated.costKr) * 100) : 0;

  const bhccDistrictHeatingKwh = round2(measuredTotal.districtHeatingKwh);
  const tr003 = summarizeTr003MeasuredEnergy({
    steps,
    bhccDistrictHeatingKwh,
  });
  const tr003EnergyKwh = round2(tr003.fromEnergyMeterKwh);
  const tr003PowerKwh = round2(tr003.fromPowerIntegralKwh);
  const tr003GroundTruth = resolveTr003GroundTruthKwh({
    fromEnergyMeterKwh: tr003EnergyKwh,
    fromPowerIntegralKwh: tr003PowerKwh,
    bhccDistrictHeatingKwh,
  });
  const heatGroundTruthKwh = tr003GroundTruth.groundTruthKwh;
  const heatGroundTruthSource =
    tr003GroundTruth.source === "none" ? "bhcc" : tr003GroundTruth.source;
  const hasTr003Circuit =
    heatGroundTruthSource === "tr003_energy_meter" ||
    heatGroundTruthSource === "tr003_power_integral";
  const proxyShareOfCircuitPct = proxyShareOfMeasured({
    proxyKwh: emulated.heatKwh,
    measuredKwh: heatGroundTruthKwh,
    calibratedShare: power.controllableHeatShare,
  });
  const proxyShareOfBhccPct = proxyShareOfMeasured({
    proxyKwh: emulated.heatKwh,
    measuredKwh: bhccDistrictHeatingKwh,
    calibratedShare: power.controllableHeatShare,
  });
  const circuitMeter =
    tr003EnergyKwh > 0 || tr003PowerKwh > 0
      ? {
          tr003EnergyKwh,
          tr003PowerKwh,
          bhccDistrictHeatingKwh,
          gapPct:
            tr003EnergyKwh > 0 && bhccDistrictHeatingKwh > 0
              ? round2(
                  ((tr003EnergyKwh - bhccDistrictHeatingKwh) /
                    bhccDistrictHeatingKwh) *
                    100,
                )
              : null,
          proxyShareOfCircuitPct,
          proxyShareOfBhccPct,
          hoursWithBoth: hours.filter(
            (h) =>
              h.measuredDistrictHeatingKwh > 0 &&
              steps.some(
                (s) =>
                  controlHourKeyFromIso(s.t) ===
                    controlHourKeyFromIso(h.hour) &&
                  s.districtMeterTr003EnergyKwh != null,
              ),
          ).length,
          hoursWithPower: hours.filter((h) =>
            steps.some(
              (s) =>
                controlHourKeyFromIso(s.t) === controlHourKeyFromIso(h.hour) &&
                s.districtMeterTr003PowerKw != null &&
                s.districtMeterTr003PowerKw > 0,
            ),
          ).length,
        }
      : undefined;

  const summary: MpcEnergyReconcileSummary = {
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
    hoursAligned: hours.filter(
      (h) =>
        h.measuredCostKr > 0 ||
        h.proxyEmulatedCostKr > 0 ||
        h.proxyMpcCostKr > 0,
    ).length,
    measured: {
      electricityKwh: round2(measuredTotal.electricityKwh),
      districtHeatingKwh: round2(measuredTotal.districtHeatingKwh),
      totalCostKr: round2(measuredTotal.totalCostKr),
      hours: measuredTotal.hours,
    },
    proxy: {
      observed: {
        elKwh: round2(observed.elKwh),
        heatKwh: round2(observed.heatKwh),
        costKr: round2(observed.costKr),
      },
      emulated: {
        elKwh: round2(emulated.elKwh),
        heatKwh: round2(emulated.heatKwh),
        costKr: round2(emulated.costKr),
      },
      mpc: {
        elKwh: round2(mpc.elKwh),
        heatKwh: round2(mpc.heatKwh),
        costKr: round2(mpc.costKr),
      },
    },
    shares: {
      controllableElectricShare: power.controllableElectricShare,
      controllableHeatShare: power.controllableHeatShare,
      proxyElectricShareOfMeasured: proxyShareOfMeasured({
        proxyKwh: emulated.elKwh,
        measuredKwh: measuredTotal.electricityKwh,
        calibratedShare: power.controllableElectricShare,
      }),
      proxyHeatShareOfMeasured: proxyShareOfBhccPct,
      proxyHeatShareOfCircuit: hasTr003Circuit ? proxyShareOfCircuitPct : null,
      heatGroundTruth: heatGroundTruthSource,
    },
    deltaMpcVsEmulated: {
      costKr: deltaCostKr,
      costPct: deltaCostPct,
      elKwh: round2(mpc.elKwh - emulated.elKwh),
      heatKwh: round2(mpc.heatKwh - emulated.heatKwh),
    },
    circuitMeter,
    districtDeltaT: buildDistrictDeltaTCrossValidation(steps),
    heatingDemand: summarizeHeatingDemandFromSteps({
      steps,
      power,
      bhccDistrictHeatingKwh,
    }),
  };

  return { summary, hours };
}
