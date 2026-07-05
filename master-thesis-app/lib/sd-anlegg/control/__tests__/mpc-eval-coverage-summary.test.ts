import { describe, expect, test } from "bun:test";
import { toMpcEvalCoverageSummary } from "@/lib/sd-anlegg/control/mpc-eval-coverage-summary";
import type { MpcEvalCoverageReport } from "@/services/mpc/analyze-eval-coverage";

function baseReport(
  overrides: Partial<MpcEvalCoverageReport> = {},
): MpcEvalCoverageReport {
  return {
    buildingId: "b1",
    sourceId: "s1",
    evalStart: "2026-06-16T00:00:00.000Z",
    evalEnd: "2026-06-29T00:00:00.000Z",
    stepCount: 100,
    stepsWithUMeas: 95,
    stepsOptimizable: 90,
    optimizablePct: 0.9,
    stepsWithExtractTemp: 80,
    stepsWithOutdoorTemp: 100,
    stepsWithPrice: 100,
    uMeasPct: 0.95,
    extractTempPct: 0.8,
    thresholdPct: 0.85,
    needsBackfill: false,
    needsMpcBackfill: false,
    needsPlantBackfill: false,
    needsSampleRefresh: false,
    resolvedSignalCount: 9,
    missingCanonicals: [],
    signals: [],
    plantMirrorCoveragePct: 0.95,
    plantMirrorStart: "2026-06-27T00:00:00.000Z",
    plantMirrorEnd: "2026-06-30T00:00:00.000Z",
    plantSignals: [],
    datasetProvenance: null,
    ...overrides,
  };
}

describe("toMpcEvalCoverageSummary", () => {
  test("canSimulate når dekning er tilstrekkelig", () => {
    const summary = toMpcEvalCoverageSummary(baseReport());
    expect(summary.canSimulate).toBe(true);
    expect(summary.blockReason).toBeNull();
  });

  test("blockReason når canonical mangler", () => {
    const summary = toMpcEvalCoverageSummary(
      baseReport({
        stepsWithUMeas: 10,
        uMeasPct: 0.1,
        missingCanonicals: ["supply_setpoint"],
      }),
    );
    expect(summary.canSimulate).toBe(false);
    expect(summary.blockReason).toBeTruthy();
  });

  test("needsBackfill når plant-speil er under terskel", () => {
    const summary = toMpcEvalCoverageSummary(
      baseReport({
        needsBackfill: true,
        needsMpcBackfill: false,
        needsPlantBackfill: true,
        plantMirrorCoveragePct: 0.4,
        plantSignals: [
          {
            canonicalId: "heat_recovery.after_temp",
            objectId: "AV-40325",
            sampleBucketCount: 40,
            expectedBucketCount: 192,
            coveragePct: 0.4,
          },
        ],
      }),
    );
    expect(summary.needsBackfill).toBe(true);
    expect(summary.needsPlantBackfill).toBe(true);
    expect(summary.needsMpcBackfill).toBe(false);
    expect(summary.canSimulate).toBe(true);
  });
});
