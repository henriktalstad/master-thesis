import { describe, expect, test } from "bun:test";
import { analyzeReplayCostDelta } from "@/lib/sd-anlegg/mpc/pipeline/analyze-replay-cost-delta";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function stubStep(overrides: Partial<MpcReplayStep>): MpcReplayStep {
  return {
    t: "2026-06-24T10:00:00.000Z",
    uBmsMeas: null,
    uBmsSim: {
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 30,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    uMpc: {
      supplySetpointC: 17,
      supplyFanPct: 25,
      exhaustFanPct: 25,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    deltaU: {
      supplySetpointC: -1,
      supplyFanPct: -5,
      exhaustFanPct: -5,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    extractTempMeasC: 22,
    extractTempPredC: 22,
    electricKw: 0.2,
    heatKw: 0.05,
    marginalKrPerKwh: 1.2,
    costBaselineKr: 0.08,
    costEmulatedKr: 0.08,
    costMpcKr: 0.07,
    outdoorTempC: 15,
    usedFallback: false,
    proxyElKwhBaseline: 0.05,
    proxyElKwhMpc: 0.045,
    proxyHeatKwhBaseline: 0.01,
    proxyHeatKwhMpc: 0.01,
    ...overrides,
  };
}

describe("analyzeReplayCostDelta", () => {
  test("rapporterer lav Δ når MPC ≈ baseline", () => {
    const steps = [stubStep({}), stubStep({ t: "2026-06-24T10:15:00.000Z" })];
    const diagnosis = analyzeReplayCostDelta({
      steps,
      summary: {
        stepCount: 2,
        totalCostBaselineKr: 0.16,
        totalCostMpcKr: 0.14,
        totalCostEmulatedKr: 0.16,
        deltaCostKr: -0.02,
        deltaCostPct: -12.5,
        deltaCostVsEmulatedKr: -0.02,
        meaningfulDeltaPct: 50,
      },
    });
    expect(diagnosis.explanations.length).toBeGreaterThan(0);
    expect(diagnosis.electricCostSharePct).toBeGreaterThan(50);
  });
});
