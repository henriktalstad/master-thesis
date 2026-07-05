import { describe, expect, test } from "bun:test";
import { resolvePipelineStatus } from "@/lib/sd-anlegg/control/resolve-pipeline-status";
import type { MpcEvalCoverageSummary } from "@/lib/sd-anlegg/control/control-types";

const baseCoverage: MpcEvalCoverageSummary = {
  evalStart: "2026-06-19T00:00:00.000Z",
  evalEnd: "2026-07-03T00:00:00.000Z",
  stepCount: 999,
  stepsWithUMeas: 950,
  stepsOptimizable: 900,
  optimizablePct: 0.9,
  uMeasPct: 0.95,
  extractTempPct: 0.9,
  thresholdPct: 0.8,
  needsMpcBackfill: false,
  needsPlantBackfill: false,
  needsSampleRefresh: false,
  needsBackfill: false,
  missingCanonicals: [],
  resolvedSignalCount: 10,
  signals: [],
  plantMirrorCoveragePct: 0.9,
  plantMirrorStart: "",
  plantMirrorEnd: "",
  plantSignals: [],
  canSimulate: true,
  evalBeyondInfluxLookback: false,
  influxLookbackHours: 48,
  datasetProvenance: null,
};

describe("resolvePipelineStatus", () => {
  test("awaiting_simulation når data er klare uten run", () => {
    const status = resolvePipelineStatus({
      mpcEvalCoverage: baseCoverage,
      mpcReadiness: { canSimulate: true, blockers: [], thresholdPct: 0.8, uMeasPct: 0.95, extractTempPct: 0.9, stepCount: 999 },
      simulationProgress: null,
      hasMpcRun: false,
      backgroundEnsureScheduled: false,
    });

    expect(status.phase).toBe("awaiting_simulation");
    expect(status.steps.find((s) => s.id === "simulation")?.state).toBe("warn");
  });

  test("partial_replay ved 128 av 999", () => {
    const status = resolvePipelineStatus({
      mpcEvalCoverage: baseCoverage,
      mpcReadiness: { canSimulate: true, blockers: [], thresholdPct: 0.8, uMeasPct: 0.95, extractTempPct: 0.9, stepCount: 999 },
      simulationProgress: null,
      hasMpcRun: true,
      backgroundEnsureScheduled: false,
      replayDisplay: {
        incomplete: true,
        persistedStepCount: 128,
        expectedStepCount: 999,
      },
    });

    expect(status.phase).toBe("partial_replay");
    expect(status.headline).toBe("Delvis simulering");
    expect(status.progressPct).toBe(13);
    expect(status.steps.find((s) => s.id === "replay")?.state).toBe("warn");
    expect(status.steps.find((s) => s.id === "replay")?.label).toBe("Analyse");
  });

  test("grafer mangler når simulering er ferdig uten chart-artifacts", () => {
    const status = resolvePipelineStatus({
      mpcEvalCoverage: baseCoverage,
      mpcReadiness: { canSimulate: true, blockers: [], thresholdPct: 0.8, uMeasPct: 0.95, extractTempPct: 0.9, stepCount: 999 },
      simulationProgress: null,
      hasMpcRun: true,
      backgroundEnsureScheduled: false,
      replayDisplay: {
        incomplete: false,
        persistedStepCount: 804,
        expectedStepCount: 804,
      },
      runArtifacts: {
        persistStatus: "COMPLETE",
        chartsGeneratedAt: null,
      },
    });

    expect(status.phase).toBe("partial_replay");
    expect(status.headline).toBe("Grafer mangler");
    expect(status.progressPct).toBeNull();
  });

  test("ready når replay og artifacts er komplette", () => {
    const status = resolvePipelineStatus({
      mpcEvalCoverage: baseCoverage,
      mpcReadiness: { canSimulate: true, blockers: [], thresholdPct: 0.8, uMeasPct: 0.95, extractTempPct: 0.9, stepCount: 999 },
      simulationProgress: null,
      hasMpcRun: true,
      backgroundEnsureScheduled: false,
      replayDisplay: {
        incomplete: false,
        persistedStepCount: 999,
        expectedStepCount: 999,
      },
      runArtifacts: {
        persistStatus: "COMPLETE",
        chartsGeneratedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    expect(status.phase).toBe("ready");
    expect(status.steps.find((s) => s.id === "replay")?.state).toBe("done");
  });

  test("simulating med fremdrift", () => {
    const status = resolvePipelineStatus({
      mpcEvalCoverage: baseCoverage,
      mpcReadiness: null,
      simulationProgress: {
        status: "running",
        stepIndex: 200,
        stepTotal: 999,
        message: "Simulerer …",
        startedAt: null,
        updatedAt: null,
        activePipelineRunId: null,
        pct: 20,
      },
      hasMpcRun: false,
      backgroundEnsureScheduled: false,
    });

    expect(status.phase).toBe("simulating");
    expect(status.progressPct).toBe(20);
  });
});
