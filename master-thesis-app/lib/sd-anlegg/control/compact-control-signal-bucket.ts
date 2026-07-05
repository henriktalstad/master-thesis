import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { stepKeyFromMs } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import {
  compactControlSignalHour,
  type CompactControlSignalHourPayload,
  expandControlSignalHourToReplayStep,
} from "./compact-control-signal-hour";
import type { MaterializedControlBucketMinutes } from "./mpc-execution-mode";

export type { CompactControlSignalHourPayload };

export type AggregatedControlSignalBucket = {
  bucketAt: string;
  bucketMinutes: MaterializedControlBucketMinutes;
  payload: CompactControlSignalHourPayload;
};

function bucketKeyFromIso(iso: string, bucketMinutes: number): string {
  return stepKeyFromMs(new Date(iso).getTime(), bucketMinutes);
}

/** Aggreger canonical replay-steg til valgfri bucket-oppløsning. */
export function aggregateReplayStepsToControlBuckets(
  steps: readonly MpcReplayStep[],
  bucketMinutes: MaterializedControlBucketMinutes,
): AggregatedControlSignalBucket[] {
  const buckets = new Map<string, MpcReplayStep[]>();
  for (const step of steps) {
    const key = bucketKeyFromIso(step.t, bucketMinutes);
    const list = buckets.get(key) ?? [];
    list.push(step);
    buckets.set(key, list);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketAt, bucket]) => {
      const payload = compactControlSignalHour({
        observed: avgVector(bucket.map((s) => s.uBmsMeas ?? null)),
        emulated: avgVector(bucket.map((s) => s.uBmsSim)) ?? bucket[0]!.uBmsSim,
        mpc: avgVector(bucket.map((s) => s.uMpc)) ?? bucket[0]!.uMpc,
        demand: avgVector(bucket.map((s) => s.uDemand ?? null)),
        stepCount: bucket.length,
      });
      return { bucketAt, bucketMinutes, payload };
    });
}

function avgVector(
  vectors: Array<MpcControlVector | null | undefined>,
): MpcControlVector | null {
  const finite = vectors.filter((v): v is MpcControlVector => v != null);
  if (finite.length === 0) return null;
  const keys = [
    "supplySetpointC",
    "supplyFanPct",
    "exhaustFanPct",
    "heatingValvePct",
    "coolingValvePct",
    "districtTr002ValvePct",
    "districtTr003ValvePct",
  ] as const;
  const out = {} as MpcControlVector;
  for (const key of keys) {
    const values = finite.map((v) => v[key]).filter(Number.isFinite);
    out[key] =
      values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : 0;
  }
  return out;
}

export function expandControlSignalBucketToReplayStep(
  bucketAt: string,
  payload: CompactControlSignalHourPayload,
): MpcReplayStep {
  return expandControlSignalHourToReplayStep(bucketAt, payload);
}
