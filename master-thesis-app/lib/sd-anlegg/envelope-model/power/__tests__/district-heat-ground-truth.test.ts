import { describe, expect, test } from "bun:test";
import {
  integrateDistrictHeatPowerKwh,
  stepDistrictHeatKw,
  sumHourlyTr003EnergyDelta,
  summarizeTr003MeasuredEnergy,
} from "../district-heat-ground-truth";

describe("district-heat-ground-truth", () => {
  test("stepDistrictHeatKw leser TR003 effekt", () => {
    expect(stepDistrictHeatKw({ districtMeterTr003PowerKw: 12.5 })).toBe(12.5);
    expect(stepDistrictHeatKw({ districtMeterTr003PowerKw: 0 })).toBeNull();
  });

  test("sumHourlyTr003EnergyDelta akkumulerer per time", () => {
    const total = sumHourlyTr003EnergyDelta([
      { t: "2026-06-24T10:00:00.000Z", districtMeterTr003EnergyKwh: 100 },
      { t: "2026-06-24T10:15:00.000Z", districtMeterTr003EnergyKwh: 100.5 },
      { t: "2026-06-24T10:30:00.000Z", districtMeterTr003EnergyKwh: 101.2 },
    ]);
    expect(total).toBeCloseTo(1.2, 5);
  });

  test("summarizeTr003MeasuredEnergy foretrekker energimåler", () => {
    const summary = summarizeTr003MeasuredEnergy({
      steps: [
        {
          t: "2026-06-24T10:00:00.000Z",
          districtMeterTr003EnergyKwh: 100,
          districtMeterTr003PowerKw: 8,
        },
        {
          t: "2026-06-24T10:15:00.000Z",
          districtMeterTr003EnergyKwh: 101.2,
          districtMeterTr003PowerKw: 8,
        },
      ],
      bhccDistrictHeatingKwh: 300,
    });
    expect(summary.source).toBe("tr003_energy_meter");
    expect(summary.groundTruthKwh).toBeGreaterThan(0);
  });

  test("integrateDistrictHeatPowerKwh summerer effekt", () => {
    const kwh = integrateDistrictHeatPowerKwh([
      { districtMeterTr003PowerKw: 8 },
      { districtMeterTr003PowerKw: 10 },
    ]);
    expect(kwh).toBeCloseTo(4.5, 5);
  });
});
