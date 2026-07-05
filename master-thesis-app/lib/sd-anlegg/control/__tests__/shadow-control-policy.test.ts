import { describe, expect, it } from "bun:test";
import { computeScopedShadowFactors } from "@/lib/sd-anlegg/control/shadow-control-policy";
import type { ScenarioHourContext } from "@/lib/sd-anlegg/control/scenario-hour-adjustments";

const baseCtx = (
  partial: Partial<ScenarioHourContext>,
): ScenarioHourContext => ({
  hourIso: "2026-06-24T12:00:00.000Z",
  hourUtc: 12,
  hourLocal: 14,
  spotKrPerKwh: 2,
  effectiveMarginalKrPerKwh: 2,
  outdoorTempC: 12,
  profile: {
    hour: "2026-06-24T12:00:00.000Z",
    supplySetpointC: 18,
    supplyFanPct: 55,
    exhaustFanPct: 50,
    heatingValvePct: 0,
    coolingValvePct: 0,
  },
  inForecastWindow: true,
  highPriceThreshold: 1.5,
  lowPriceThreshold: 0.8,
  ...partial,
});

describe("computeScopedShadowFactors", () => {
  it("trimmer ikke vifter når occupancyQ=0", () => {
    const factors = computeScopedShadowFactors(
      baseCtx({ occupancyQ: 0, hourLocal: 23 }),
    );
    expect(factors.supplyFanFactor).toBe(1);
    expect(factors.exhaustFanFactor).toBe(1);
  });

  it("responderer på dyr pris når occupancyQ er høy", () => {
    const factors = computeScopedShadowFactors(
      baseCtx({ occupancyQ: 1, hourLocal: 14 }),
    );
    expect(factors.controlAdjusted).toBe(true);
  });
});
