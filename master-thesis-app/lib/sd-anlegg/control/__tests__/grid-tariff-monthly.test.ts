import { describe, expect, test } from "bun:test";
import {
  buildMonthlyGridTariffIndex,
  monthRangesBetween,
  monthsInRangeOslo,
} from "../grid-tariff-monthly";

describe("monthRangesBetween", () => {
  test("inkluderer måneder som overlapper eval-vindu", () => {
    const ranges = monthRangesBetween(
      new Date("2026-06-20T00:00:00.000Z"),
      new Date("2026-07-05T00:00:00.000Z"),
    );
    expect(ranges.length).toBeGreaterThanOrEqual(2);
  });
});

describe("buildMonthlyGridTariffIndex", () => {
  test("bygger capacityLink per måned og markerer mangler", () => {
    const expected = monthsInRangeOslo(
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-07-01T00:00:00.000Z"),
    );
    const { byMonth, missingMonths } = buildMonthlyGridTariffIndex(
      [
        {
          timestamp: new Date("2026-06-15T08:00:00.000Z"),
          energyLink: 12,
          capacityLink: 45,
          fixedLink: 200,
        },
      ],
      expected,
    );

    expect(byMonth.get("2026-06")?.capacityLinkKrPerKw).toBe(45);
    expect(missingMonths).toContain("2026-07");
  });

  test("slår sammen energiledd (gr.2) og effektledd (gr.3) per måned", () => {
    const { byMonth, missingMonths } = buildMonthlyGridTariffIndex(
      [
        {
          timestamp: new Date("2026-06-15T08:00:00.000Z"),
          energyLink: 10.2,
          capacityLink: null,
          fixedLink: null,
        },
        {
          timestamp: new Date("2026-06-15T09:00:00.000Z"),
          energyLink: null,
          capacityLink: 51,
          fixedLink: 120,
        },
      ],
      ["2026-06"],
    );

    expect(byMonth.get("2026-06")?.energyLinkOre).toBe(10.2);
    expect(byMonth.get("2026-06")?.capacityLinkKrPerKw).toBe(51);
    expect(missingMonths).toHaveLength(0);
  });
});
