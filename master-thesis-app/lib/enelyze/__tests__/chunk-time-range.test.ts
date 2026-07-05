import { describe, expect, test } from "bun:test";
import { generateEnelyzeIntervals } from "@/lib/enelyze/chunk-time-range";

describe("generateEnelyzeIntervals", () => {
  test("2-dagers vindu gir ett intervall", () => {
    const start = new Date("2026-06-29T22:00:00.000Z");
    const endExclusive = new Date("2026-07-01T22:00:00.000Z");
    const intervals = generateEnelyzeIntervals(start, endExclusive);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.start.toISOString()).toBe(start.toISOString());
  });

  test("90 dager deles i intervaller på maks 31 dager", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const endExclusive = new Date("2026-04-01T00:00:00.000Z");
    const intervals = generateEnelyzeIntervals(start, endExclusive, 31);
    expect(intervals.length).toBeGreaterThan(1);
    for (const interval of intervals) {
      const spanMs = interval.end.getTime() - interval.start.getTime();
      expect(spanMs).toBeLessThanOrEqual(31 * 24 * 60 * 60 * 1000);
    }
  });

  test("tomt vindu når start >= end", () => {
    const d = new Date("2026-06-01T00:00:00.000Z");
    expect(generateEnelyzeIntervals(d, d)).toEqual([]);
  });
});
