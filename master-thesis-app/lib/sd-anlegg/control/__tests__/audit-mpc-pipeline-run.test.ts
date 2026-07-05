import { describe, expect, mock, test } from "bun:test";
import type { MpcEnergyReconcileSummary } from "../build-mpc-energy-reconcile";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

mock.module("server-only", () => ({}));

function step(t: string, overrides: Partial<MpcReplayStep> = {}): MpcReplayStep {
  return {
    t,
    uBmsMeas: { supplySetpointC: 18, supplyFanPct: 40, exhaustFanPct: 35, heatingValvePct: 0, coolingValvePct: 0 },
    uBmsSim: { supplySetpointC: 18, supplyFanPct: 38, exhaustFanPct: 33, heatingValvePct: 0, coolingValvePct: 0 },
    uMpc: { supplySetpointC: 18, supplyFanPct: 36, exhaustFanPct: 32, heatingValvePct: 0, coolingValvePct: 0 },
    costBaselineKr: 1,
    costEmulatedKr: 0.9,
    costMpcKr: 0.85,
    marginalKrPerKwh: 1.2,
    proxyElKwhBaseline: 0.5,
    proxyElKwhEmulated: 0.48,
    proxyElKwhMpc: 0.45,
    proxyHeatKwhEmulated: 0.2,
    usedFallback: false,
    ...overrides,
  } as MpcReplayStep;
}

function reconcileSummary(
  overrides: Partial<MpcEnergyReconcileSummary> = {},
): MpcEnergyReconcileSummary {
  return {
    evalStart: "2026-06-24T00:00:00.000Z",
    evalEnd: "2026-06-25T00:00:00.000Z",
    hoursAligned: 24,
    measured: {
      electricityKwh: 100,
      districtHeatingKwh: 50,
      totalCostKr: 200,
      hours: 24,
    },
    proxy: {
      observed: { elKwh: 10, heatKwh: 5, costKr: 20 },
      emulated: { elKwh: 9, heatKwh: 4.8, costKr: 19 },
      mpc: { elKwh: 8.5, heatKwh: 4.5, costKr: 18 },
    },
    shares: {
      controllableElectricShare: 9,
      controllableHeatShare: 9.6,
      proxyElectricShareOfMeasured: 9,
      proxyHeatShareOfMeasured: 9.6,
      proxyHeatShareOfCircuit: null,
      heatGroundTruth: "none",
    },
    deltaMpcVsEmulated: { costKr: -1, costPct: -5, elKwh: -0.5, heatKwh: -0.3 },
    heatingDemand: {
      activeSteps: 10,
      activeStepPct: 50,
      observed: { totalKwh: 5, batteryKwh: 1, districtKwh: 4 },
      emulated: { totalKwh: 4.8, batteryKwh: 1, districtKwh: 3.8 },
      mpc: { totalKwh: 4.5, batteryKwh: 1, districtKwh: 3.5 },
      demand: { totalKwh: 4.4, batteryKwh: 1, districtKwh: 3.4 },
      tr003: {
        fromPowerIntegralKwh: 0,
        fromEnergyMeterKwh: 0,
        groundTruthKwh: 0,
        source: "none",
      },
    },
    districtDeltaT: [],
    ...overrides,
  };
}

