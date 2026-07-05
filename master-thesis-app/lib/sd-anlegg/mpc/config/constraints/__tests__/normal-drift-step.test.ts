import { describe, expect, test } from "bun:test";
import {
  isDisturbedOperationStep,
  isNormalDriftTrainingStep,
} from "@/lib/sd-anlegg/mpc/config/constraints/normal-drift-step";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function baseStep(overrides: Partial<MpcTimestep> = {}): MpcTimestep {
  return {
    t: "2026-07-01T12:00:00.000Z",
    tMs: 0,
    dowUtc: 2,
    hourUtc: 12,
    quarterUtc: 0,
    hourLocal: 14,
    uMeas: {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    },
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    extractTempC: 21,
    outdoorTempC: 10,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1.2,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 0.5,
    buildingDistrictHeatingKwh: 0.2,
    heatingActive: true,
    coolingActive: false,
    ...overrides,
  };
}

describe("normal-drift-step", () => {
  test("normal drift når måling og modus er ok", () => {
    expect(isNormalDriftTrainingStep(baseStep())).toBe(true);
    expect(isDisturbedOperationStep(baseStep())).toBe(false);
  });

  test("alarm og frost ekskluderes fra trening", () => {
    expect(isNormalDriftTrainingStep(baseStep({ alarmActive: true }))).toBe(false);
    expect(isNormalDriftTrainingStep(baseStep({ frostRiskActive: true }))).toBe(false);
    expect(isNormalDriftTrainingStep(baseStep({ lowEfficiencyActive: true }))).toBe(false);
  });
});
