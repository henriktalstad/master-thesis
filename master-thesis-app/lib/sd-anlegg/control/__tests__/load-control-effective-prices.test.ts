import { describe, expect, test } from "bun:test";
import {
  buildControlForwardPrices,
  deriveMarginalAddonKrPerKwh,
} from "@/lib/sd-anlegg/control/control-effective-price-utils";
import type { ControlHourlyPrice } from "@/lib/sd-anlegg/control/control-types";
import { computeScopedShadowFactors } from "@/lib/sd-anlegg/control/shadow-control-policy";
import type { ScenarioHourContext } from "@/lib/sd-anlegg/control/scenario-hour-adjustments";

describe("deriveMarginalAddonKrPerKwh", () => {
  test("beregner median nettleie+avgift per kWh fra BHCC", () => {
    const addon = deriveMarginalAddonKrPerKwh([
      {
        hour: new Date(),
        electricityVolumeKwh: 10,
        electricitySpotCost: 5,
        electricityGridEnergyCost: 1.2,
        electricityConsumptionTaxCost: 0.8,
        electricityPriceNokPerKwh: 0.7,
      },
      {
        hour: new Date(),
        electricityVolumeKwh: 10,
        electricitySpotCost: 4,
        electricityGridEnergyCost: 1.0,
        electricityConsumptionTaxCost: 1.0,
        electricityPriceNokPerKwh: 0.6,
      },
    ]);
    expect(addon).toBe(0.2);
  });

  test("fallback når ingen forbruk", () => {
    expect(deriveMarginalAddonKrPerKwh([])).toBe(0.12);
  });
});

describe("buildControlForwardPrices", () => {
  test("bruker day-ahead fra allPrices for prognose-timer", () => {
    const forecastHour = "2026-06-26T08:00:00.000Z";
    const allPrices: ControlHourlyPrice[] = [
      {
        hour: forecastHour,
        spotKrPerKwh: 0.45,
        effectiveMarginalKrPerKwh: 0.57,
        isDayAheadSpot: true,
      },
    ];
    const forward = buildControlForwardPrices(allPrices, [
      { hour: forecastHour },
    ]);
    expect(forward[0]?.spotKrPerKwh).toBe(0.45);
    expect(forward[0]?.effectiveMarginalKrPerKwh).toBe(0.57);
    expect(forward[0]?.isDayAheadSpot).toBe(true);
  });

  test("aksepterer price-bundle fra loadControlEffectivePrices", () => {
    const forecastHour = "2026-06-26T08:00:00.000Z";
    const forward = buildControlForwardPrices(
      {
        prices: [
          {
            hour: forecastHour,
            spotKrPerKwh: 0.45,
            effectiveMarginalKrPerKwh: 0.57,
            isDayAheadSpot: true,
          },
        ],
      },
      [{ hour: forecastHour }],
    );
    expect(forward[0]?.spotKrPerKwh).toBe(0.45);
  });
});

describe("computeScopedShadowFactors", () => {
  const baseCtx = (
    overrides: Partial<ScenarioHourContext> = {},
  ): ScenarioHourContext => ({
    hourIso: "2026-06-20T10:00:00.000Z",
    hourUtc: 10,
    hourLocal: 12,
    spotKrPerKwh: 2.0,
    effectiveMarginalKrPerKwh: 2.35,
    outdoorTempC: 18,
    profile: {
      hour: "2026-06-20T10:00:00.000Z",
      supplySetpointC: 18,
      supplySetpointCalcC: 21,
      supplyFanPct: 60,
      exhaustFanPct: 55,
      heatingValvePct: 30,
      coolingValvePct: 0,
    },
    inForecastWindow: true,
    highPriceThreshold: 2.0,
    lowPriceThreshold: 0.5,
    ...overrides,
  });

  test("reduserer pådrag i dyr marginalpris på dagtid", () => {
    const factors = computeScopedShadowFactors(baseCtx());
    expect(factors.controlAdjusted).toBe(true);
    expect(factors.supplySetpointDeltaC).toBeLessThan(0);
    expect(factors.heatFactor).toBeLessThan(1);
  });

  test("trimmer vifter om natten", () => {
    const factors = computeScopedShadowFactors(
      baseCtx({
        hourLocal: 23,
        hourUtc: 21,
        effectiveMarginalKrPerKwh: 0.8,
        spotKrPerKwh: 0.6,
      }),
    );
    expect(factors.controlAdjusted).toBe(true);
    expect(factors.supplyFanFactor).toBeLessThan(1);
  });

  test("forvarmer i billige timer og kaldt vær", () => {
    const factors = computeScopedShadowFactors(
      baseCtx({
        hourLocal: 6,
        effectiveMarginalKrPerKwh: 0.4,
        spotKrPerKwh: 0.3,
        outdoorTempC: -2,
      }),
    );
    expect(factors.controlAdjusted).toBe(true);
    expect(factors.heatFactor).toBeGreaterThan(1);
  });
});
