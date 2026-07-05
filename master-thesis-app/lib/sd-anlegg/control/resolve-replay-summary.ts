import { normalizeReplaySummary } from "./build-control-strategy-comparison";
import type { MpcPipelineSnapshot } from "./control-types";
import { summarizeMpcReplaySteps } from "./summarize-mpc-replay-steps";
import type { MpcReplayResult, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export const FULL_REPLAY_COVERAGE_RATIO = 0.95;

/** Når færre steg er lastet enn forventet eval, bruk lagrede run-scalars for hero/KPI. */
export function shouldUseReplayStepsForSummary(
  loadedStepCount: number,
  expectedStepCount: number,
): boolean {
  if (loadedStepCount === 0) return false;
  if (expectedStepCount <= 0) return true;
  return loadedStepCount >= expectedStepCount * FULL_REPLAY_COVERAGE_RATIO;
}

export type ResolveReplaySummaryOptions = {
  expectedStepCount?: number;
};

export function resolveReplaySummaryForUi(
  snapshot: MpcPipelineSnapshot["replaySummary"] | null | undefined,
  steps: readonly MpcReplayStep[],
  options?: ResolveReplaySummaryOptions,
): MpcReplayResult["summary"] | null {
  const expectedStepCount =
    options?.expectedStepCount ?? snapshot?.stepCount ?? steps.length;

  if (
    steps.length > 0 &&
    shouldUseReplayStepsForSummary(steps.length, expectedStepCount)
  ) {
    const fresh = summarizeMpcReplaySteps(steps);
    if (fresh) return fresh;
  }

  if (snapshot) return normalizeReplaySummary(snapshot);

  if (steps.length > 0) {
    return summarizeMpcReplaySteps(steps);
  }

  return null;
}

export function isPartialReplayForUi(
  loadedStepCount: number,
  expectedStepCount: number,
): boolean {
  return (
    loadedStepCount > 0 &&
    expectedStepCount > 0 &&
    loadedStepCount < expectedStepCount * FULL_REPLAY_COVERAGE_RATIO
  );
}
