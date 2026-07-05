import { describe, expect, test } from "bun:test";
import {
  gridMarginalAddonKrPerKwh,
  gridOreForHour,
} from "@/lib/sd-anlegg/control/grid-tariff-marginal-utils";

describe("gridMarginalAddonKrPerKwh", () => {
  test("konverterer øre/kWh + forbruksavgift", () => {
    const addon = gridMarginalAddonKrPerKwh(12.5);
    expect(addon).toBeGreaterThan(0.3);
    expect(addon).toBeLessThan(0.5);
  });
});

describe("gridOreForHour", () => {
  test("matcher Oslo time-of-day i samme måned (sommer UTC+2)", () => {
    const map = new Map<string, number>([
      // NVE time=10 → Oslo 10:00 15. juni = 08:00 UTC
      ["2026-06-15T08:00:00.000Z", 11.2],
    ]);
    const ore = gridOreForHour(map, new Date("2026-06-20T08:00:00.000Z"));
    expect(ore).toBe(11.2);
  });

  test("matcher ikke feil UTC-time når Oslo-time er forskjellig", () => {
    const map = new Map<string, number>([
      ["2026-06-15T08:00:00.000Z", 11.2],
    ]);
    const ore = gridOreForHour(map, new Date("2026-06-20T10:00:00.000Z"));
    expect(ore).toBeNull();
  });
});