describe("evaluateMpcPipelineDbConsistency", () => {
  test("passer når DB-tellinger og relational artifacts er konsistente", async () => {
    const { evaluateMpcPipelineDbConsistency } = await import(
      "../evaluate-mpc-pipeline-db-consistency"
    );
    const { buildPriceLoadShiftAnalysis } = await import(
      "../build-price-load-shift-analysis"
    );

    const steps = [step("2026-06-24T10:00:00.000Z"), step("2026-06-24T10:15:00.000Z")];
    const summary = reconcileSummary();
    const { summarizeMpcReplaySteps } = await import("../summarize-mpc-replay-steps");
    const replaySummary = summarizeMpcReplaySteps(steps)!;
    const priceLoad =
      buildPriceLoadShiftAnalysis(steps) ?? {
        bands: {
          high: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null },
          medium: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null },
          low: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null },
        },
        deltaE_hp_kwh: 0,
        deltaE_hp_pct: null,
        highPriceHours: 0,
        highPriceCostBaselineKr: 0,
        highPriceCostMpcKr: 0,
        highPriceCostDeltaKr: 0,
        highPriceCostDeltaPct: null,
        interpretation: "test",
      };
    const audit = evaluateMpcPipelineDbConsistency({
      pipelineRunId: "run-1",
      buildingId: "b1",
      evalStart: new Date("2026-06-24T00:00:00.000Z"),
      evalEnd: new Date("2026-06-25T00:00:00.000Z"),
      stepCount: 2,
      measuredElectricityKwh: 100,
      priceLoadShift: priceLoad,
      energyReconcileSummary: summary,
      replaySummary: { deltaCostPct: -1 },
      replayStepRows: 2,
      supervisoryCommands: 6,
      energyReconcileHours: 24,
      bhccHours: 24,
      steps,
      energyReconcile: summary,
      capacityTariff: {
        missingTariffMonths: [],
        tariffSyncedOnMiss: false,
        evalPeakKw: { observed: 1, emulated: 1, mpc: 1 },
        bhccEvalPeakKw: 10,
        bhccEvalPeakDistrictHeatingKw: 5,
        evalPeakDeltaKw: 0,
        evalPeakDeltaPct: 0,
        monthlyRows: [],
        estimatedCapacityCostKr: { emulated: null, mpc: null, deltaKr: null },
        scopeNote: "test",
      },
      relationalArtifacts: {
        policyKpiCount: 2,
        priceLoadBandCount: 3,
        chartPointCount: 48,
        chartsGeneratedAt: new Date(),
      },
      persistedRunScalars: {
        stepCount: replaySummary.stepCount,
        totalCostBaselineKr: replaySummary.totalCostBaselineKr,
        totalCostEmulatedKr: replaySummary.totalCostEmulatedKr,
        totalCostMpcKr: replaySummary.totalCostMpcKr,
        totalCostDemandKr: replaySummary.totalCostDemandKr,
        deltaCostKr: replaySummary.deltaCostKr,
        deltaCostPct: replaySummary.deltaCostPct,
        deltaCostVsEmulatedKr: replaySummary.deltaCostVsEmulatedKr,
        deltaCostVsEmulatedPct: replaySummary.deltaCostVsEmulatedPct,
        peakElectricKwBaseline: replaySummary.peakElectricKwBaseline,
        peakElectricKwEmulated: replaySummary.peakElectricKwEmulated,
        peakElectricKwMpc: replaySummary.peakElectricKwMpc,
        controllableElectricKwhBaseline: replaySummary.controllableElectricKwhBaseline,
        controllableElectricKwhEmulated: replaySummary.controllableElectricKwhEmulated,
        controllableElectricKwhMpc: replaySummary.controllableElectricKwhMpc,
        controllableHeatKwhBaseline: replaySummary.controllableHeatKwhBaseline,
        controllableHeatKwhEmulated: replaySummary.controllableHeatKwhEmulated,
        controllableHeatKwhMpc: replaySummary.controllableHeatKwhMpc,
        comfortViolationsMpc: replaySummary.comfortViolationsMpc,
        comfortViolationsBaseline: replaySummary.comfortViolationsBaseline,
        comfortViolationsEmulated: replaySummary.comfortViolationsEmulated,
        comfortViolationsDemand: replaySummary.comfortViolationsDemand,
        fallbackSteps: replaySummary.fallbackSteps,
      },
    });

    expect(audit.checks.find((c) => c.id === "replay_step_rows")?.status).toBe("pass");
    expect(audit.checks.find((c) => c.id === "run_scalars_e2e")?.status).toBe("pass");
    expect(audit.checks.find((c) => c.id === "supervisory_commands")?.status).toBe("pass");
    expect(audit.checks.find((c) => c.id === "bhcc_coverage")?.status).toBe("pass");
    expect(audit.checks.find((c) => c.id === "chart_points")?.status).toBe("pass");
    expect(audit.checks.filter((c) => c.status === "fail").map((c) => c.id)).toEqual([]);
  });

  test("feiler når replay-rader mangler", async () => {
    const { evaluateMpcPipelineDbConsistency } = await import(
      "../evaluate-mpc-pipeline-db-consistency"
    );
    const steps = [step("2026-06-24T10:00:00.000Z")];
    const audit = evaluateMpcPipelineDbConsistency({
      pipelineRunId: "run-1",
      buildingId: "b1",
      evalStart: new Date("2026-06-24T00:00:00.000Z"),
      evalEnd: new Date("2026-06-25T00:00:00.000Z"),
      stepCount: 1,
      energyReconcileSummary: null,
      replaySummary: null,
      replayStepRows: 0,
      supervisoryCommands: 0,
      energyReconcileHours: 0,
      bhccHours: 0,
      steps,
    });

    expect(audit.health).toBe("fail");
    expect(audit.checks.find((c) => c.id === "replay_step_rows")?.status).toBe("fail");
    expect(audit.checks.find((c) => c.id === "bhcc_coverage")?.status).toBe("fail");
  });
});
