import { describe, expect, test } from "bun:test";
import {
  aggregateHourlyToDaily,
  aggregateQuarterHourlyToHourly,
  slotFromInstant,
  type QuarterHourlyPricePoint,
} from "./derive-energy-price-aggregates";

describe("derive-energy-price-aggregates", () => {
  test("slotFromInstant deler UTC-time i kvartaler", () => {
    const d = new Date("2026-01-15T14:37:00.000Z");
    expect(slotFromInstant(d)).toEqual({
      dateUtc: new Date("2026-01-15T00:00:00.000Z"),
      hour: 14,
      quarter: 2,
    });
  });

  test("aggregateQuarterHourlyToHourly tar aritmetisk snitt", () => {
    const base = {
      area: "NO3",
      areaCode: "NO3",
      date: "2026-01-15T10:00:00.000Z",
    };
    const quarters: QuarterHourlyPricePoint[] = [0, 1, 2, 3].map((quarter) => ({
      ...base,
      date: `2026-01-15T10:${String(quarter * 15).padStart(2, "0")}:00.000Z`,
      hour: 10,
      quarter,
      price: 1 + quarter * 0.1,
    }));

    const hourly = aggregateQuarterHourlyToHourly(quarters);
    expect(hourly).toHaveLength(1);
    expect(hourly[0]!.price).toBeCloseTo(1.15, 4);
  });

  test("aggregateHourlyToDaily gir dagsgjennomsnitt", () => {
    const hourly = [
      {
        date: "2026-01-15T08:00:00.000Z",
        price: 1,
        area: "NO3",
        areaCode: "NO3",
      },
      {
        date: "2026-01-15T09:00:00.000Z",
        price: 3,
        area: "NO3",
        areaCode: "NO3",
      },
    ];
    const daily = aggregateHourlyToDaily(hourly, new Date("2026-01-15T00:00:00.000Z"));
    expect(daily?.price).toBeGreaterThan(0);
    expect(daily?.areaCode).toBe("NO3");
  });
});
