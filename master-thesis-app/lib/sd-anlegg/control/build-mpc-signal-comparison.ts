import { controlHourKeyFromIso } from "./control-time-buckets";
import { sumReplayDeltaCostKr, sumReplayDeltaCostVsEmulatedKr } from "./build-mpc-replay-profiles";
import type { MpcSignalComparison, MpcSignalComparisonSeries } from "./control-types";
import {
  controlComparisonDeviation,
  isControlComparisonDeviation,
  roundControlComparisonValue,
} from "./control-comparison-precision";
import {
  MPC_COMPARISON_SERIES,
  type MpcComparisonSeriesPick,
} from "./mpc-signal-series-registry";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function normalizeScalar(
  value: number | null | undefined,
  unit: string,
): number | null {
  const finite = finiteOrNull(value);
  if (finite == null) return null;
  return roundControlComparisonValue(finite, unit);
}

function avg(values: number[], unit: string): number | null {
  return values.length > 0
    ? normalizeScalar(
        values.reduce((a, b) => a + b, 0) / values.length,
        unit,
      )
    : null;
}

function aggregateTriple(
  bucket: readonly MpcReplayStep[],
  pick: MpcComparisonSeriesPick,
): {
  observed: number | null;
  emulated: number | null;
  mpc: number | null;
  reference: number | null;
} {
  const unit = pick.unit;
  const observed: number[] = [];
  const emulated: number[] = [];
  const mpc: number[] = [];
  const reference: number[] = [];

  for (const step of bucket) {
    const o = finiteOrNull(pick.pickObserved(step));
    const e = finiteOrNull(pick.pickEmulated?.(step));
    const m = finiteOrNull(pick.pickMpc?.(step));
    const r = finiteOrNull(pick.pickReference?.(step));
    if (o != null) observed.push(o);
    if (e != null) emulated.push(e);
    if (m != null) mpc.push(m);
    if (r != null) reference.push(r);
  }

  return {
    observed: avg(observed, unit),
    emulated: avg(emulated, unit),
    mpc: avg(mpc, unit),
    reference: avg(reference, unit),
  };
}

function bucketStepsByHour(
  steps: readonly MpcReplayStep[],
): Map<string, MpcReplayStep[]> {
  const buckets = new Map<string, MpcReplayStep[]>();
  for (const step of steps) {
    const key = controlHourKeyFromIso(step.t);
    const list = buckets.get(key) ?? [];
    list.push(step);
    buckets.set(key, list);
  }
  return buckets;
}

function summarizePoints(
  points: MpcSignalComparisonSeries["points"],
  unit: string,
): MpcSignalComparisonSeries["summary"] {
  const mpcErrors: number[] = [];
  const emulatorErrors: number[] = [];
  const mpcVsEmulatedErrors: number[] = [];
  let hoursWithMpcDeviation = 0;
  let stepsWithMpcVsEmulatedDelta = 0;

  for (const point of points) {
    const sdMpc = controlComparisonDeviation(point.observed, point.mpc, unit);
    if (sdMpc != null) {
      mpcErrors.push(sdMpc);
      if (isControlComparisonDeviation(point.observed, point.mpc, unit)) {
        hoursWithMpcDeviation += 1;
      }
    }
    const sdEmu = controlComparisonDeviation(point.observed, point.emulated, unit);
    if (sdEmu != null) emulatorErrors.push(sdEmu);
    const mpcEmu = controlComparisonDeviation(point.mpc, point.emulated, unit);
    if (mpcEmu != null) {
      mpcVsEmulatedErrors.push(mpcEmu);
      if (isControlComparisonDeviation(point.mpc, point.emulated, unit)) {
        stepsWithMpcVsEmulatedDelta += 1;
      }
    }
  }

  const mean = (values: number[]) =>
    values.length > 0
      ? normalizeScalar(
          values.reduce((a, b) => a + b, 0) / values.length,
          unit,
        )
      : null;

  return {
    sampleHours: points.filter(
      (p) => p.observed != null || p.emulated != null || p.mpc != null,
    ).length,
    meanAbsErrorObservedVsMpc: mean(mpcErrors),
    meanAbsErrorObservedVsEmulated: mean(emulatorErrors),
    meanAbsErrorMpcVsEmulated: mean(mpcVsEmulatedErrors),
    hoursWithMpcDeviation,
    stepsWithMpcVsEmulatedDelta,
  };
}

function hasSeriesData(point: {
  observed: number | null;
  emulated: number | null;
  mpc: number | null;
}): boolean {
  return point.observed != null || point.emulated != null || point.mpc != null;
}

