import { getSdCoverageThreshold, getMpcMinOptimizablePct } from "@/lib/config/thesis-eval";
import type { EvalDataset } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcEvalCoverageReport } from "./analyze-eval-coverage";
import type { MpcSimulationFailureReason } from "./run-mpc-pipeline-core";

export type MpcSimulationReadiness = {
  canSimulate: boolean;
  reason?: MpcSimulationFailureReason;
  detail?: string;
  blockers: string[];
  thresholdPct: number;
  uMeasPct: number;
  extractTempPct: number;
  optimizablePct?: number;
  stepCount: number;
};

const MIN_EVAL_STEPS = 96;
const MIN_EXTRACT_TEMP_PCT = 0.5;

export function assessMpcSimulationReadiness(input: {
  stepCount: number;
  stepsWithUMeas: number;
  stepsWithExtractTemp?: number;
  uMeasPct: number;
  extractTempPct?: number;
  optimizablePct?: number;
  thresholdPct?: number;
  missingCanonicals?: string[];
  warnLowOptimizable?: boolean;
}): MpcSimulationReadiness {
  const thresholdPct = input.thresholdPct ?? getSdCoverageThreshold();
  const minOptimizablePct = getMpcMinOptimizablePct();
  const extractTempPct = input.extractTempPct ?? 0;
  const optimizablePct = input.optimizablePct;
  const missing = input.missingCanonicals ?? [];
  const blockers: string[] = [];

  if (missing.length > 0) {
    blockers.push(`Mangler Infraspawn-signaler: ${missing.join(", ")}`);
  }
  if (input.stepCount < MIN_EVAL_STEPS) {
    blockers.push(
      `For få eval-steg (${input.stepCount} < ${MIN_EVAL_STEPS}) — utvid eval-vindu eller sync SD`,
    );
  }
  if (input.uMeasPct < thresholdPct) {
    blockers.push(
      `uMeas-dekning ${Math.round(input.uMeasPct * 100)} % under terskel ${Math.round(thresholdPct * 100)} % (målt SP + vifte + varme per steg)`,
    );
  }
  if (extractTempPct < MIN_EXTRACT_TEMP_PCT) {
    blockers.push(
      `extract.temp-dekning ${Math.round(extractTempPct * 100)} % — plant-modell trenger avtrekkstemp.`,
    );
  }
  if (
    input.warnLowOptimizable !== false &&
    optimizablePct != null &&
    optimizablePct < minOptimizablePct
  ) {
    blockers.push(
      `Optimizable-dekning ${Math.round(optimizablePct * 100)} % under mål ${Math.round(minOptimizablePct * 100)} %`,
    );
  }

  let reason: MpcSimulationFailureReason | undefined;
  let detail: string | undefined;

  if (missing.length > 0) {
    reason = "missing_control_signals";
    detail = missing.join(", ");
  } else if (input.stepCount < MIN_EVAL_STEPS) {
    reason = "insufficient_steps";
    detail = `${input.stepCount} steg`;
  } else if (input.uMeasPct < thresholdPct) {
    reason = "insufficient_u_meas_coverage";
    detail = `${Math.round(input.uMeasPct * 100)} % uMeas`;
  } else if (extractTempPct < MIN_EXTRACT_TEMP_PCT) {
    reason = "insufficient_extract_temp_coverage";
    detail = `${Math.round(extractTempPct * 100)} % extract.temp`;
  }

  return {
    canSimulate: blockers.length === 0,
    reason,
    detail,
    blockers,
    thresholdPct,
    uMeasPct: input.uMeasPct,
    extractTempPct,
    stepCount: input.stepCount,
  };
}

export function assessFromCoverageReport(
  report: MpcEvalCoverageReport,
): MpcSimulationReadiness {
  return assessMpcSimulationReadiness({
    stepCount: report.stepCount,
    stepsWithUMeas: report.stepsWithUMeas,
    stepsWithExtractTemp: report.stepsWithExtractTemp,
    uMeasPct: report.uMeasPct,
    extractTempPct: report.extractTempPct,
    optimizablePct: report.optimizablePct,
    thresholdPct: report.thresholdPct,
    missingCanonicals: report.missingCanonicals,
    warnLowOptimizable: false,
  });
}

export function assessFromEvalDataset(
  dataset: EvalDataset,
  options?: { warnLowOptimizable?: boolean },
): MpcSimulationReadiness {
  const { coverage } = dataset;
  const uMeasPct =
    coverage.stepCount > 0
      ? coverage.stepsWithUMeas / coverage.stepCount
      : 0;
  const extractTempPct =
    coverage.stepCount > 0
      ? coverage.stepsWithExtractTemp / coverage.stepCount
      : 0;

  return assessMpcSimulationReadiness({
    stepCount: coverage.stepCount,
    stepsWithUMeas: coverage.stepsWithUMeas,
    stepsWithExtractTemp: coverage.stepsWithExtractTemp,
    uMeasPct,
    extractTempPct,
    optimizablePct: coverage.optimizablePct,
    missingCanonicals: [],
    warnLowOptimizable: options?.warnLowOptimizable ?? true,
  });
}
