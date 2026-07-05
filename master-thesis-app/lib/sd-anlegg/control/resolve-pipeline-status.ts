import { FULL_REPLAY_COVERAGE_RATIO } from "./resolve-replay-summary";
import { isPipelineRunPersistentlyComplete } from "./pipeline-run-completeness-logic";
import type { MpcEvalCoverageSummary } from "./control-types";
import type { MpcSimulationProgress } from "./mpc-simulation-progress";
import type { MpcSimulationReadiness } from "@/services/mpc/assess-mpc-simulation-readiness";
import { CONTROL_PIPELINE_UI } from "./control-display-labels";

export type PipelinePhase =
  | "blocked"
  | "backfill"
  | "scheduled"
  | "awaiting_simulation"
  | "simulating"
  | "simulation_stale"
  | "simulation_failed"
  | "partial_replay"
  | "ready";

export type PipelineStepId = "coverage" | "data" | "simulation" | "replay";

export type PipelineStepState = "pending" | "active" | "done" | "warn" | "error";

export type PipelineStep = {
  id: PipelineStepId;
  label: string;
  state: PipelineStepState;
};

export type PipelineStatus = {
  phase: PipelinePhase;
  headline: string;
  detail: string | null;
  steps: PipelineStep[];
  progressPct: number | null;
  persistedSteps: number | null;
  expectedSteps: number | null;
  simulationStepIndex: number | null;
  simulationStepTotal: number | null;
  canSimulate: boolean;
  needsBackfill: boolean;
  backgroundScheduled: boolean;
  canResumeSimulation: boolean;
  simulationStale: boolean;
  blockers: string[];
};

export type ResolvePipelineStatusInput = {
  mpcEvalCoverage: MpcEvalCoverageSummary | null;
  mpcReadiness: MpcSimulationReadiness | null;
  simulationProgress: MpcSimulationProgress | null;
  hasMpcRun: boolean;
  backgroundEnsureScheduled: boolean;
  replayDisplay?: {
    incomplete: boolean;
    persistedStepCount: number;
    expectedStepCount: number;
  } | null;
  runArtifacts?: {
    persistStatus: string | null;
    chartsGeneratedAt: string | null;
  } | null;
};

