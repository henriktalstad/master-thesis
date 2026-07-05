import { describe, expect, test } from "bun:test";
import { summarizeHeatingDemandFromSteps } from "@/lib/sd-anlegg/control/summarize-heating-demand";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const power = {
  version: "power-v2",
  controllableElectricShare: 0.1,
  controllableHeatShare: 0.2,
  betaFan: 0.5,
  betaHeat: 0.47,
  betaCool: 0.28,
};

const baseVector = {
  supplySetpointC: 18,
  supplyFanPct: 40,
  exhaustFanPct: 38,
  heatingValvePct: 10,
  coolingValvePct: 0,
  districtTr002ValvePct: 0,
  districtTr003ValvePct: 5,
};

function step(overrides: Partial<MpcReplayStep> = {}): MpcReplayStep {
  return {
    t: "2026-06-24T10:00:00.000Z",
    uBmsMeas: baseVector,
    uBmsSim: baseVector,
    uMpc: { ...baseVector, heatingValvePct: 5 },
    deltaU: baseVector,
    extractTempMeasC: 22,
    extractTempPredC: 22,
    outdoorTempC: 5,
    electricKw: 0.5,
    heatKw: 0.2,
    marginalKrPerKwh: 1.2,
    costBaselineKr: 1,
    costEmulatedKr: 1,
    costMpcKr: 0.9,
    comfortViolation: false,
    usedFallback: false,
    buildingDistrictHeatingKwh: 2,
    ...overrides,
  };
}

describe("summarizeHeatingDemandFromSteps", () => {
  test("bruker persisterte steg-felt når tilgjengelig", () => {
    const summary = summarizeHeatingDemandFromSteps({
      steps: [
        step({
          heatingBatteryKwhBaseline: 0.3,
          heatingDistrictKwhBaseline: 0.7,
          heatingBatteryKwhEmulated: 0.3,
          heatingDistrictKwhEmulated: 0.7,
          heatingBatteryKwhMpc: 0.2,
          heatingDistrictKwhMpc: 0.5,
          heatingBatteryKwhDemand: 0.25,
          heatingDistrictKwhDemand: 0.6,
        }),
      ],
      power,
    });

    expect(summary.observed).toEqual({
      batteryKwh: 0.3,
      districtKwh: 0.7,
      totalKwh: 1,
    });
    expect(summary.mpc.totalKwh).toBe(0.7);
    expect(summary.activeSteps).toBe(1);
    expect(summary.activeStepPct).toBe(100);
    expect(summary.tr003.fromPowerIntegralKwh).toBeGreaterThanOrEqual(0);
  });

  test("beregner on-the-fly når steg-felt mangler", () => {
    const summary = summarizeHeatingDemandFromSteps({
      steps: [step()],
      power,
    });

    expect(summary.observed.totalKwh).toBeGreaterThan(0);
    expect(summary.mpc.totalKwh).toBeGreaterThan(0);
    expect(summary.activeStepPct).toBe(100);
  });

  test("teller inaktive steg uten oppvarmingsbehov", () => {
    const idle = {
      ...baseVector,
      heatingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    };
    const summary = summarizeHeatingDemandFromSteps({
      steps: [
        step({ uBmsMeas: idle, uBmsSim: idle, uMpc: idle }),
        step(),
      ],
      power,
    });

    expect(summary.activeSteps).toBe(1);
    expect(summary.activeStepPct).toBe(50);
  });
});
