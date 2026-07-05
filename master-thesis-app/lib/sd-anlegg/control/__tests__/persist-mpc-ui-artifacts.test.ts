import { describe, expect, test } from "bun:test";
import {
  buildMpcPipelineUiArtifacts,
  parseMpcPipelineUiArtifacts,
} from "@/lib/sd-anlegg/control/persist-mpc-ui-artifacts";
import type { MpcPipelineResult, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function makeStep(): MpcReplayStep {
  return {
    t: "2026-06-25T10:00:00.000Z",
    uBmsMeas: {
      supplySetpointC: 20,
      supplyFanPct: 50,
      exhaustFanPct: 45,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    uBmsSim: {
      supplySetpointC: 20,
      supplyFanPct: 50,
      exhaustFanPct: 45,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    uMpc: {
      supplySetpointC: 19,
      supplyFanPct: 48,
      exhaustFanPct: 44,
      heatingValvePct: 8,
      coolingValvePct: 0,
    },
    deltaU: {
      supplySetpointC: null,
      supplyFanPct: null,
      exhaustFanPct: null,
      heatingValvePct: null,
      coolingValvePct: null,
    },
    extractTempMeasC: 21,
    extractTempPredC: 21,
    extractTempPredEmulatedC: 21,
    electricKw: 0.2,
    heatKw: 0.1,
    marginalKrPerKwh: 1,
    comfortViolation: false,
    usedFallback: false,
    costBaselineKr: 1,
    costEmulatedKr: 1,
    costMpcKr: 0.9,
    proxyElKwhBaseline: 0.05,
    proxyElKwhEmulated: 0.05,
    proxyElKwhMpc: 0.045,
    outdoorTempC: 5,
    priceNokPerKwh: 1,
    spotKrPerKwh: 1,
  };
}

describe("buildMpcPipelineUiArtifacts", () => {
  test("bygger v2 chart bundle, pris/last og verifikasjon", () => {
    const steps = [makeStep()];
    const result = {
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-06-26T00:00:00.000Z",
      replay: {
        steps,
        summary: {
          stepCount: 1,
          fallbackSteps: 0,
          optimizedSteps: 1,
          optimizableSteps: 1,
          optimizablePct: 1,
          fallbackPct: 0,
          skippedSteps: 0,
          comfortViolationsMpc: 0,
          comfortViolationsBaseline: 0,
          totalCostBaselineKr: 1,
          totalCostEmulatedKr: 1,
          totalCostMpcKr: 0.9,
          deltaCostKr: -0.1,
          deltaCostPct: -10,
          peakElectricKwBaseline: 1,
          peakElectricKwMpc: 0.8,
          controllableElectricKwhBaseline: 1,
          controllableElectricKwhMpc: 0.9,
          controllableHeatKwhBaseline: 1,
          controllableHeatKwhMpc: 0.9,
        },
      },
    } as unknown as MpcPipelineResult;

    const artifacts = buildMpcPipelineUiArtifacts({ result, steps });
    expect(artifacts.version).toBe(2);
    expect(artifacts.generatedFromStepCount).toBe(1);
    expect(artifacts.chartBundle.costTimeline.length).toBeGreaterThan(0);
    expect(artifacts.chartBundle.loadProfile[0]?.peakMpcKw).not.toBeNull();
    expect(artifacts.strategyComparison.rows.length).toBeGreaterThan(0);
    expect(artifacts.replaySignalSummary.stepCount).toBe(1);
    expect(artifacts.priceLoadShift.bands.high).toBeDefined();
    expect(artifacts.verification.stepCount).toBe(1);

    const parsed = parseMpcPipelineUiArtifacts(artifacts);
    expect(parsed?.version).toBe(2);
    expect(parsed?.chartBundle.hourTable.length).toBeGreaterThan(0);
  });
});
