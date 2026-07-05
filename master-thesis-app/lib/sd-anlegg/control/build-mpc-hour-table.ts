import { controlHourKeyFromIso } from "./control-time-buckets";
import type { MpcHourTableRow, MpcSignalComparison } from "./control-types";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function buildMpcHourTable(
  replaySteps: readonly MpcReplayStep[],
): MpcHourTableRow[] {
  const buckets = new Map<
    string,
    {
      observedCostKr: number;
      emulatedCostKr: number;
      mpcCostKr: number;
      count: number;
    }
  >();

  for (const step of replaySteps) {
    const hourKey = controlHourKeyFromIso(step.t);
    const bucket = buckets.get(hourKey) ?? {
      observedCostKr: 0,
      emulatedCostKr: 0,
      mpcCostKr: 0,
      count: 0,
    };
    bucket.observedCostKr += step.costBaselineKr;
    bucket.emulatedCostKr += step.costEmulatedKr ?? step.costBaselineKr;
    bucket.mpcCostKr += step.costMpcKr;
    bucket.count += 1;
    buckets.set(hourKey, bucket);
  }

  return [...buckets.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([hourKey, agg]) => {
      const hour = new Date(`${hourKey}:00:00.000Z`).toISOString();
      const deltaCostKr = round2(agg.mpcCostKr - agg.emulatedCostKr);
      return {
        hour,
        observedCostKr: round2(agg.observedCostKr),
        emulatedCostKr: round2(agg.emulatedCostKr),
        mpcCostKr: round2(agg.mpcCostKr),
        deltaCostKr,
      };
    });
}

/** Timevis kost fra signalComparison (uten full replaySteps JSON). */
export function buildMpcHourTableFromComparison(
  comparison: MpcSignalComparison | null,
): MpcHourTableRow[] {
  if (!comparison?.series.length) return [];

  const costSeries = comparison.series.find((s) => s.id === "cost_kr");
  const source = costSeries ?? comparison.series[0];
  if (!source) return [];

  return source.points
    .filter((p) => p.deltaCostKr != null)
    .map((p) => ({
      hour: p.hour,
      observedCostKr: round2(p.observed ?? 0),
      emulatedCostKr: round2(p.emulated ?? p.observed ?? 0),
      mpcCostKr: round2(p.mpc ?? 0),
      deltaCostKr: round2(p.deltaCostKr ?? 0),
    }));
}
