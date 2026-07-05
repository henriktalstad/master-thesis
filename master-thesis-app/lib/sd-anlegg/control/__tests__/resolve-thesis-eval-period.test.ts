import { describe, expect, test } from "bun:test";
import { resolveThesisEvalPeriod } from "@/lib/sd-anlegg/control/resolve-thesis-eval-period";
import type {
  MpcEvalCoverageSummary,
  MpcPipelineRunRecord,
} from "@/lib/sd-anlegg/control/control-types";

const now = new Date("2025-11-15T12:00:00.000Z");

function mockRun(evalEnd: string, stepCount: number): MpcPipelineRunRecord {
  return {
    id: "run-1",
    snapshot: {
      evalStart: "2025-09-01T00:00:00.000Z",
      evalEnd,
      stepCount,
      replaySummary: null,
    },
  } as MpcPipelineRunRecord;
}

function mockCoverage(evalEnd: string, stepCount: number): MpcEvalCoverageSummary {
  return {
    evalStart: "2025-09-01T00:00:00.000Z",
    evalEnd,
    stepCount,
    stepsWithUMeas: stepCount,
    stepsOptimizable: stepCount,
    optimizablePct: 1,
    uMeasPct: 1,
    extractTempPct: 1,
    thresholdPct: 0.9,
    needsMpcBackfill: false,
    needsPlantBackfill: false,
    needsSampleRefresh: false,
    needsBackfill: false,
    missingCanonicals: [],
    resolvedSignalCount: 10,
    signals: [],
    plantMirrorCoveragePct: 1,
    plantMirrorStart: "2025-09-01T00:00:00.000Z",
    plantMirrorEnd: evalEnd,
    plantSignals: [],
    canSimulate: true,
    evalBeyondInfluxLookback: false,
    influxLookbackHours: 48,
    datasetProvenance: null,
  };
}

describe("resolveThesisEvalPeriod", () => {
  test("prioriterer coverage evalEnd over eldre snapshot", () => {
    const period = resolveThesisEvalPeriod({
      mpcPipelineRun: mockRun("2025-11-01T00:00:00.000Z", 900),
      coverage: mockCoverage(now.toISOString(), 980),
      replayPersistedStepCount: 900,
      now,
    });

    expect(period?.evalEnd).toBe(now.toISOString());
    expect(period?.stepCount).toBe(980);
    expect(period?.replayStepCount).toBe(900);
    expect(period?.replayBehindEval).toBe(true);
  });

  test("capper evalEnd til nå når coverage er frem i tid", () => {
    const period = resolveThesisEvalPeriod({
      mpcPipelineRun: null,
      coverage: mockCoverage("2025-12-01T00:00:00.000Z", 999),
      now,
    });

    expect(period?.evalEnd).toBe(now.toISOString());
  });

  test("fallback til snapshot uten coverage", () => {
    const period = resolveThesisEvalPeriod({
      mpcPipelineRun: mockRun("2025-11-10T00:00:00.000Z", 950),
      coverage: null,
      now,
    });

    expect(period?.evalEnd).toBe("2025-11-10T00:00:00.000Z");
    expect(period?.replayBehindEval).toBe(false);
  });
});
