import type { MpcForwardPlanStep } from "./control-types-live";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { mpcStepKeyFromMs } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { CONTROL_SIGNAL_CATALOG_360102 } from "./control-signal-catalog";
import type { MpcLiveStepSnapshot, MpcSignalComparison } from "./control-types";
import {
  MPC_COMPARISON_BMS_SETPOINT_SERIES,
  MPC_COMPARISON_SERIES,
} from "./mpc-signal-series-registry";
import { roundControlComparisonValue } from "./control-comparison-precision";
import { resolvePointForCatalogEntry } from "./resolve-control-signals";
import { resolveTrustedCoolingValvePct } from "./resolve-cooling-valve-pct";
import { parseMpcStepKey } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import {
  NAERBYEN_OFFICE_COMFORT_SCHEDULE,
  resolveComfortBandForStepWithOccupancy,
} from "@/lib/sd-anlegg/mpc/config/comfort-schedule";
import {
  NAERBYEN_OFFICE_OPERATING_PROFILE,
  occupancyContextLabel,
  resolveOccupancyForStep,
  type BuildingOperatingProfile,
  type OccupancyCalibration,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";

const DEVIATION_EPS = 0.05;

export type LiveControlContext = {
  forwardPlanStep0?: MpcForwardPlanStep | null;
  activeCommand?: MpcControlVector | null;
  operatingProfile?: BuildingOperatingProfile | null;
  occupancyCalibration?: OccupancyCalibration | null;
};

const LIVE_OBSERVED_BY_SERIES: Record<
  string,
  keyof MpcControlVector | "extractTempC" | "supplyTempC"
> = {
  supply_setpoint_mpc: "supplySetpointC",
  supply_fan_mpc: "supplyFanPct",
  exhaust_fan_mpc: "exhaustFanPct",
  heating_valve_mpc: "heatingValvePct",
  cooling_valve_mpc: "coolingValvePct",
  extract_temp_comfort: "extractTempC",
  supply_temp_meas: "supplyTempC",
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function liveVectorFromPoints(
  livePoints: readonly InfraspawnPointListItem[],
): Partial<MpcControlVector> & {
  supplySetpointOperatorC?: number;
  supplySetpointCalcC?: number;
  extractTempC?: number;
  supplyTempC?: number;
} {
  const out: Partial<MpcControlVector> & {
    supplySetpointOperatorC?: number;
    supplySetpointCalcC?: number;
    extractTempC?: number;
    supplyTempC?: number;
  } = {};
  let coolingCommand: number | undefined;
  let coolingFeedback: number | undefined;
  let outdoorTempC: number | undefined;

  for (const entry of CONTROL_SIGNAL_CATALOG_360102) {
    const point = resolvePointForCatalogEntry(livePoints, entry);
    const value = point?.lastValue;
    if (value == null || Number.isNaN(value)) continue;
    switch (entry.canonicalId) {
      case "supply.setpoint":
        out.supplySetpointOperatorC = round1(value);
        break;
      case "supply.setpoint_calculated":
        out.supplySetpointCalcC = round1(value);
        out.supplySetpointC = round1(value);
        break;
      case "supply.fan.command":
        out.supplyFanPct = round1(value);
        break;
      case "exhaust.fan.command":
        out.exhaustFanPct = round1(value);
        break;
      case "heating.valve.command":
        out.heatingValvePct = round1(value);
        break;
      case "cooling.valve.command":
        coolingCommand = round1(value);
        break;
      case "cooling.valve.position":
        coolingFeedback = round1(value);
        break;
      case "supply.temp":
        out.supplyTempC = round1(value);
        break;
      case "extract.temp":
        out.extractTempC = round1(value);
        break;
      case "outdoor.temp":
        outdoorTempC = round1(value);
        break;
      default:
        break;
    }
  }

  if (coolingCommand != null || coolingFeedback != null) {
    out.coolingValvePct = resolveTrustedCoolingValvePct({
      commandPct: coolingCommand ?? coolingFeedback ?? 0,
      feedbackPct: coolingFeedback,
      outdoorTempC,
    }).trustedPct;
  }

  return out;
}

function findReplayStepForKey(
  steps: readonly MpcReplayStep[],
  stepIso: string,
): MpcReplayStep | null {
  const exact = steps.find((s) => s.t === stepIso);
  if (exact) return exact;
  const targetMs = new Date(stepIso).getTime();
  if (Number.isNaN(targetMs)) return null;
  let best: MpcReplayStep | null = null;
  let bestDelta = Infinity;
  for (const step of steps) {
    const delta = Math.abs(new Date(step.t).getTime() - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = step;
    }
  }
  return bestDelta <= 15 * 60_000 ? best : null;
}

function observedForSeries(
  seriesId: string,
  observed: Partial<MpcControlVector> & {
    supplySetpointOperatorC?: number;
    supplySetpointCalcC?: number;
    extractTempC?: number;
    supplyTempC?: number;
  },
): number | null {
  if (seriesId === "supply_setpoint_operator") {
    return finiteOrNull(observed.supplySetpointOperatorC);
  }
  const key = LIVE_OBSERVED_BY_SERIES[seriesId];
  if (!key) return null;
  if (key === "extractTempC" || key === "supplyTempC") {
    return finiteOrNull(observed[key]);
  }
  return finiteOrNull(observed[key]);
}

function resolveLiveControlVectors(
  replayStep: MpcReplayStep | null,
  liveControl?: LiveControlContext,
): {
  typicalBms: MpcControlVector | null;
  mpc: MpcControlVector | null;
  deltaCostKr: number | null;
} {
  const step0 = liveControl?.forwardPlanStep0;
  if (step0) {
    return {
      typicalBms: roundVector(step0.uBmsSim),
      mpc: roundVector(liveControl?.activeCommand ?? step0.uMpc),
      deltaCostKr:
        step0.expectedDeltaCostKr != null
          ? Math.round(step0.expectedDeltaCostKr * 100) / 100
          : null,
    };
  }

  return {
    typicalBms: roundVector(replayStep?.uBmsSim ?? null),
    mpc: roundVector(replayStep?.uMpc ?? null),
    deltaCostKr:
      replayStep != null
        ? Math.round((replayStep.costMpcKr - replayStep.costBaselineKr) * 100) / 100
        : null,
  };
}

function liveReferenceStep(
  stepIso: string,
  replayStep: MpcReplayStep | null,
  liveControl?: LiveControlContext,
): MpcReplayStep | null {
  const step0 = liveControl?.forwardPlanStep0;
  if (!step0) return replayStep;

  const uMpc = liveControl?.activeCommand ?? step0.uMpc;
  return {
    t: stepIso,
    uBmsMeas: replayStep?.uBmsMeas ?? null,
    uBmsSim: step0.uBmsSim,
    uMpc,
    deltaU: replayStep?.deltaU ?? uMpc,
    extractTempMeasC: replayStep?.extractTempMeasC ?? null,
    extractTempPredC: step0.predictedExtractC,
    outdoorTempC: step0.outdoorTempC,
    electricKw: replayStep?.electricKw ?? 0,
    heatKw: replayStep?.heatKw ?? 0,
    costBaselineKr: replayStep?.costBaselineKr ?? 0,
    costEmulatedKr: replayStep?.costEmulatedKr ?? 0,
    costMpcKr: replayStep?.costMpcKr ?? 0,
    marginalKrPerKwh: replayStep?.marginalKrPerKwh ?? null,
    comfortViolation: replayStep?.comfortViolation ?? false,
    usedFallback: step0.usedFallback ?? false,
  };
}

function patchComparisonAtStep(
  comparison: MpcSignalComparison,
  stepIso: string,
  observed: Partial<MpcControlVector> & {
    extractTempC?: number;
    supplyTempC?: number;
    supplySetpointCalcC?: number;
  },
  replayStep: MpcReplayStep | null,
  liveControl?: LiveControlContext,
): MpcSignalComparison {
  const refStep = liveReferenceStep(stepIso, replayStep, liveControl);
  const liveVectors = resolveLiveControlVectors(replayStep, liveControl);

  const series = comparison.series.map((s) => {
    if (s.id === "cost_kr") return s;
    const pick = MPC_COMPARISON_SERIES.find((p) => p.id === s.id);
    const obsFromLive = observedForSeries(s.id, observed);
    if (obsFromLive == null && refStep == null) return s;

    const emulated =
      refStep && pick?.pickEmulated
        ? finiteOrNull(pick.pickEmulated(refStep))
        : null;
    const mpc =
      refStep && pick?.pickMpc
        ? finiteOrNull(pick.pickMpc(refStep))
        : refStep && pick?.pickEmulated
          ? finiteOrNull(pick.pickEmulated(refStep))
          : null;
    const reference =
      s.id === "supply_setpoint_operator"
        ? finiteOrNull(observed.supplySetpointCalcC)
        : refStep && pick?.pickReference
          ? finiteOrNull(pick.pickReference(refStep))
          : null;

    const points = [...s.points];
    const idx = points.findIndex((p) => p.hour === stepIso);
    const unit = s.unit;
    const nextPoint = {
      hour: stepIso,
      observed: roundControlComparisonValue(obsFromLive, unit),
      emulated: roundControlComparisonValue(emulated, unit),
      mpc: roundControlComparisonValue(mpc, unit),
      reference: roundControlComparisonValue(reference, unit),
      deltaCostKr: roundControlComparisonValue(liveVectors.deltaCostKr, "kr"),
    };
    if (idx >= 0) points[idx] = { ...points[idx], ...nextPoint };
    else {
      points.push(nextPoint);
      points.sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime());
    }

    return { ...s, points };
  });

  return { ...comparison, series };
}

function appendMissingLiveSetpointSeries(
  comparison: MpcSignalComparison,
  stepIso: string,
  observed: Partial<MpcControlVector> & {
    supplySetpointOperatorC?: number;
    supplySetpointCalcC?: number;
  },
  deltaCostKr: number | null,
): MpcSignalComparison {
  const operatorPick = MPC_COMPARISON_BMS_SETPOINT_SERIES[0];
  if (!operatorPick || comparison.series.some((s) => s.id === operatorPick.id)) {
    return comparison;
  }
  if (observed.supplySetpointOperatorC == null) return comparison;

  const point = {
    hour: stepIso,
    observed: observed.supplySetpointOperatorC,
    emulated: null,
    mpc: null,
    reference: observed.supplySetpointCalcC ?? null,
    deltaCostKr,
  };

  return {
    ...comparison,
    series: [
      ...comparison.series,
      {
        id: operatorPick.id,
        label: operatorPick.label,
        tabLabel: operatorPick.tabLabel,
        unit: operatorPick.unit,
        chartVariant: operatorPick.chartVariant,
        referenceLabel: operatorPick.referenceLabel,
        points: [point],
        summary: {
          sampleHours: 1,
          meanAbsErrorObservedVsMpc: null,
          meanAbsErrorObservedVsEmulated: null,
          meanAbsErrorMpcVsEmulated: null,
          hoursWithMpcDeviation: 0,
          stepsWithMpcVsEmulatedDelta: 0,
        },
      },
    ],
  };
}

function roundVector(
  vector: import("@/lib/sd-anlegg/mpc/shared/types").MpcControlVector | null,
): import("@/lib/sd-anlegg/mpc/shared/types").MpcControlVector | null {
  if (!vector) return null;
  return {
    supplySetpointC: round1(vector.supplySetpointC),
    supplyFanPct: round1(vector.supplyFanPct),
    exhaustFanPct: round1(vector.exhaustFanPct),
    heatingValvePct: round1(vector.heatingValvePct),
    coolingValvePct: round1(vector.coolingValvePct),
    districtTr002ValvePct: round1(vector.districtTr002ValvePct),
    districtTr003ValvePct: round1(vector.districtTr003ValvePct),
  };
}

function observedForDeviation(
  observed: Partial<MpcControlVector> & { supplySetpointOperatorC?: number },
): Partial<MpcControlVector> {
  return {
    ...observed,
    supplySetpointC:
      observed.supplySetpointOperatorC ?? observed.supplySetpointC,
  };
}

function buildLiveSnapshot(
  stepIso: string,
  sampledAt: string,
  observed: Partial<MpcControlVector> & {
    supplySetpointOperatorC?: number;
  },
  replayStep: MpcReplayStep | null,
  liveControl?: LiveControlContext,
): MpcLiveStepSnapshot {
  const { typicalBms, mpc, deltaCostKr } = resolveLiveControlVectors(
    replayStep,
    liveControl,
  );

  const observedCompare = observedForDeviation(observed);
  const parsed = parseMpcStepKey(stepIso);
  const operatingProfile =
    liveControl?.operatingProfile ?? NAERBYEN_OFFICE_OPERATING_PROFILE;
  const occupancy = resolveOccupancyForStep(
    {
      t: stepIso,
      hourLocal: parsed.hourLocal,
      uMeas: observedCompare as MpcControlVector,
    },
    operatingProfile,
    liveControl?.occupancyCalibration,
  );
  const comfortBand = resolveComfortBandForStepWithOccupancy(
    { t: stepIso, hourLocal: parsed.hourLocal },
    NAERBYEN_OFFICE_COMFORT_SCHEDULE,
    { min: 18, max: 24 },
    occupancy.q,
  );

  const primaryObs =
    observedCompare.supplySetpointC ?? observedCompare.supplyFanPct;
  const primaryMpc = mpc?.supplySetpointC ?? mpc?.supplyFanPct;
  const hasMpcDeviation =
    primaryObs != null &&
    primaryMpc != null &&
    Math.abs(primaryMpc - primaryObs) > DEVIATION_EPS;

  return {
    stepAt: stepIso,
    sampledAt,
    observed,
    typicalBms,
    mpc,
    deltaCostKr,
    occupancyQ: occupancy.q,
    occupancyLabel: occupancyContextLabel({ t: stepIso }, occupancy.q),
    comfortBandMinC: comfortBand.min,
    comfortBandMaxC: comfortBand.max,
    hasMpcDeviation,
    isLive: true,
  };
}

export function mergeLiveMpcSignalComparison(input: {
  comparison: MpcSignalComparison;
  livePoints: readonly InfraspawnPointListItem[] | undefined;
  liveSampledAt: string | null;
  replaySteps: readonly MpcReplayStep[];
  liveControl?: LiveControlContext;
}): {
  comparison: MpcSignalComparison;
  liveSnapshot: MpcLiveStepSnapshot | null;
} {
  if (!input.livePoints?.length || !input.liveSampledAt) {
    return { comparison: input.comparison, liveSnapshot: null };
  }

  const sampledMs = new Date(input.liveSampledAt).getTime();
  if (Number.isNaN(sampledMs)) {
    return { comparison: input.comparison, liveSnapshot: null };
  }

  const stepIso = mpcStepKeyFromMs(sampledMs);
  const observed = liveVectorFromPoints(input.livePoints);
  if (Object.keys(observed).length === 0) {
    return { comparison: input.comparison, liveSnapshot: null };
  }

  const replayStep = findReplayStepForKey(input.replaySteps, stepIso);
  const liveVectors = resolveLiveControlVectors(replayStep, input.liveControl);
  let comparison = patchComparisonAtStep(
    input.comparison,
    stepIso,
    observed,
    replayStep,
    input.liveControl,
  );
  comparison = appendMissingLiveSetpointSeries(
    comparison,
    stepIso,
    observed,
    liveVectors.deltaCostKr,
  );
  const liveSnapshot = buildLiveSnapshot(
    stepIso,
    input.liveSampledAt,
    observed,
    replayStep,
    input.liveControl,
  );

  return { comparison, liveSnapshot };
}
