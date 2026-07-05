import { describe, expect, test } from "bun:test";
import {
  allocateHourlyEnergyToSteps,
  averagePowerKwFromStepEnergy,
  integratePowerSeriesToEnergyKwh,
  resolveTr003GroundTruthKwh,
} from "../energy-quantity";

describe("energy-quantity", () => {
  test("allocateHourlyEnergyToSteps fordeler BHCC-time på 4 steg", () => {
    expect(allocateHourlyEnergyToSteps(40)).toBe(10);
    expect(allocateHourlyEnergyToSteps(40, 4)).toBe(10);
  });

  test("averagePowerKwFromStepEnergy konverterer steg-energi til kW", () => {
    expect(averagePowerKwFromStepEnergy(2.5, 15)).toBeCloseTo(10, 5);
  });

  test("integratePowerSeriesToEnergyKwh summerer effekt over intervaller", () => {
    expect(integratePowerSeriesToEnergyKwh([8, 10], 15)).toBeCloseTo(4.5, 5);
  });

  test("resolveTr003GroundTruthKwh foretrekker energimåler", () => {
    expect(
      resolveTr003GroundTruthKwh({
        fromEnergyMeterKwh: 42,
        fromPowerIntegralKwh: 38,
        bhccDistrictHeatingKwh: 300,
      }),
    ).toMatchObject({
      groundTruthKwh: 42,
      source: "tr003_energy_meter",
    });
  });

  test("resolveTr003GroundTruthKwh faller tilbake til effektintegral", () => {
    expect(
      resolveTr003GroundTruthKwh({
        fromEnergyMeterKwh: 0,
        fromPowerIntegralKwh: 38,
        bhccDistrictHeatingKwh: 300,
      }),
    ).toMatchObject({
      groundTruthKwh: 38,
      source: "tr003_power_integral",
    });
  });
});
