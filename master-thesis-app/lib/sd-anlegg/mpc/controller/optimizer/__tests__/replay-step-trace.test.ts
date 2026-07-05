import { describe, expect, it } from "bun:test";
import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
  resolvePowerFlowAnchor,
  stepEnergyCostKr,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import { buildReplayStepRecord } from "../build-replay-step-record";
import { computeDemandControlFromTimestep } from "@/lib/sd-anlegg/mpc/controller/policies/demand-from-timestep";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import type { PolicyStepContext } from "@/lib/sd-anlegg/mpc/controller/policies/types";

const baseU: MpcControlVector = {
  supplySetpointC: 18,
  supplyFanPct: 40,
  exhaustFanPct: 38,
  heatingValvePct: 10,
  coolingValvePct: 5,
  districtTr002ValvePct: 0,
  districtTr003ValvePct: 35,
};

const powerParams = {
  version: "power-v3" as const,
  controllableElectricShare: 0.12,
  controllableHeatShare: 0.88,
  betaFan: 1,
  betaFanFlow: null,
  betaHeat: 0.15,
  betaDistrictHeat: 0.2,
  betaCool: 0.05,
};

function makeStep(overrides: Partial<MpcTimestep> = {}): MpcTimestep {
  return {
    t: "2026-06-25T10:00:00.000Z",
    tMs: Date.parse("2026-06-25T10:00:00.000Z"),
    dowUtc: 3,
    hourUtc: 10,
    quarterUtc: 0,
    hourLocal: 12,
    uMeas: baseU,
    supplySetpointOperatorC: 18,
    supplySetpointCalcC: 19,
    extractTempC: 22,
    outdoorTempC: 15,
    spotKrPerKwh: 1.1,
    effectiveMarginalKrPerKwh: 1.2,
    heatKrPerKwh: 0.8,
    buildingElectricityKwh: 2,
    buildingDistrictHeatingKwh: 1,
    heatingActive: false,
    coolingActive: true,
    ...overrides,
  };
}

function makeCtx(step: MpcTimestep, uBmsSim: MpcControlVector): PolicyStepContext {
  return {
    step,
    stepIndex: 0,
    steps: [step],
    calibration: { power: powerParams } as PolicyStepContext["calibration"],
    tExtState: 22,
    uBmsSim,
    priceThresholds: { high: 2, low: 0.5 },
    canOptimize: true,
  };
}

