import { describe, expect, test } from "bun:test";
import {
  filterMeasurementsInWindow,
  mapStatkraftMeterValues,
  parseStatkraftTimestamp,
} from "@/lib/statkraft/parse-values";
import { STATKRAFT_DEFAULT_QUANTITIES } from "@/lib/statkraft/types";

describe("parseStatkraftTimestamp", () => {
  test("unix sekunder → ms", () => {
    expect(parseStatkraftTimestamp(1_718_000_000)).toBe(1_718_000_000_000);
  });

  test("ISO-streng", () => {
    const ms = parseStatkraftTimestamp("2026-06-24T10:00:00.000Z");
    expect(ms).toBe(Date.parse("2026-06-24T10:00:00.000Z"));
  });
});

describe("mapStatkraftMeterValues", () => {
  test("grupperer kvantiteter per timestamp", () => {
    const ts = 1_718_000_000;
    const rows = mapStatkraftMeterValues(
      [
        {
          quantity: "Energy",
          unit: "kWh",
          values: [{ when_Z: ts, value: 12.5 }],
        },
        {
          quantity: "Forward temperature",
          unit: "°C",
          values: [{ when_Z: ts, value: 70 }],
        },
      ],
      STATKRAFT_DEFAULT_QUANTITIES,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.energyKwh).toBe(12.5);
    expect(rows[0]!.forwardTempC).toBe(70);
    expect(rows[0]!.utcTime.toISOString()).toBe(
      new Date(ts * 1000).toISOString(),
    );
  });
});

describe("filterMeasurementsInWindow", () => {
  test("half-open vindu på utcTime", () => {
    const start = new Date("2026-06-29T22:00:00.000Z");
    const end = new Date("2026-07-01T22:00:00.000Z");
    const rows = mapStatkraftMeterValues(
      [
        {
          quantity: "Energy",
          unit: "kWh",
          values: [
            { when_Z: Math.floor(start.getTime() / 1000), value: 1 },
            { when_Z: Math.floor(end.getTime() / 1000), value: 2 },
          ],
        },
      ],
      STATKRAFT_DEFAULT_QUANTITIES,
    );
    const filtered = filterMeasurementsInWindow(rows, start, end);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.energyKwh).toBe(1);
  });
});
