import { assessFromCoverageReport } from "@/services/mpc/assess-mpc-simulation-readiness";
import type { MpcEvalCoverageReport } from "@/services/mpc/analyze-eval-coverage";
import {
  evalStartsBeforeInfluxLookback,
  resolveInfluxMaxLookbackHours,
} from "@/lib/infraspawn/influx-lookback";
import type { MpcEvalCoverageSummary } from "./control-types";
import type { MpcSimulationReadiness } from "@/services/mpc/assess-mpc-simulation-readiness";

export function toMpcEvalCoverageSummary(
  report: MpcEvalCoverageReport,
): MpcEvalCoverageSummary {
  const readiness = assessFromCoverageReport(report);
  return {
    evalStart: report.evalStart,
    evalEnd: report.evalEnd,
    stepCount: report.stepCount,
    stepsWithUMeas: report.stepsWithUMeas,
    stepsOptimizable: report.stepsOptimizable,
    optimizablePct: report.optimizablePct,
    uMeasPct: report.uMeasPct,
    extractTempPct: report.extractTempPct,
    thresholdPct: report.thresholdPct,
    needsMpcBackfill: report.needsMpcBackfill,
    needsPlantBackfill: report.needsPlantBackfill,
    needsSampleRefresh: report.needsSampleRefresh,
    needsBackfill: report.needsBackfill,
    missingCanonicals: report.missingCanonicals,
    resolvedSignalCount: report.resolvedSignalCount,
    signals: report.signals.map((s) => ({
      canonicalId: s.canonicalId,
      sampleStepCount: s.sampleStepCount,
      coveragePct:
        report.stepCount > 0 ? s.sampleStepCount / report.stepCount : 0,
    })),
    plantMirrorCoveragePct: report.plantMirrorCoveragePct,
    plantMirrorStart: report.plantMirrorStart,
    plantMirrorEnd: report.plantMirrorEnd,
    plantSignals: report.plantSignals.map((signal) => ({
      canonicalId: signal.canonicalId,
      sampleBucketCount: signal.sampleBucketCount,
      expectedBucketCount: signal.expectedBucketCount,
      coveragePct: signal.coveragePct,
    })),
    canSimulate: readiness.canSimulate,
    blockReason: readiness.canSimulate ? null : (readiness.blockers[0] ?? null),
    evalBeyondInfluxLookback: evalStartsBeforeInfluxLookback(
      new Date(report.evalStart),
    ),
    influxLookbackHours: resolveInfluxMaxLookbackHours(),
    datasetProvenance: report.datasetProvenance ?? null,
  };
}

export function readinessFromCoverageSummary(
  summary: MpcEvalCoverageSummary | null,
): MpcSimulationReadiness | null {
  if (!summary) return null;
  return assessFromCoverageReport({
    buildingId: "",
    sourceId: "",
    evalStart: summary.evalStart,
    evalEnd: summary.evalEnd,
    stepCount: summary.stepCount,
    stepsWithUMeas: summary.stepsWithUMeas,
    stepsOptimizable: summary.stepsOptimizable,
    optimizablePct: summary.optimizablePct,
    stepsWithExtractTemp: Math.round(summary.extractTempPct * summary.stepCount),
    stepsWithOutdoorTemp: 0,
    stepsWithPrice: 0,
    uMeasPct: summary.uMeasPct,
    extractTempPct: summary.extractTempPct,
    thresholdPct: summary.thresholdPct,
    needsMpcBackfill: summary.needsMpcBackfill,
    needsPlantBackfill: summary.needsPlantBackfill,
    needsSampleRefresh: summary.needsSampleRefresh,
    needsBackfill: summary.needsBackfill,
    resolvedSignalCount: summary.resolvedSignalCount,
    missingCanonicals: summary.missingCanonicals,
    signals: summary.signals.map((s) => ({
      canonicalId: s.canonicalId,
      objectId: "",
      sampleStepCount: s.sampleStepCount,
    })),
    plantMirrorCoveragePct: summary.plantMirrorCoveragePct,
    plantMirrorStart: summary.plantMirrorStart,
    plantMirrorEnd: summary.plantMirrorEnd,
    plantSignals: summary.plantSignals.map((signal) => ({
      canonicalId: signal.canonicalId,
      objectId: "",
      sampleBucketCount: signal.sampleBucketCount,
      expectedBucketCount: signal.expectedBucketCount,
      coveragePct: signal.coveragePct,
    })),
    datasetProvenance: summary.datasetProvenance,
  });
}
