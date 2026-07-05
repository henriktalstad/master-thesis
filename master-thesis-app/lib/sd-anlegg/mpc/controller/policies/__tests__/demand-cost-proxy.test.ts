import { describe, expect, it } from "bun:test";
import { estimateControllableHeatKw } from "@/lib/sd-anlegg/envelope-model/power/build-proxies";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

const baseU: MpcControlVector = {
  supplySetpointC: 20,
  supplyFanPct: 68,
  exhaustFanPct: 63,
  heatingValvePct: 25,
  coolingValvePct: 0,
  districtTr002ValvePct: 0,
  districtTr003ValvePct: 35,
};

const params = {
  controllableElectricShare: 0.12,
  controllableHeatShare: 0.88,
  betaFan: 1,
  betaFanFlow: null,
  betaHeat: 0.15,
  betaDistrictHeat: 0.2,
  betaCool: 0.05,
};

describe("demand heat proxy", () => {
  it("settpunktendring gir lavere varme uten TR003-anker", () => {
    const outdoorTempC = 16;
    const referenceKw = estimateControllableHeatKw({
      u: baseU,
      outdoorTempC,
      buildingDistrictHeatingKwh: 1,
      params,
      uReference: baseU,
    });
    const loweredSpKw = estimateControllableHeatKw({
      u: { ...baseU, supplySetpointC: 19.5 },
      outdoorTempC,
      buildingDistrictHeatingKwh: 1,
      params,
    });
    const anchoredKw = estimateControllableHeatKw({
      u: { ...baseU, supplySetpointC: 19.5 },
      outdoorTempC,
      buildingDistrictHeatingKwh: 1,
      params,
      step: { districtMeterTr003PowerKw: 3.2 },
      uReference: baseU,
    });

    expect(loweredSpKw).toBeLessThan(referenceKw);
    expect(anchoredKw).toBeGreaterThan(loweredSpKw);
  });
});
