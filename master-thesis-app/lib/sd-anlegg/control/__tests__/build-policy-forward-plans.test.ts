import { describe, expect, test } from "bun:test";
import { buildPolicyForwardPlans } from "../live/build-policy-forward-plans";
import type { MpcForwardPlan } from "../control-types-live";
import type { MpcCalibrationBundle, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

const stubCalibration = {
  modelVersion: "mpc-v1",
  power: {
    version: "power-v2",
    betaFan: 1,
    betaHeat: 1,
    betaCool: 1,
    controllableElectricShare: 0.3,
    controllableHeatShare: 0.2,
  },
  solver: { stepMinutes: 15, horizonSteps: 4 },
} as MpcCalibrationBundle;

const u = {
  supplySetpointC: 18,
  supplyFanPct: 40,
  exhaustFanPct: 40,
  heatingValvePct: 10,
  coolingValvePct: 0,
};

function stubPlan(): MpcForwardPlan {
  return {
    horizonSteps: 2,
    stepMinutes: 15,
    planSteps: [
      {
        t: "2026-06-30T10:00:00.000Z",
        spotKrPerKwh: 1,
        effectiveMarginalKrPerKwh: 1.2,
        outdoorTempC: 10,
        uBmsSim: u,
        uMpc: { ...u, supplyFanPct: 35 },
        predictedExtractC: 21,
        expectedDeltaCostKr: -0.5,
      },
      {
        t: "2026-06-30T10:15:00.000Z",
        spotKrPerKwh: 1.1,
        effectiveMarginalKrPerKwh: 1.3,
        outdoorTempC: 10,
        uBmsSim: u,
        uMpc: { ...u, supplyFanPct: 30 },
        predictedExtractC: 21,
        expectedDeltaCostKr: -0.6,
      },
    ],
    optimizedSteps: 2,
    fallbackSteps: 0,
    fallbackByReason: { missing_u_meas: 0, simultaneous_heat_cool: 0, alarm: 0 },
    effect: {
      totalCostBaselineKr: 10,
      totalCostMpcKr: 9,
      deltaCostKr: -1,
      deltaCostPct: -10,
    },
    weatherSource: "met_locationforecast",
    dayAheadHourCount: 24,
    computedAt: "2026-06-30T10:00:00.000Z",
  };
}

function stubTimesteps(): MpcTimestep[] {
  return [
    {
      t: "2026-06-30T10:00:00.000Z",
      tMs: Date.parse("2026-06-30T10:00:00.000Z"),
      dowUtc: 1,
      hourUtc: 10,
      quarterUtc: 0,
      hourLocal: 12,
      uMeas: u,
      supplySetpointOperatorC: null,
      supplySetpointCalcC: 18,
      extractTempC: 21,
      outdoorTempC: 10,
      spotKrPerKwh: 1,
      effectiveMarginalKrPerKwh: 1.2,
      heatKrPerKwh: 0.5,
      buildingElectricityKwh: 0.5,
      buildingDistrictHeatingKwh: 0.2,
      heatingActive: true,
      coolingActive: false,
    },
    {
      t: "2026-06-30T10:15:00.000Z",
      tMs: Date.parse("2026-06-30T10:15:00.000Z"),
      dowUtc: 1,
      hourUtc: 10,
      quarterUtc: 1,
      hourLocal: 12,
      uMeas: u,
      supplySetpointOperatorC: null,
      supplySetpointCalcC: 18,
      extractTempC: 21,
      outdoorTempC: 10,
      spotKrPerKwh: 1.1,
      effectiveMarginalKrPerKwh: 1.3,
      heatKrPerKwh: 0.5,
      buildingElectricityKwh: 0.5,
      buildingDistrictHeatingKwh: 0.2,
      heatingActive: true,
      coolingActive: false,
    },
  ];
}

describe("buildPolicyForwardPlans", () => {
  test("returnerer mpc-v1, demand-scoped og emulated", () => {
    const plans = buildPolicyForwardPlans({
      mpcPlan: stubPlan(),
      calibration: stubCalibration,
      timesteps: stubTimesteps(),
    });
    expect(plans["mpc-v1"]).toBeDefined();
    expect(plans["demand-scoped"]?.planSteps.length).toBe(2);
    expect(plans.emulated?.effect.deltaCostKr).toBe(0);
  });
});