function buildSeries(
  pick: MpcComparisonSeriesPick,
  steps: readonly MpcReplayStep[],
  resolution: "step" | "hour",
): MpcSignalComparisonSeries | null {
  if (resolution === "step") {
    const points = steps
      .map((step) => ({
        hour: step.t,
        observed: normalizeScalar(pick.pickObserved(step), pick.unit),
        emulated: normalizeScalar(pick.pickEmulated?.(step), pick.unit),
        mpc: normalizeScalar(pick.pickMpc?.(step), pick.unit),
        reference: normalizeScalar(pick.pickReference?.(step), pick.unit),
        deltaCostKr:
          pick.requireObservedAndMpc && step.uBmsMeas != null
            ? normalizeScalar(step.costMpcKr - step.costBaselineKr, "kr")
            : null,
      }))
      .filter((point) =>
        pick.requireObservedAndMpc
          ? point.observed != null && point.mpc != null
          : hasSeriesData(point),
      );

    if (points.length === 0) return null;
    return {
      id: pick.id,
      label: pick.label,
      tabLabel: pick.tabLabel,
      unit: pick.unit,
      chartVariant: pick.chartVariant,
      referenceLabel: pick.referenceLabel,
      points,
      summary: summarizePoints(points, pick.unit),
    };
  }

  const points = Array.from(bucketStepsByHour(steps).entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hourKey, bucket]) => ({
      hour: `${hourKey}:00:00.000Z`,
      ...aggregateTriple(bucket, pick),
    }));

  if (!points.some(hasSeriesData)) return null;

  return {
    id: pick.id,
    label: pick.label,
    tabLabel: pick.tabLabel,
    unit: pick.unit,
    chartVariant: pick.chartVariant,
    referenceLabel: pick.referenceLabel,
    points,
    summary: summarizePoints(points, pick.unit),
  };
}

function buildCostKrHourSeries(
  steps: readonly MpcReplayStep[],
): MpcSignalComparisonSeries | null {
  const buckets = new Map<
    string,
    { observed: number; emulated: number; mpc: number; delta: number }
  >();

  for (const step of steps) {
    const hourKey = controlHourKeyFromIso(step.t);
    const bucket = buckets.get(hourKey) ?? {
      observed: 0,
      emulated: 0,
      mpc: 0,
      delta: 0,
    };
    bucket.observed += step.costBaselineKr;
    bucket.emulated += step.costEmulatedKr ?? step.costBaselineKr;
    bucket.mpc += step.costMpcKr;
    bucket.delta += step.costMpcKr - (step.costEmulatedKr ?? step.costBaselineKr);
    buckets.set(hourKey, bucket);
  }

  const points = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hourKey, bucket]) => ({
      hour: `${hourKey}:00:00.000Z`,
      observed: Math.round(bucket.observed * 100) / 100,
      emulated: Math.round(bucket.emulated * 100) / 100,
      mpc: Math.round(bucket.mpc * 100) / 100,
      deltaCostKr: Math.round(bucket.delta * 100) / 100,
    }));

  if (points.length === 0) return null;

  return {
    id: "cost_kr",
    label: "Estimert kost",
    tabLabel: "Kost",
    unit: "kr",
    points,
    summary: {
      sampleHours: points.length,
      meanAbsErrorObservedVsMpc: null,
      meanAbsErrorObservedVsEmulated: null,
      meanAbsErrorMpcVsEmulated: null,
      hoursWithMpcDeviation: points.filter((p) =>
        isControlComparisonDeviation(p.mpc, p.emulated, "kr"),
      ).length,
      stepsWithMpcVsEmulatedDelta: points.filter((p) =>
        isControlComparisonDeviation(p.mpc, p.emulated, "kr"),
      ).length,
    },
  };
}

export function buildMpcSignalComparison(
  steps: readonly MpcReplayStep[],
  options?: {
    resolution?: "step" | "hour";
    stepMinutes?: 1 | 5 | 15 | 60;
  },
): MpcSignalComparison {
  const resolution = options?.resolution ?? "hour";
  const stepMinutes =
    options?.stepMinutes ?? (resolution === "step" ? 15 : 60);

  const series = MPC_COMPARISON_SERIES.map((pick) =>
    buildSeries(pick, steps, resolution),
  ).filter((s): s is MpcSignalComparisonSeries => s != null);

  const costSeries = buildCostKrHourSeries(steps);
  if (costSeries) series.push(costSeries);

  return {
    stepCount: steps.length,
    stepMinutes,
    series,
    defaultSeriesId: series.find((s) => s.id === "supply_fan_mpc")?.id ?? series[0]?.id ?? null,
    totalDeltaCostKr: sumReplayDeltaCostVsEmulatedKr(steps),
    totalDeltaCostVsObservedKr: sumReplayDeltaCostKr(steps),
  };
}