function formatPct(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function needsBackfillFromCoverage(coverage: MpcEvalCoverageSummary): boolean {
  return coverage.needsBackfill || coverage.needsSampleRefresh;
}

function isPartialReplay(persisted: number, expected: number): boolean {
  return (
    persisted > 0 &&
    expected > 0 &&
    persisted < expected * FULL_REPLAY_COVERAGE_RATIO
  );
}

function artifactsReady(input: ResolvePipelineStatusInput): boolean {
  return (
    input.runArtifacts?.persistStatus === "COMPLETE" &&
    input.runArtifacts?.chartsGeneratedAt != null
  );
}

function coverageStepState(input: ResolvePipelineStatusInput): PipelineStepState {
  if (!input.mpcEvalCoverage) return "pending";
  if (input.mpcEvalCoverage.canSimulate) return "done";
  return "error";
}

function dataStepState(input: ResolvePipelineStatusInput): PipelineStepState {
  if (!input.mpcEvalCoverage) return "pending";
  if (needsBackfillFromCoverage(input.mpcEvalCoverage)) {
    return input.backgroundEnsureScheduled ? "active" : "warn";
  }
  if (input.mpcEvalCoverage.canSimulate) return "done";
  return "pending";
}

function simulationStepState(
  input: ResolvePipelineStatusInput,
  phase: PipelinePhase,
): PipelineStepState {
  if (phase === "simulating" || phase === "scheduled") return "active";
  if (phase === "simulation_stale" || phase === "simulation_failed") return "error";
  if (input.hasMpcRun || phase === "partial_replay" || phase === "ready") return "done";
  if (phase === "awaiting_simulation" && input.mpcEvalCoverage?.canSimulate) return "warn";
  return "pending";
}

function replayStepState(
  input: ResolvePipelineStatusInput,
  phase: PipelinePhase,
): PipelineStepState {
  if (phase === "ready") return "done";
  if (phase === "partial_replay") return "warn";
  if (phase === "simulating" || phase === "simulation_stale") return "pending";
  if (phase === "simulation_failed") {
    const meta = input.replayDisplay;
    if (meta && meta.persistedStepCount > 0) return "warn";
    return "pending";
  }
  if (input.hasMpcRun) return "warn";
  return "pending";
}

function buildSteps(
  input: ResolvePipelineStatusInput,
  phase: PipelinePhase,
): PipelineStep[] {
  return [
    { id: "coverage", label: CONTROL_PIPELINE_UI.stepCoverage, state: coverageStepState(input) },
    { id: "data", label: CONTROL_PIPELINE_UI.stepData, state: dataStepState(input) },
    {
      id: "simulation",
      label: CONTROL_PIPELINE_UI.stepSimulation,
      state: simulationStepState(input, phase),
    },
    {
      id: "replay",
      label: CONTROL_PIPELINE_UI.stepResults,
      state: replayStepState(input, phase),
    },
  ];
}

/** Én sannhet for eval-pipeline — dekning, backfill, simulering og analyse. */
export function resolvePipelineStatus(
  input: ResolvePipelineStatusInput,
): PipelineStatus {
  const coverage = input.mpcEvalCoverage;
  const progress = input.simulationProgress;
  const blockers = input.mpcReadiness?.blockers ?? [];
  const canSimulate = coverage?.canSimulate ?? false;
  const needsBackfill = coverage ? needsBackfillFromCoverage(coverage) : false;
  const meta = input.replayDisplay;
  const persistedSteps = meta?.persistedStepCount ?? null;
  const expectedSteps = meta?.expectedStepCount ?? coverage?.stepCount ?? null;

  const canResumeSimulation =
    progress?.status === "failed" &&
    meta != null &&
    meta.persistedStepCount > 0 &&
    meta.persistedStepCount < meta.expectedStepCount;

  let phase: PipelinePhase = "blocked";
  let headline = "Laster status …";
  let detail: string | null = null;
  let progressPct: number | null = null;

  if (progress?.status === "running") {
    if (progress.stale) {
      phase = "simulation_stale";
      headline = CONTROL_PIPELINE_UI.simulationStale;
      detail =
        progress.message ??
        (progress.stepTotal > 0
          ? `${progress.stepIndex} av ${progress.stepTotal} intervaller — sannsynlig tidsavbrudd`
          : "Ingen fremdrift på lenge");
      progressPct = progress.pct;
    } else {
      phase = "simulating";
      headline = progress.message ?? CONTROL_PIPELINE_UI.simulationRunning;
      detail =
        progress.stepTotal > 0
          ? `${progress.stepIndex} av ${progress.stepTotal} intervaller`
          : null;
      progressPct = progress.pct;
    }
  } else if (progress?.status === "failed") {
    phase = "simulation_failed";
    headline = canResumeSimulation
      ? CONTROL_PIPELINE_UI.simulationPaused
      : CONTROL_PIPELINE_UI.simulationFailed;
    detail = canResumeSimulation
      ? CONTROL_PIPELINE_UI.simulationPausedDetail(
          meta!.persistedStepCount,
          meta!.expectedStepCount,
        )
      : progress.message ?? null;
    progressPct =
      canResumeSimulation && (progress.pct ?? 0) > 0 ? progress.pct : null;
  } else if (input.backgroundEnsureScheduled && !canSimulate) {
    phase = "scheduled";
    headline = CONTROL_PIPELINE_UI.pipelineScheduled;
    detail = CONTROL_PIPELINE_UI.pipelineScheduledDetail;
  } else if (!coverage) {
    phase = "blocked";
    headline = "Laster evalueringsdekning …";
  } else if (!canSimulate) {
    phase = "blocked";
    headline =
      blockers.length > 0
        ? blockers.length > 1
          ? `${blockers[0]} (+${blockers.length - 1} til)`
          : blockers[0]!
        : coverage.blockReason ??
          `Målt SD-dekning ${formatPct(coverage.uMeasPct)} — trenger minst ${formatPct(coverage.thresholdPct)}`;
    detail = blockers.length > 1 ? blockers.slice(1).join(" · ") : null;
  } else if (needsBackfill) {
    phase = "backfill";
    headline = CONTROL_PIPELINE_UI.needsSdData;
    detail = coverage.needsSampleRefresh
      ? CONTROL_PIPELINE_UI.staleSamples
      : CONTROL_PIPELINE_UI.missingMeasuredControl;
  } else if (!input.hasMpcRun) {
    phase = "awaiting_simulation";
    headline = CONTROL_PIPELINE_UI.awaitingSimulation;
    detail = CONTROL_PIPELINE_UI.awaitingSimulationDetail(coverage.stepCount);
  } else if (
    meta?.incomplete &&
    persistedSteps != null &&
    expectedSteps != null &&
    isPartialReplay(persistedSteps, expectedSteps)
  ) {
    phase = "partial_replay";
    headline = CONTROL_PIPELINE_UI.partialSimulation;
    detail = CONTROL_PIPELINE_UI.partialSimulationDetail(
      persistedSteps,
      expectedSteps,
    );
    progressPct =
      expectedSteps > 0
        ? Math.min(100, Math.round((persistedSteps / expectedSteps) * 100))
        : null;
  } else if (
    input.hasMpcRun &&
    persistedSteps != null &&
    expectedSteps != null &&
    isPipelineRunPersistentlyComplete({
      expectedStepCount: expectedSteps,
      persistedStepCount: persistedSteps,
    }) &&
    artifactsReady(input)
  ) {
    phase = "ready";
    headline = CONTROL_PIPELINE_UI.ready;
    detail = CONTROL_PIPELINE_UI.readyDetail(expectedSteps);
  } else if (input.hasMpcRun) {
    phase = "partial_replay";
    headline = CONTROL_PIPELINE_UI.chartsMissing;
    detail = CONTROL_PIPELINE_UI.chartsMissingDetail;
    progressPct = null;
  }

  return {
    phase,
    headline,
    detail,
    steps: buildSteps(input, phase),
    progressPct,
    persistedSteps,
    expectedSteps,
    simulationStepIndex: progress?.stepIndex ?? null,
    simulationStepTotal: progress?.stepTotal ?? null,
    canSimulate,
    needsBackfill,
    backgroundScheduled: input.backgroundEnsureScheduled,
    canResumeSimulation,
    simulationStale: progress?.stale ?? false,
    blockers,
  };
}
