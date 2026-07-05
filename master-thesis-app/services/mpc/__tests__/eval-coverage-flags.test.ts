import { describe, expect, test } from "bun:test";
import {
  buildEvalCoverageFlags,
  isMpcEvalSampleStale,
} from "@/services/mpc/eval-coverage-flags";

describe("buildEvalCoverageFlags", () => {
  test("needsBackfill når mpc, plant eller stale sample", () => {
    expect(
      buildEvalCoverageFlags({
        uMeasPct: 0.95,
        plantNeedsBackfill: false,
        thresholdPct: 0.9,
        latestSampleAt: "2026-07-02T14:45:00.000Z",
        evalEnd: "2026-07-02T15:00:00.000Z",
        now: new Date("2026-07-02T14:50:00.000Z"),
      }),
    ).toEqual({
      needsMpcBackfill: false,
      needsPlantBackfill: false,
      needsSampleRefresh: false,
      needsBackfill: false,
    });

    expect(
      buildEvalCoverageFlags({
        uMeasPct: 0.5,
        plantNeedsBackfill: false,
        thresholdPct: 0.9,
        evalEnd: "2026-07-02T15:00:00.000Z",
      }).needsBackfill,
    ).toBe(true);

    expect(
      buildEvalCoverageFlags({
        uMeasPct: 0.95,
        plantNeedsBackfill: true,
        thresholdPct: 0.9,
        evalEnd: "2026-07-02T15:00:00.000Z",
      }).needsBackfill,
    ).toBe(true);
  });

  test("100 % dekning men gammel prøve → needsSampleRefresh", () => {
    const flags = buildEvalCoverageFlags({
      uMeasPct: 1,
      plantNeedsBackfill: false,
      thresholdPct: 0.9,
      latestSampleAt: "2026-07-02T06:00:00.000Z",
      evalEnd: "2026-07-02T15:00:00.000Z",
      now: new Date("2026-07-02T15:00:00.000Z"),
      staleAfterHours: 6,
    });
    expect(flags.needsMpcBackfill).toBe(false);
    expect(flags.needsSampleRefresh).toBe(true);
    expect(flags.needsBackfill).toBe(true);
  });
});

describe("isMpcEvalSampleStale", () => {
  test("frosset eval-vindu: OK når siste prøve når evalEnd", () => {
    expect(
      isMpcEvalSampleStale({
        latestSampleAt: "2026-07-02T14:45:00.000Z",
        evalEnd: "2026-07-02T15:00:00.000Z",
        now: new Date("2026-07-03T10:00:00.000Z"),
      }),
    ).toBe(false);
  });

  test("frosset eval-vindu: stale når siste prøve stopper langt før evalEnd", () => {
    expect(
      isMpcEvalSampleStale({
        latestSampleAt: "2026-06-28T12:00:00.000Z",
        evalEnd: "2026-07-02T15:00:00.000Z",
        now: new Date("2026-07-03T10:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
