import { resolveInfluxMaxLookbackHours } from "@/lib/infraspawn/influx-lookback";
import {
  detect15mGaps,
  mergeGapRanges,
  objectHasSignificantGap,
  type SeriesGapRange,
} from "@/lib/infraspawn/detect-series-gaps";
import { resolveSdAnleggChartInfluxLookbackMinutes } from "@/lib/infraspawn/sd-anlegg-live-lookback";

export function clipGapToWindow(
  gap: SeriesGapRange,
  sinceMs: number,
  untilMs: number,
): SeriesGapRange | null {
  const startMs = Math.max(gap.startMs, sinceMs);
  const endMs = Math.min(gap.endMs, untilMs);
  if (endMs <= startMs) return null;
  return { ...gap, startMs, endMs };
}

export function collectClippedGapsFromSamples(
  samples: readonly { t: string }[],
  sinceMs: number,
  untilMs: number,
  minGapBuckets: number,
): SeriesGapRange[] {
  return detect15mGaps(samples, sinceMs, untilMs, minGapBuckets)
    .map((gap) => clipGapToWindow(gap, sinceMs, untilMs))
    .filter((gap): gap is SeriesGapRange => gap != null);
}

export function collectMergedMirrorGaps(input: {
  samplesByObjectId: ReadonlyMap<string, readonly { t: string }[]>;
  sinceMs: number;
  untilMs: number;
  minGapBuckets: number;
  maxGapsTotal?: number;
}): SeriesGapRange[] {
  const allGaps: SeriesGapRange[] = [];
  for (const samples of input.samplesByObjectId.values()) {
    allGaps.push(
      ...collectClippedGapsFromSamples(
        samples,
        input.sinceMs,
        input.untilMs,
        input.minGapBuckets,
      ),
    );
  }
  const maxGaps = input.maxGapsTotal ?? 12;
  return mergeGapRanges(allGaps).slice(0, maxGaps);
}

export type GapDetectionSample = {
  t: string;
  value?: number | null;
};

function samplesForGapDetection(
  samples: readonly GapDetectionSample[],
): Array<{ t: string }> {
  return samples
    .filter((sample) => sample.value != null && !Number.isNaN(sample.value))
    .map((sample) => ({ t: sample.t }));
}

export function collectPerObjectInfluxGaps(input: {
  samplesByObjectId: ReadonlyMap<string, readonly GapDetectionSample[]>;
  objectIds: readonly string[];
  sinceMs: number;
  untilMs: number;
  minGapBuckets: number;
  maxGapsPerObject?: number;
}): Map<string, SeriesGapRange[]> {
  const maxGaps = input.maxGapsPerObject ?? 8;
  const gapsByObject = new Map<string, SeriesGapRange[]>();

  for (const objectId of input.objectIds) {
    const gaps = collectClippedGapsFromSamples(
      samplesForGapDetection(
        input.samplesByObjectId.get(objectId) ?? [],
      ),
      input.sinceMs,
      input.untilMs,
      input.minGapBuckets,
    ).slice(0, maxGaps);

    if (gaps.length > 0) {
      gapsByObject.set(objectId, gaps);
    }
  }

  return gapsByObject;
}

export function seriesNeedsInfluxEnrichment(input: {
  samples: readonly { t: string }[];
  sinceMs: number;
  untilMs: number;
  staleThresholdMs: number;
  minGapBuckets: number;
}): boolean {
  const inWindow = input.samples.filter((sample) => {
    const ms = new Date(sample.t).getTime();
    return !Number.isNaN(ms) && ms >= input.sinceMs;
  });
  if (inWindow.length === 0) return true;

  const latestMs = Math.max(
    ...inWindow.map((sample) => new Date(sample.t).getTime()),
  );
  if (latestMs < input.staleThresholdMs) return true;

  return objectHasSignificantGap(
    input.samples,
    input.sinceMs,
    input.untilMs,
    input.minGapBuckets,
  );
}

export function resolveGapAwareChartInfluxLookbackMinutes(input: {
  batch: ReadonlyMap<string, { samples: readonly { t: string }[] }>;
  objectIds: readonly string[];
  hours: number;
  sinceMs: number;
  untilMs: number;
  minGapBuckets: number;
}): number {
  const maxMinutes = resolveInfluxMaxLookbackHours() * 60;
  const anyGap = input.objectIds.some((objectId) =>
    objectHasSignificantGap(
      input.batch.get(objectId)?.samples ?? [],
      input.sinceMs,
      input.untilMs,
      input.minGapBuckets,
    ),
  );

  if (anyGap) {
    return Math.min(Math.max(input.hours, 1) * 60, maxMinutes);
  }

  const mirrorByObject = new Map(
    input.objectIds.map((objectId) => [
      objectId,
      { samples: input.batch.get(objectId)?.samples ?? [] },
    ]),
  );

  return resolveSdAnleggChartInfluxLookbackMinutes({
    mirrorByObject,
    objectIds: input.objectIds,
    hours: input.hours,
    sinceMs: input.sinceMs,
  });
}
