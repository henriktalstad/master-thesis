import { describe, expect, test } from "bun:test";
import { fitPlantModel } from "../thermal/fit-plant";
import { validatePlantModel } from "../thermal/validate";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function syntheticSteps(count: number): MpcTimestep[] {
  const steps: MpcTimestep[] = [];
  for (let i = 0; i < count; i++) {
    const extract = 22 + Math.sin(i / 8) * 0.5 + i * 0.002;
    steps.push({
      t: new Date(Date.UTC(2026, 5, 1, 0, i * 15)).toISOString(),
      tMs: Date.UTC(2026, 5, 1, 0, i * 15),
      dowUtc: 1,
      hourUtc: Math.floor((i * 15) / 60),
      quarterUtc: Math.floor(((i * 15) % 60) / 15),
      hourLocal: Math.floor((i * 15) / 60),
      uMeas: {
        supplySetpointC: 18 + (i % 3) * 0.1,
        supplyFanPct: 20 + (i % 5),
        exhaustFanPct: 18 + (i % 4),
        heatingValvePct: i % 10,
        coolingValvePct: 5 + (i % 8),
      },
      supplySetpointOperatorC: null,
      supplySetpointCalcC: null,
      extractTempC: extract,
      supplyTempMeasC: 17 + Math.sin(i / 6) * 0.3,
      intakeTempMeasC: 12 + (i % 2) * 0.2,
      heatRecoveryAfterTempC: 15 + (i % 3) * 0.1,
      extractSetpointC: 22,
      outdoorTempC: 14 + Math.sin(i / 12),
      spotKrPerKwh: 1,
      effectiveMarginalKrPerKwh: 1,
      heatKrPerKwh: 0.5,
      buildingElectricityKwh: 0.2,
      buildingDistrictHeatingKwh: 0.3,
      heatingActive: false,
      coolingActive: true,
    });
  }
  return steps;
}

describe("validatePlantModel", () => {
  test("fit + 1-steg og multi-steg validering", () => {
    const steps = syntheticSteps(120);
    const plant = fitPlantModel(steps.slice(0, 90));
    expect(plant).not.toBeNull();
    expect(plant!.featureNames.length).toBeGreaterThan(10);
    expect(plant!.featureScope.some((f) => f.usedInModel && f.featureId === "supply_temp_meas")).toBe(
      true,
    );

    const validation = validatePlantModel(steps.slice(90), plant!);
    expect(validation.comparedSteps).toBeGreaterThan(0);
    expect(validation.rmseC).toBeGreaterThan(0);
    expect(validation.multiStep?.length).toBe(3);
    expect(validation.multiStep?.[0]?.horizonHours).toBe(4);
    expect(validation.featureScope.length).toBeGreaterThan(0);
  });
});
