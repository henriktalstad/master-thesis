import { describe, expect, it } from "bun:test";
import { summarizeBhccMeasuredEnergy } from "../summarize-bhcc-measured-energy";

describe("summarizeBhccMeasuredEnergy", () => {
  it("summerer volum, kost og spot-kilder i eval-vinduet", () => {
    const evalStart = new Date("2026-06-24T00:00:00.000Z");
    const evalEnd = new Date("2026-06-24T03:00:00.000Z");

    const summary = summarizeBhccMeasuredEnergy({
      evalStart,
      evalEnd,
      rows: [
        {
          hour: new Date("2026-06-24T00:00:00.000Z"),
          electricityVolumeKwh: 10,
          electricityTotalCost: 5,
          electricitySpotCost: 3,
          electricityGridEnergyCost: 1,
          electricityConsumptionTaxCost: 1,
          electricityPriceNokPerKwh: 0.5,
          districtHeatingVolumeKwh: 2,
          districtHeatingTotalCost: 1,
          spotPriceSource: "ENTSOE",
        },
        {
          hour: new Date("2026-06-24T01:00:00.000Z"),
          electricityVolumeKwh: 20,
          electricityTotalCost: 10,
          electricitySpotCost: 6,
          electricityGridEnergyCost: 2,
          electricityConsumptionTaxCost: 2,
          electricityPriceNokPerKwh: 0.5,
          districtHeatingVolumeKwh: 0,
          districtHeatingTotalCost: 0,
          spotPriceSource: "NORD_POOL",
        },
        {
          hour: new Date("2026-06-24T03:00:00.000Z"),
          electricityVolumeKwh: 99,
          electricityTotalCost: 99,
          electricitySpotCost: 99,
          electricityGridEnergyCost: 0,
          electricityConsumptionTaxCost: 0,
          electricityPriceNokPerKwh: 0.5,
          districtHeatingVolumeKwh: 99,
          districtHeatingTotalCost: 99,
          spotPriceSource: "ENTSOE",
        },
      ],
    });

    expect(summary.measured.electricityKwh).toBe(30);
    expect(summary.measured.districtHeatingKwh).toBe(2);
    expect(summary.measured.electricityCostKr).toBe(15);
    expect(summary.measured.districtHeatingCostKr).toBe(1);
    expect(summary.measured.hourCount).toBe(2);
    expect(summary.expectedHours).toBe(3);
    expect(summary.hourlyCoveragePct).toBeCloseTo(66.7, 1);
    expect(summary.prices.spotHoursEntsoe).toBe(1);
    expect(summary.prices.spotHoursNordPool).toBe(1);
    expect(summary.prices.hoursWithMarginalPrice).toBe(2);
  });
});
