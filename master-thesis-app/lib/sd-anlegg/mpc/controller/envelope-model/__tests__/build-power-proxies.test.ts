import { describe, expect, it } from "bun:test";
import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
  fitPowerProxyParams,
} from "../build-power-proxies";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function uMeas(
  partial: Partial<import("@/lib/sd-anlegg/mpc/shared/types").MpcControlVector> = {},
): import("@/lib/sd-anlegg/mpc/shared/types").MpcControlVector {
  return {
    supplySetpointC: 18,
    supplyFanPct: 40,
    exhaustFanPct: 40,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
    ...partial,
  };
}

function step(partial: Partial<MpcTimestep> & Pick<MpcTimestep, "uMeas">): MpcTimestep {
  return {
    t: "2026-06-20T10:00:00.000Z",
    tMs: Date.parse("2026-06-20T10:00:00.000Z"),
    dowUtc: 5,
    hourUtc: 10,
    quarterUtc: 0,
    hourLocal: 12,
    supplySetpointOperatorC: 18,
    supplySetpointCalcC: 18,
    extractTempC: 22,
    outdoorTempC: 15,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1.2,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 1,
    buildingDistrictHeatingKwh: 0.2,
    heatingActive: false,
    coolingActive: false,
    ...partial,
  };
}

describe("fitPowerProxyParams", () => {
  it("bruker datadrevne shares (power-v2)", () => {
    const train = [
      step({
        uMeas: uMeas(),
        buildingElectricityKwh: 2,
      }),
      step({
        t: "2026-06-20T10:15:00.000Z",
        uMeas: uMeas({ supplyFanPct: 50, exhaustFanPct: 50 }),
        buildingElectricityKwh: 2.5,
      }),
    ];

    const params = fitPowerProxyParams(train);
    expect(params.version).toBe("power-v2");
    expect(params.controllableElectricShare).toBeGreaterThanOrEqual(0.04);
    expect(params.controllableElectricShare).toBeLessThanOrEqual(0.4);
    expect(params.controllableHeatShare).toBeGreaterThanOrEqual(0.04);
    expect(params.controllableHeatShare).toBeLessThanOrEqual(0.85);
  });

  it("fallback-share når train mangler uMeas bruker attest-prior", () => {
    const params = fitPowerProxyParams([
      step({
        uMeas: undefined as unknown as MpcTimestep["uMeas"],
        buildingElectricityKwh: 2,
      }),
    ]);
    expect(params.controllableElectricShare).toBeCloseTo(0.277, 2);
    expect(params.controllableHeatShare).toBeCloseTo(0.527, 2);
  });

  it("scaleFit avrunder ikke til null betaFan", () => {
    const params = fitPowerProxyParams([
      step({
        uMeas: {
          supplySetpointC: 18,
          supplyFanPct: 55,
          exhaustFanPct: 52,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
        buildingElectricityKwh: 0.001,
      }),
      step({
        uMeas: {
          supplySetpointC: 18,
          supplyFanPct: 58,
          exhaustFanPct: 54,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
        buildingElectricityKwh: 0.001,
      }),
    ]);
    expect(params.betaFan).toBeGreaterThan(0);
  });

  it("estimateControllableElectricKw skalerer med kalibrert share", () => {
    const params = fitPowerProxyParams([
      step({
        uMeas: {
          supplySetpointC: 18,
          supplyFanPct: 60,
          exhaustFanPct: 60,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
        buildingElectricityKwh: 1.6,
      }),
    ]);
    const u = {
      supplySetpointC: 18,
      supplyFanPct: 60,
      exhaustFanPct: 60,
      heatingValvePct: 0,
      coolingValvePct: 0,
    };
    const kw = estimateControllableElectricKw({
      u,
      buildingElectricityKwh: 1.6,
      params,
    });
    expect(kw).toBeGreaterThan(0);
    expect(kw).toBeLessThan(16);
  });

  it("estimateControllableElectricKw skalerer med vifte (kubisk)", () => {
    const params = fitPowerProxyParams([
      step({
        uMeas: {
          supplySetpointC: 18,
          supplyFanPct: 60,
          exhaustFanPct: 60,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
        buildingElectricityKwh: 1.6,
      }),
    ]);
    const lowFan = {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 40,
      heatingValvePct: 0,
      coolingValvePct: 0,
    };
    const highFan = {
      supplySetpointC: 18,
      supplyFanPct: 70,
      exhaustFanPct: 70,
      heatingValvePct: 0,
      coolingValvePct: 0,
    };
    const lowKw = estimateControllableElectricKw({
      u: lowFan,
      buildingElectricityKwh: 1.6,
      params,
    });
    const highKw = estimateControllableElectricKw({
      u: highFan,
      buildingElectricityKwh: 1.6,
      params,
    });
    expect(highKw).toBeGreaterThan(lowKw * 1.5);
  });

  it("luftmengde-proxy gir gradient når vifte-% endres", () => {
    const uRef = {
      supplySetpointC: 18,
      supplyFanPct: 50,
      exhaustFanPct: 50,
      heatingValvePct: 0,
      coolingValvePct: 0,
    };
    const params = {
      version: "power-v3" as const,
      betaFan: 0.5,
      betaFanFlow: 0.8,
      betaHeat: 2,
      betaCool: 1,
      controllableElectricShare: 0.1,
      controllableHeatShare: 0.05,
    };
    const flowStep = {
      supplyFanFlowM3h: 4000,
      exhaustFanFlowM3h: 3800,
    };
    const lowKw = estimateControllableElectricKw({
      u: { ...uRef, supplyFanPct: 40, exhaustFanPct: 40 },
      buildingElectricityKwh: 1,
      params,
      step: flowStep,
      uReference: uRef,
    });
    const highKw = estimateControllableElectricKw({
      u: { ...uRef, supplyFanPct: 65, exhaustFanPct: 65 },
      buildingElectricityKwh: 1,
      params,
      step: flowStep,
      uReference: uRef,
    });
    expect(highKw).toBeGreaterThan(lowKw * 1.2);
  });

  it("flow-anker: samme u og uReference gir lavere proxy enn emulert anker", () => {
    const uMeasRef = {
      supplySetpointC: 18,
      supplyFanPct: 35,
      exhaustFanPct: 35,
      heatingValvePct: 0,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    };
    const uEmulRef = { ...uMeasRef, supplyFanPct: 55, exhaustFanPct: 55 };
    const params = {
      version: "power-v3" as const,
      betaFan: 0.5,
      betaFanFlow: 0.8,
      betaHeat: 2,
      betaCool: 1,
      controllableElectricShare: 0.1,
      controllableHeatShare: 0.05,
    };
    const flowStep = {
      supplyFanFlowM3h: 4000,
      exhaustFanFlowM3h: 3800,
    };
    const alignedKw = estimateControllableElectricKw({
      u: uMeasRef,
      buildingElectricityKwh: 1,
      params,
      step: flowStep,
      uReference: uMeasRef,
    });
    const emulAnchorKw = estimateControllableElectricKw({
      u: uMeasRef,
      buildingElectricityKwh: 1,
      params,
      step: flowStep,
      uReference: uEmulRef,
    });
    expect(emulAnchorKw).toBeLessThan(alignedKw);
  });

  it("estimateControllableHeatKw skalerer counterfactual fra modell-anker, ikke full TR003", () => {
    const uRef = uMeas({ heatingValvePct: 40, districtTr003ValvePct: 30 });
    const params = {
      version: "power-v3" as const,
      betaFan: 0.5,
      betaFanFlow: null,
      betaHeat: 2,
      betaDistrictHeat: 1,
      betaCool: 1,
      controllableElectricShare: 0.1,
      controllableHeatShare: 0.2,
    };
    const baseKw = estimateControllableHeatKw({
      u: uRef,
      outdoorTempC: 5,
      buildingDistrictHeatingKwh: 10,
      params,
      step: { districtMeterTr003PowerKw: 25 },
      uReference: uRef,
    });
    const reducedKw = estimateControllableHeatKw({
      u: uMeas({ heatingValvePct: 20, districtTr003ValvePct: 15 }),
      outdoorTempC: 5,
      buildingDistrictHeatingKwh: 10,
      params,
      step: { districtMeterTr003PowerKw: 25 },
      uReference: uRef,
    });
    expect(baseKw).toBeGreaterThan(0);
    expect(baseKw).toBeLessThan(25);
    expect(reducedKw).toBeLessThan(baseKw * 0.7);
  });

  it("estimateControllableHeatKw capper mod bygg- og kretsmåling", () => {
    const params = {
      version: "power-v3" as const,
      betaFan: 0.5,
      betaFanFlow: null,
      betaHeat: 8,
      betaDistrictHeat: 8,
      betaCool: 1,
      controllableElectricShare: 0.1,
      controllableHeatShare: 0.4,
    };
    const uncappedModel = estimateControllableHeatKw({
      u: uMeas({ heatingValvePct: 100, districtTr003ValvePct: 100 }),
      outdoorTempC: -5,
      buildingDistrictHeatingKwh: 100,
      params: { ...params, betaHeat: 80, betaDistrictHeat: 80 },
      step: { districtMeterTr003PowerKw: 12 },
      uReference: uMeas({ heatingValvePct: 10, districtTr003ValvePct: 10 }),
    });
    expect(uncappedModel).toBeLessThanOrEqual(12);
  });

  it("kjøling gir el-last når utetemp er under tilluft-SP men ventil er aktiv", () => {
    const params = {
      version: "power-v2" as const,
      betaFan: 0.1,
      betaFanFlow: null,
      betaHeat: 2,
      betaDistrictHeat: 0,
      betaCool: 3,
      controllableElectricShare: 0.2,
      controllableHeatShare: 0.05,
    };
    const withoutCooling = estimateControllableElectricKw({
      u: uMeas({ coolingValvePct: 0, supplySetpointC: 20 }),
      buildingElectricityKwh: 2,
      outdoorTempC: 13,
      params,
    });
    const withCooling = estimateControllableElectricKw({
      u: uMeas({ coolingValvePct: 40, supplySetpointC: 20 }),
      buildingElectricityKwh: 2,
      outdoorTempC: 13,
      params,
    });
    expect(withCooling).toBeGreaterThan(withoutCooling);
    expect(withCooling).toBeCloseTo(3 * 0.4 * 1, 1);
  });

  it("fitPowerProxyParams kalibrerer betaCool uten positiv utetemp-setpunkt-delta", () => {
    const params = fitPowerProxyParams([
      step({
        uMeas: uMeas({ coolingValvePct: 35, supplySetpointC: 20 }),
        outdoorTempC: 13,
        buildingElectricityKwh: 4,
        buildingCoolingKwh: 0.8,
      }),
      step({
        t: "2026-06-20T10:15:00.000Z",
        uMeas: uMeas({ coolingValvePct: 45, supplySetpointC: 20 }),
        outdoorTempC: 14,
        buildingElectricityKwh: 4.5,
        buildingCoolingKwh: 1,
      }),
    ]);
    expect(params.betaCool).toBeGreaterThan(0.5);
  });
});
