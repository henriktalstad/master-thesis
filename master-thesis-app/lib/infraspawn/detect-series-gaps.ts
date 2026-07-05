export type SeriesGapRange = {
  startMs: number;
  endMs: number;
  missingBuckets: number;
};

export const SERIES_GAP_BUCKET_MS = 15 * 60_000;

function bucketStartMs(t: string): number | null {
  const ms = new Date(t).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / SERIES_GAP_BUCKET_MS) * SERIES_GAP_BUCKET_MS;
}

/**
 * Finner hull i 15-min serier der det mangler flere påfølgende buckets.
 */
export function detect15mGaps(
  samples: readonly { t: string }[],
  sinceMs: number,
  untilMs: number,
  minGapBuckets = 4,
): SeriesGapRange[] {
  if (untilMs <= sinceMs) return [];

  const minGapMs = minGapBuckets * SERIES_GAP_BUCKET_MS;
  const bucketSet = new Set<number>();

  for (const sample of samples) {
    const bucket = bucketStartMs(sample.t);
    if (bucket == null || bucket < sinceMs || bucket > untilMs) continue;
    bucketSet.add(bucket);
  }

  const sorted = [...bucketSet].sort((a, b) => a - b);
  const gaps: SeriesGapRange[] = [];

  if (sorted.length === 0) {
    const missingBuckets = Math.ceil((untilMs - sinceMs) / SERIES_GAP_BUCKET_MS);
    if (missingBuckets >= minGapBuckets) {
      gaps.push({ startMs: sinceMs, endMs: untilMs, missingBuckets });
    }
    return gaps;
  }

  const first = sorted[0]!;
  if (first - sinceMs >= minGapMs) {
    gaps.push({
      startMs: sinceMs,
      endMs: first,
      missingBuckets: Math.max(1, Math.floor((first - sinceMs) / SERIES_GAP_BUCKET_MS)),
    });
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const diff = curr - prev;
    if (diff >= minGapMs) {
      gaps.push({
        startMs: prev + SERIES_GAP_BUCKET_MS,
        endMs: curr,
        missingBuckets: Math.max(1, Math.floor(diff / SERIES_GAP_BUCKET_MS) - 1),
      });
    }
  }

  const last = sorted[sorted.length - 1]!;
  if (untilMs - last >= minGapMs) {
    gaps.push({
      startMs: last + SERIES_GAP_BUCKET_MS,
      endMs: untilMs,
      missingBuckets: Math.max(
        1,
        Math.floor((untilMs - last) / SERIES_GAP_BUCKET_MS) - 1,
      ),
    });
  }

  return gaps;
}

export function objectHasSignificantGap(
  samples: readonly { t: string }[],
  sinceMs: number,
  untilMs: number,
  minGapBuckets = 4,
): boolean {
  return detect15mGaps(samples, sinceMs, untilMs, minGapBuckets).length > 0;
}

export function mergeGapRanges(
  ranges: readonly SeriesGapRange[],
): SeriesGapRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.startMs - b.startMs);
  const merged: SeriesGapRange[] = [{ ...sorted[0]! }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;

    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
      last.missingBuckets += current.missingBuckets;
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}
