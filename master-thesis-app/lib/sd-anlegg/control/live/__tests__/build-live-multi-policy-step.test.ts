import { describe, expect, it } from "bun:test";
import { fitPowerProxyParams } from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import { buildLiveMultiPolicyStep } from "../build-live-multi-policy-step";
import type { MpcControlVector, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

const u: MpcControlVector = {
  supplySetpointC: 18,
  supplyFanPct: 40,
  exhaustFanPct: 35,
  heatingValvePct: 10,
  coolingValvePct: 0,
};

function measStep(uMeas: MpcControlVector): MpcTimestep {
  return {
    t: "2026-06-30T12:00:00.000Z",
    tMs: Date.parse("2026-06-30T12:00:00.000Z"),
    dowUtc: 2,
    hourUtc: 12,
    quarterUtc: 0,
    hourLocal: 14,
    uMeas,
    supplySetpointOperatorC: 18,
    supplySetpointCalcC: 18,
    extractTempC: 22.5,
    outdoorTempC: 15,
    spotKrPerKwh: 1.5,
    effectiveMarginalKrPerKwh: 1.5,
    heatKrPerKwh: 0.8,
    buildingElectricityKwh: 0.5,
    buildingDistrictHeatingKwh: 0.2,
    heatingActive: false,
    coolingActive: false,
  };
}

const power = fitPowerProxyParams([measStep(u)]);

describe("buildLiveMultiPolicyStep", () => {
  it("bygger alle fire policy-vektorer og demand-kostnad", () => {
    const step = buildLiveMultiPolicyStep({
      stepAt: "2026-06-30T12:00:00.000Z",
      uMeas: u,
      uBmsSim: { ...u, supplyFanPct: 42 },
      uMpc: { ...u, supplySetpointC: 17.5 },
      uDemand: { ...u, supplyFanPct: 38 },
      extractTempMeasC: 22.5,
      extractTempPredC: 23.1,
      marginalKrPerKwh: 1.5,
      heatKrPerKwh: 0.8,
      outdoorTempC: 15,
      buildingElectricityKwh: 0.5,
      buildingDistrictHeatingKwh: 0.2,
      power,
    });

    expect(step.uBmsMeas).toEqual(u);
    expect(step.uDemand?.supplyFanPct).toBe(38);
    expect(step.costDemandKr).toBeGreaterThan(0);
    expect(step.costMpcKr).toBeDefined();
    expect(step.costBaselineKr).toBeDefined();
    expect(step.costEmulatedKr).toBeDefined();
  });
});
