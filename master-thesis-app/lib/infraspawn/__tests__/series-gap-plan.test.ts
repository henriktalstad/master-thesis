import { describe, expect, test } from "bun:test";
import { SERIES_GAP_BUCKET_MS } from "@/lib/infraspawn/detect-series-gaps";
import { collectMergedMirrorGaps } from "@/lib/infraspawn/series-gap-plan";

describe("collectMergedMirrorGaps", () => {
  test("slår sammen hull fra flere objectIds", () => {
    const sinceMs = 0;
    const untilMs = 10 * SERIES_GAP_BUCKET_MS;
    const samplesByObjectId = new Map([
      [
        "a",
        [{ t: new Date(SERIES_GAP_BUCKET_MS).toISOString() }],
      ],
      [
        "b",
        [{ t: new Date(7 * SERIES_GAP_BUCKET_MS).toISOString() }],
      ],
    ]);

    const gaps = collectMergedMirrorGaps({
      samplesByObjectId,
      sinceMs,
      untilMs,
      minGapBuckets: 4,
    });

    expect(gaps.length).toBeGreaterThan(0);
  });
});