describe("replay step trace", () => {
  it("mapper buildReplayStepRecord til forventede kost- og proxy-felt", () => {
    const step = makeStep();
    const stepHours = 0.25;
    const record = buildReplayStepRecord({
      step,
      uMeas: baseU,
      uBmsSim: baseU,
      uMpc: { ...baseU, supplyFanPct: 32 },
      uDemand: baseU,
      deltaU: { ...baseU, supplyFanPct: -8 },
      extractPred: 21.5,
      extractPredEmulated: 21.4,
      extractPredDemand: 21.3,
      extractPredObserved: 21.6,
      comfortBandC: { min: 18, max: 24 },
      occupancyQ: 0,
      occupancySource: "schedule",
      usedFallback: false,
      fallbackReason: null,
      powerCosts: {
        stepHours,
        baselineElectricKw: 2,
        emulatedElectricKw: 2.1,
        mpcElectricKw: 1.8,
        demandElectricKw: 2.05,
        baselineHeatKw: 3,
        emulatedHeatKw: 3.1,
        mpcHeatKw: 2.9,
        demandHeatKw: 3.05,
        costBaselineKr: 0.5,
        costEmulatedKr: 0.52,
        costMpcKr: 0.48,
        costDemandKr: 0.51,
        marginalKrPerKwh: 1.2,
      },
    });

    expect(record.costBaselineKr).toBe(0.5);
    expect(record.costMpcKr).toBe(0.48);
    expect(record.costDemandKr).toBe(0.51);
    expect(record.proxyElKwhBaseline).toBeCloseTo(0.5, 5);
    expect(record.proxyElKwhMpc).toBeCloseTo(0.45, 5);
    expect(record.extractTempPredC).toBe(21.5);
    expect(record.extractTempPredDemandC).toBe(21.3);
    expect(record.electricKw).toBe(1.8);
    expect(record.heatKw).toBe(2.9);
    expect(record.occupancyQ).toBe(0);
    expect(record.occupancySource).toBe("schedule");
  });

  it("nøytral pris: uDemand matcher uBmsSim (Prisregler-anker)", () => {
    const step = makeStep({
      effectiveMarginalKrPerKwh: 1.15,
      spotKrPerKwh: 1.1,
      hourLocal: 12,
    });
    const result = computeDemandControlFromTimestep(makeCtx(step, baseU));
    expect(result.u).not.toBeNull();
    expect(result.u!.supplySetpointC).toBe(baseU.supplySetpointC);
    expect(result.u!.supplyFanPct).toBe(baseU.supplyFanPct);
    expect(result.u!.heatingValvePct).toBe(baseU.heatingValvePct);
  });

  it("nøytral pris: demand el-kW og kost matcher emulated uten powerScale-hack", () => {
    const step = makeStep({
      effectiveMarginalKrPerKwh: 1.15,
      hourLocal: 12,
    });
    const demand = computeDemandControlFromTimestep(makeCtx(step, baseU));
    const uDemand = demand.u ?? baseU;
    expect(demand.powerScale).toBeUndefined();

    const flowAnchor = resolvePowerFlowAnchor(step.uMeas, baseU);
    const common = {
      buildingElectricityKwh: step.buildingElectricityKwh,
      outdoorTempC: step.outdoorTempC,
      params: powerParams,
      step,
      uReference: flowAnchor,
    };
    const emulatedKw = estimateControllableElectricKw({ u: baseU, ...common });
    const demandKw = estimateControllableElectricKw({ u: uDemand, ...common });
    const emulatedHeatKw = estimateControllableHeatKw({
      u: baseU,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      outdoorTempC: step.outdoorTempC,
      params: powerParams,
      step,
      uReference: flowAnchor,
    });
    const demandHeatKw = estimateControllableHeatKw({
      u: uDemand,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      outdoorTempC: step.outdoorTempC,
      params: powerParams,
      step,
      uReference: flowAnchor,
    });

    expect(demandKw).toBeCloseTo(emulatedKw, 6);
    expect(demandHeatKw).toBeCloseTo(emulatedHeatKw, 6);

    const marginal = step.effectiveMarginalKrPerKwh ?? step.spotKrPerKwh;
    const costEmulated = stepEnergyCostKr({
      electricKw: emulatedKw,
      heatKw: emulatedHeatKw,
      stepMinutes: 15,
      marginalKrPerKwh: marginal,
      heatKrPerKwh: step.heatKrPerKwh,
    });
    const costDemand = stepEnergyCostKr({
      electricKw: demandKw,
      heatKw: demandHeatKw,
      stepMinutes: 15,
      marginalKrPerKwh: marginal,
      heatKrPerKwh: step.heatKrPerKwh,
    });
    expect(costDemand).toBeCloseTo(costEmulated, 8);
  });

  it("dyr dagtid: kost fra uDemand alene — ingen ekstra powerScale-multiplikasjon", () => {
    const step = makeStep({
      effectiveMarginalKrPerKwh: 2.8,
      spotKrPerKwh: 2.2,
      hourLocal: 14,
    });
    const demand = computeDemandControlFromTimestep(makeCtx(step, baseU));
    expect(demand.u).not.toBeNull();

    const flowAnchor = resolvePowerFlowAnchor(step.uMeas, baseU);
    const common = {
      buildingElectricityKwh: step.buildingElectricityKwh,
      outdoorTempC: step.outdoorTempC,
      params: powerParams,
      step,
      uReference: flowAnchor,
    };
    const demandKw = estimateControllableElectricKw({
      u: demand.u ?? baseU,
      ...common,
    });
    const demandHeatKw = estimateControllableHeatKw({
      u: demand.u ?? baseU,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      outdoorTempC: step.outdoorTempC,
      params: powerParams,
      step,
      uReference: flowAnchor,
    });
    const marginal = step.effectiveMarginalKrPerKwh ?? step.spotKrPerKwh;
    const costFromU = stepEnergyCostKr({
      electricKw: demandKw,
      heatKw: demandHeatKw,
      stepMinutes: 15,
      marginalKrPerKwh: marginal,
      heatKrPerKwh: step.heatKrPerKwh,
    });

    if (demand.powerScale?.electric != null && demand.powerScale.electric < 0.999) {
      const scaledCost = stepEnergyCostKr({
        electricKw: demandKw * demand.powerScale.electric,
        heatKw: demandHeatKw,
        stepMinutes: 15,
        marginalKrPerKwh: marginal,
        heatKrPerKwh: step.heatKrPerKwh,
      });
      expect(costFromU).not.toBeCloseTo(scaledCost, 4);
    }
  });
});
