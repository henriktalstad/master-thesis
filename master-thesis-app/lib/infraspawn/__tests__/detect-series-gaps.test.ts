import { describe, expect, test } from "bun:test";
import {
  detect15mGaps,
  mergeGapRanges,
  objectHasSignificantGap,
  SERIES_GAP_BUCKET_MS,
} from "@/lib/infraspawn/detect-series-gaps";

describe("detect15mGaps", () => {
  test("finner hull midt i serien", () => {
    const sinceMs = 0;
    const untilMs = 10 * SERIES_GAP_BUCKET_MS;
    const samples = [
      { t: new Date(SERIES_GAP_BUCKET_MS).toISOString() },
      { t: new Date(7 * SERIES_GAP_BUCKET_MS).toISOString() },
    ];

    const gaps = detect15mGaps(samples, sinceMs, untilMs, 4);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some((gap) => gap.startMs >= SERIES_GAP_BUCKET_MS)).toBe(true);
  });

  test("ingen hull når serien er tett", () => {
    const sinceMs = 0;
    const untilMs = 6 * SERIES_GAP_BUCKET_MS;
    const samples = Array.from({ length: 6 }, (_, index) => ({
      t: new Date(index * SERIES_GAP_BUCKET_MS).toISOString(),
    }));

    expect(detect15mGaps(samples, sinceMs, untilMs, 4)).toEqual([]);
    expect(
      objectHasSignificantGap(samples, sinceMs, untilMs, 4),
    ).toBe(false);
  });

  test("slår sammen overlappende hull", () => {
    const merged = mergeGapRanges([
      { startMs: 0, endMs: 100, missingBuckets: 4 },
      { startMs: 80, endMs: 200, missingBuckets: 3 },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.endMs).toBe(200);
  });
});
