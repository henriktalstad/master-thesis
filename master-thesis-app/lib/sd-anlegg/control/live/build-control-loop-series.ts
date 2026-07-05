import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { deltaControlVectors } from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import {
  isControlComparisonDeviation,
  roundControlComparisonValue,
} from "../control-comparison-precision";
import { CONTROL_DISPLAY, CONTROL_VECTOR_UI_LABELS } from "../control-display-labels";
import type { MpcSignalComparisonSeries } from "../control-types-mpc";

export type ControlLoopSeriesPoint = {
  t: string;
  label: string;
  observed: number | null;
  emulated: number | null;
  demand: number | null;
  mpc: number | null;
  costObservedKr: number | null;
  costDemandKr: number | null;
  costMpcKr: number | null;
};

export type ControlLoopSeries = {
  id: keyof MpcControlVector;
  label: string;
  unit: string;
  points: ControlLoopSeriesPoint[];
};

const SERIES_SPECS: Array<{
  id: keyof MpcControlVector;
  label: string;
  unit: string;
}> = [
  { id: "supplySetpointC", label: CONTROL_VECTOR_UI_LABELS.supplySetpointC, unit: "°C" },
  { id: "supplyFanPct", label: CONTROL_VECTOR_UI_LABELS.supplyFanPct, unit: "%" },
  { id: "exhaustFanPct", label: CONTROL_VECTOR_UI_LABELS.exhaustFanPct, unit: "%" },
  { id: "heatingValvePct", label: CONTROL_VECTOR_UI_LABELS.heatingValvePct, unit: "%" },
  { id: "coolingValvePct", label: CONTROL_VECTOR_UI_LABELS.coolingValvePct, unit: "%" },
];

const FAN_OFF_THRESHOLD_PCT = 5;
const MPC_FAN_CORRUPT_MIN_PCT = 20;

/**
 * Eldre loop-steg kan ha uMpc fra eval-seed (vifte ~68 %) mens målt/emulert er av.
 * Klamp til emulert BMS for visning til DB er oppdatert etter initial-control-fix.
 */
export function sanitizeControlLoopStep(step: MpcReplayStep): MpcReplayStep {
  const meas = step.uBmsMeas;
  const sim = step.uBmsSim;
  const uMpc = { ...step.uMpc };
  let changed = false;

  for (const key of ["supplyFanPct", "exhaustFanPct"] as const) {
    const measV = meas?.[key] ?? 0;
    const simV = sim[key] ?? 0;
    const mpcV = uMpc[key] ?? 0;
    if (
      mpcV >= MPC_FAN_CORRUPT_MIN_PCT &&
      measV < FAN_OFF_THRESHOLD_PCT &&
      simV < FAN_OFF_THRESHOLD_PCT
    ) {
      uMpc[key] = simV;
      changed = true;
    }
  }

  if (!changed) return step;
  return {
    ...step,
    uMpc,
    deltaU: deltaControlVectors(uMpc, sim),
  };
}

function formatStepLabel(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function observedValueForSeries(
  step: MpcReplayStep,
  field: keyof MpcControlVector,
): number | null | undefined {
  if (field === "supplySetpointC") {
    return (
      step.supplySetpointOperatorC ??
      step.uBmsMeas?.supplySetpointC ??
      null
    );
  }
  if (field === "coolingValvePct") {
    return (
      step.uBmsMeas?.coolingValvePct ??
      step.coolingValveCommandPct ??
      null
    );
  }
  return step.uBmsMeas?.[field];
}

export function buildControlLoopSeries(
  steps: readonly MpcReplayStep[],
): ControlLoopSeries[] {
  if (steps.length === 0) return [];

  const sanitized = steps.map(sanitizeControlLoopStep);

  return SERIES_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    unit: spec.unit,
    points: sanitized.map((step) => ({
      t: step.t,
      label: formatStepLabel(step.t),
      observed: roundControlComparisonValue(
        observedValueForSeries(step, spec.id),
        spec.unit,
      ),
      emulated: roundControlComparisonValue(step.uBmsSim[spec.id] ?? null, spec.unit),
      demand: roundControlComparisonValue(step.uDemand?.[spec.id] ?? null, spec.unit),
      mpc: roundControlComparisonValue(step.uMpc[spec.id] ?? null, spec.unit),
      costObservedKr: step.costBaselineKr ?? null,
      costDemandKr: step.costDemandKr ?? null,
      costMpcKr: step.costMpcKr ?? null,
    })),
  }));
}

export const CONTROL_LOOP_SERIES_LEGEND = {
  observed: CONTROL_DISPLAY.observed.chart,
  emulated: CONTROL_DISPLAY.predicted.chart,
  demand: CONTROL_DISPLAY.demand.chart,
  mpc: CONTROL_DISPLAY.simulatedControl.chart,
} as const;

export function controlLoopSeriesToStepTableSeries(
  series: ControlLoopSeries,
): MpcSignalComparisonSeries {
  const stepsWithMpcVsEmulatedDelta = series.points.filter((p) =>
    isControlComparisonDeviation(p.mpc, p.emulated, series.unit),
  ).length;

  return {
    id: series.id,
    label: series.label,
    tabLabel: series.label,
    unit: series.unit,
    chartVariant: "policy",
    points: series.points.map((p) => ({
      hour: p.t,
      observed: p.observed,
      emulated: p.emulated,
      mpc: p.mpc,
      deltaCostKr: p.costMpcKr,
    })),
    summary: {
      sampleHours: series.points.length,
      meanAbsErrorObservedVsMpc: null,
      meanAbsErrorObservedVsEmulated: null,
      meanAbsErrorMpcVsEmulated: null,
      hoursWithMpcDeviation: stepsWithMpcVsEmulatedDelta,
      stepsWithMpcVsEmulatedDelta,
    },
  };
}

export function countControlLoopObservedVsSimDeviations(
  series: ControlLoopSeries,
): number {
  return series.points.filter((p) =>
    isControlComparisonDeviation(p.observed, p.mpc, series.unit),
  ).length;
}
