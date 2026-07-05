import { describe, expect, it } from "bun:test";
import {
  buildCalibrationSnapshotJson,
  buildHoldoutSplitJson,
  buildModelReadinessJson,
} from "@/lib/thesis-export/build-thesis-export-snapshots";
import type { MpcPipelineRunRecord } from "@/lib/sd-anlegg/control/control-types";

function minimalRun(overrides: Partial<MpcPipelineRunRecord> = {}): MpcPipelineRunRecord {
  return {
    id: "run-test",
    modelVersion: "mpc-v1.1-building",
    evalStart: "2026-06-24T00:00:00.000Z",
    evalEnd: "2026-07-03T23:45:00.000Z",
    stepCount: 804,
    trainStepCount: 562,
    holdoutStepCount: 242,
    createdAt: "2026-07-03T12:00:00.000Z",
    snapshot: {
      modelVersion: "mpc-v1.1-building",
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-07-03T23:45:00.000Z",
      stepCount: 804,
      trainStepCount: 562,
      holdoutStepCount: 242,
      emulatorValidation: {
        comparedSteps: 242,
        mae: {
          supplySetpointC: 0.1,
          supplyFanPct: 1,
          exhaustFanPct: 1,
          heatingValvePct: 1,
          coolingValvePct: 1,
        },
        heatingModeAccuracy: 0.4,
        coolingModeAccuracy: 0.9,
      },
      plantValidation: {
        comparedSteps: 242,
        maeC: 0.8,
        rmseC: 1.2,
      },
      replaySummary: {
        stepCount: 804,
        fallbackSteps: 0,
        optimizablePct: 100,
        fallbackPct: 0,
        comfortViolationsMpc: 231,
        comfortViolationsBaseline: 238,
        totalCostBaselineKr: 558,
        totalCostMpcKr: 547,
        deltaCostKr: -11,
        deltaCostPct: -2,
        peakElectricKwBaseline: 2,
        peakElectricKwMpc: 1.1,
        controllableElectricKwhBaseline: 40,
        controllableElectricKwhMpc: 36,
        controllableHeatKwhBaseline: 700,
        controllableHeatKwhMpc: 694,
      },
    },
    signalComparison: { stepCount: 0, stepMinutes: 15, series: [], defaultSeriesId: null },
    calibration: { power: { version: "power-v3", controllableElectricShare: 0.12, controllableHeatShare: 0.88 } } as MpcPipelineRunRecord["calibration"],
    replaySteps: [
      {
        t: "2026-06-27T10:00:00.000Z",
        uBmsMeas: {
          supplySetpointC: 18,
          supplyFanPct: 0,
          exhaustFanPct: 0,
          heatingValvePct: 0,
          coolingValvePct: 0,
          districtTr002ValvePct: 0,
          districtTr003ValvePct: 0,
        },
        uBmsSim: {} as never,
        uMpc: {} as never,
        uDemand: {} as never,
        costBaselineKr: 0,
        costEmulatedKr: 0,
        costMpcKr: 0,
        costDemandKr: 0,
        usedFallback: false,
      },
    ],
    ...overrides,
  };
}

describe("buildThesisExportSnapshots", () => {
  it("serialiserer calibration og holdout", () => {
    const run = minimalRun();
    const calibration = JSON.parse(buildCalibrationSnapshotJson(run));
    const holdout = JSON.parse(buildHoldoutSplitJson(run));

    expect(calibration.pipelineRunId).toBe("run-test");
    expect(calibration.preferencesSnapshot?.buildingSlug).toBe("sorgenfriveien-32ab");
    expect(holdout.trainStepCount).toBe(562);
    expect(holdout.replayStepCount).toBe(804);
  });

  it("bygger model readiness med bounded plant", () => {
    const readiness = JSON.parse(buildModelReadinessJson(minimalRun()));
    expect(readiness.plantValidation.bounded).toBe(true);
    expect(readiness.replayReadiness.uMeasCoverage.fullVectorSteps).toBe(1);
  });
});
