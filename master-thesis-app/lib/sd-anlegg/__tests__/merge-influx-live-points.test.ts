import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { mergeInfluxLiveIntoPoints } from "@/lib/infraspawn/merge-influx-live-into-points";

function point(
  objectId: string,
  lastValue: number | null,
  lastSampledAt: string | null,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Test",
    objectId,
    objectName: objectId,
    description: null,
    unit: null,
    lastValue,
    lastSampledAt,
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("mergeInfluxLiveIntoPoints", () => {
  const now = new Date("2026-06-20T12:05:00.000Z");

  test("fersk Influx-overlay merkes influx-live", () => {
    const base = point("a", 10, "2026-06-20T12:00:00.000Z");
    const merged = mergeInfluxLiveIntoPoints(
      [base],
      new Map([
        [
          "src-1:a",
          { value: 42, sampledAt: "2026-06-20T12:04:00.000Z" },
        ],
      ]),
      now,
    );

    expect(merged[0]?.lastValue).toBe(42);
    expect(merged[0]?.valueSource).toBe("influx-live");
  });

  test("uten Influx-rad beholdes baseline", () => {
    const base = point("a", 10, "2026-06-20T12:00:00.000Z");
    const merged = mergeInfluxLiveIntoPoints([base], new Map(), now);

    expect(merged[0]?.lastValue).toBe(10);
    expect(merged[0]?.valueSource).toBe("postgres-sync");
  });

  test("gammel Influx-rad merkes influx-stale", () => {
    const base = point("a", 10, "2026-06-20T12:00:00.000Z");
    const merged = mergeInfluxLiveIntoPoints(
      [base],
      new Map([
        [
          "src-1:a",
          { value: 99, sampledAt: "2026-06-20T11:00:00.000Z" },
        ],
      ]),
      now,
    );

    expect(merged[0]?.lastValue).toBe(99);
    expect(merged[0]?.valueSource).toBe("influx-stale");
  });
});
