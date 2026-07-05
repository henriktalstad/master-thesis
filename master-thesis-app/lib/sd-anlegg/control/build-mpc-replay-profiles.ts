import { controlHourKeyFromIso } from "./control-time-buckets";
import type { ControlLoadHourPoint } from "./control-types";
import type { MpcReplayResult, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";

const STEP_HOURS = MPC_STEP_MINUTES / 60;

export type MpcReplayEffectSummary = {
  baselineCostKr: number;
  mpcCostKr: number;
  deltaCostKr: number;
  deltaCostPct: number;
  baselineKwh: number;
  mpcKwh: number;
  peakBaselineKw: number;
  peakMpcKw: number;
};

export type MpcCostTimelinePoint = {
  hour: string;
  baselineCostKr: number;
  mpcCostKr: number;
  deltaCostKr: number;
};

export type { MpcComfortPoint } from "./summarize-comfort";
export {
  buildMpcComfortSeries,
  resolveComfortBandFromSeries,
  summarizeExtractComfortMae,
} from "./summarize-comfort";

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function sumReplayDeltaCostKr(steps: readonly MpcReplayStep[]): number | null {
  const comparable = steps.filter((s) => s.uBmsMeas != null);
  if (comparable.length === 0) return null;
  return round2(
    comparable.reduce((sum, s) => sum + (s.costMpcKr - s.costBaselineKr), 0),
  );
}

/** Thesis-baseline: MPC vs emulert BMS (uBmsSim-kost). */
export function sumReplayDeltaCostVsEmulatedKr(
  steps: readonly MpcReplayStep[],
): number | null {
  if (steps.length === 0) return null;
  return round2(
    steps.reduce(
      (sum, s) => sum + (s.costMpcKr - (s.costEmulatedKr ?? s.costBaselineKr)),
      0,
    ),
  );
}

function emulatedStepCostKr(step: MpcReplayStep): number {
  return step.costEmulatedKr ?? step.costBaselineKr;
}

export function buildMpcReplayEffectSummary(
  summary: MpcReplayResult["summary"] | null,
  steps: readonly MpcReplayStep[],
): MpcReplayEffectSummary | null {
  if (summary) {
    const emulatedCost =
      summary.totalCostEmulatedKr ?? summary.totalCostBaselineKr;
    return {
      baselineCostKr: emulatedCost,
      mpcCostKr: summary.totalCostMpcKr,
      deltaCostKr: summary.deltaCostVsEmulatedKr ?? summary.deltaCostKr,
      deltaCostPct: summary.deltaCostVsEmulatedPct ?? summary.deltaCostPct,
      baselineKwh: summary.controllableElectricKwhBaseline + summary.controllableHeatKwhBaseline,
      mpcKwh: summary.controllableElectricKwhMpc + summary.controllableHeatKwhMpc,
      peakBaselineKw: summary.peakElectricKwBaseline,
      peakMpcKw: summary.peakElectricKwMpc,
    };
  }
  if (steps.length === 0) return null;
  const baselineCostKr = round2(
    steps.reduce((s, x) => s + emulatedStepCostKr(x), 0),
  );
  const mpcCostKr = round2(steps.reduce((s, x) => s + x.costMpcKr, 0));
  const deltaCostKr = round2(mpcCostKr - baselineCostKr);
  const deltaCostPct =
    baselineCostKr > 0 ? Math.round((deltaCostKr / baselineCostKr) * 1000) / 10 : 0;
  const baselineKwh = round2(
    steps.reduce((s, x) => s + x.electricKw * 0.25 + x.heatKw * 0.25, 0),
  );
  const mpcKwh = baselineKwh;
  return {
    baselineCostKr,
    mpcCostKr,
    deltaCostKr,
    deltaCostPct,
    baselineKwh,
    mpcKwh,
    peakBaselineKw: round2(Math.max(...steps.map((s) => s.electricKw), 0)),
    peakMpcKw: round2(Math.max(...steps.map((s) => s.electricKw), 0)),
  };
}

function kwFromStepCost(
  costKr: number,
  marginalKrPerKwh: number | null,
  stepMinutes = MPC_STEP_MINUTES,
): number | null {
  if (marginalKrPerKwh == null || marginalKrPerKwh <= 0) return null;
  const hours = stepMinutes / 60;
  const kwh = costKr / marginalKrPerKwh;
  return Math.round((kwh / hours) * 10) / 10;
}

function proxyElectricKw(
  proxyElKwh: number | undefined,
  fallbackKw: number | null,
): number | null {
  if (proxyElKwh != null && Number.isFinite(proxyElKwh)) {
    return Math.round((proxyElKwh / STEP_HOURS) * 10) / 10;
  }
  return fallbackKw;
}

type HourLoadBucket = {
  observedKw: number[];
  emulatedKw: number[];
  mpcKw: number[];
  peakObservedKw: number;
  peakEmulatedKw: number;
  peakMpcKw: number;
  costKr: number;
  spot: number | null;
};

function emptyLoadBucket(): HourLoadBucket {
  return {
    observedKw: [],
    emulatedKw: [],
    mpcKw: [],
    peakObservedKw: 0,
    peakEmulatedKw: 0,
    peakMpcKw: 0,
    costKr: 0,
    spot: null,
  };
}

function pushPeak(bucket: HourLoadBucket, field: keyof Pick<HourLoadBucket, "peakObservedKw" | "peakEmulatedKw" | "peakMpcKw">, kw: number | null): void {
  if (kw == null || !Number.isFinite(kw) || kw <= 0) return;
  bucket[field] = Math.max(bucket[field], kw);
}

/** Timeaggregert el-effekt (kW) fra proxy — snitt for graf, maks for effekttariff. */
export function buildMpcReplayLoadProfile(
  steps: readonly MpcReplayStep[],
): ControlLoadHourPoint[] {
  const buckets = new Map<string, HourLoadBucket>();

  for (const step of steps) {
    const hourKey = controlHourKeyFromIso(step.t);
    const bucket = buckets.get(hourKey) ?? emptyLoadBucket();

    const observedKw = proxyElectricKw(
      step.proxyElKwhBaseline,
      step.uBmsMeas
        ? kwFromStepCost(step.costBaselineKr, step.marginalKrPerKwh)
        : null,
    );
    const emulatedKw = proxyElectricKw(
      step.proxyElKwhEmulated,
      kwFromStepCost(emulatedStepCostKr(step), step.marginalKrPerKwh),
    );
    const mpcKw = proxyElectricKw(
      step.proxyElKwhMpc,
      step.electricKw ?? kwFromStepCost(step.costMpcKr, step.marginalKrPerKwh),
    );

    if (observedKw != null) bucket.observedKw.push(observedKw);
    if (emulatedKw != null) bucket.emulatedKw.push(emulatedKw);
    if (mpcKw != null) bucket.mpcKw.push(mpcKw);
    pushPeak(bucket, "peakObservedKw", observedKw);
    pushPeak(bucket, "peakEmulatedKw", emulatedKw);
    pushPeak(bucket, "peakMpcKw", mpcKw);

    bucket.costKr += emulatedStepCostKr(step);
    bucket.spot = step.spotKrPerKwh ?? step.marginalKrPerKwh ?? bucket.spot;
    buckets.set(hourKey, bucket);
  }

  const avg = (values: number[]) =>
    values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null;

  return [...buckets.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([hourKey, agg]) => ({
      hour: new Date(`${hourKey}:00:00.000Z`).toISOString(),
      observedKw: avg(agg.observedKw),
      actualKw: avg(agg.emulatedKw),
      simulatedKw: avg(agg.mpcKw),
      peakObservedKw: agg.peakObservedKw > 0 ? round2(agg.peakObservedKw) : null,
      peakEmulatedKw: agg.peakEmulatedKw > 0 ? round2(agg.peakEmulatedKw) : null,
      peakMpcKw: agg.peakMpcKw > 0 ? round2(agg.peakMpcKw) : null,
      costKr: round2(agg.costKr),
      spotKrPerKwh: agg.spot,
    }));
}

export function buildMpcCostTimeline(
  steps: readonly MpcReplayStep[],
): MpcCostTimelinePoint[] {
  const buckets = new Map<string, { baseline: number; mpc: number }>();
  for (const step of steps) {
    const hourKey = controlHourKeyFromIso(step.t);
    const bucket = buckets.get(hourKey) ?? { baseline: 0, mpc: 0 };
    bucket.baseline += step.costEmulatedKr ?? step.costBaselineKr;
    bucket.mpc += step.costMpcKr;
    buckets.set(hourKey, bucket);
  }
  return [...buckets.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([hourKey, agg]) => {
      const hour = new Date(`${hourKey}:00:00.000Z`).toISOString();
      const baselineCostKr = round2(agg.baseline);
      const mpcCostKr = round2(agg.mpc);
      return {
        hour,
        baselineCostKr,
        mpcCostKr,
        deltaCostKr: round2(mpcCostKr - baselineCostKr),
      };
    });
}

export function findMpcPeakHour(loadProfile: ControlLoadHourPoint[]): string | undefined {
  let best: ControlLoadHourPoint | undefined;
  for (const point of loadProfile) {
    if (point.actualKw == null) continue;
    if (!best || point.actualKw > (best.actualKw ?? 0)) best = point;
  }
  return best?.hour;
}
