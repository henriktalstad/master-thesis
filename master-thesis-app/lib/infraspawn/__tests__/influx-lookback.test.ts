import { describe, expect, test } from "bun:test";
import {
  clipRangeToInfluxLookback,
  resolveInfluxMaxLookbackHours,
} from "@/lib/infraspawn/influx-lookback";

describe("influx-lookback", () => {
  test("default er 48 timer", () => {
    expect(resolveInfluxMaxLookbackHours()).toBe(48);
  });

  test("klipper start til maks lookback", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    const result = clipRangeToInfluxLookback({
      start: new Date("2026-06-16T00:00:00.000Z"),
      end: new Date("2026-06-29T00:00:00.000Z"),
      now,
    });
    expect(result.clipped).toBe(true);
    expect(result.queryable).toBe(true);
    expect(result.start.toISOString()).toBe("2026-06-27T12:00:00.000Z");
  });

  test("ikke queryable når hele vinduet er eldre enn lookback", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    const result = clipRangeToInfluxLookback({
      start: new Date("2026-06-01T00:00:00.000Z"),
      end: new Date("2026-06-20T00:00:00.000Z"),
      now,
    });
    expect(result.queryable).toBe(false);
  });
});
