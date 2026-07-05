import { resolveEffectiveEvalWindowForMpc } from "./resolve-effective-eval-window";
import { loadEvalDatasetForMpc } from "./load-eval-dataset";
import { readMetricsSummarySnapshot } from "@/lib/thesis-export/assert-thesis-report-alignment";

export type ThesisEvalStepsForSweep = {
  steps: NonNullable<Awaited<ReturnType<typeof loadEvalDatasetForMpc>>>["steps"];
  evalStart: Date;
  evalEnd: Date;
  stepCount: number;
  windowActions: string[];
};

function stepTimeMs(step: { t: string; tMs?: number }): number {
  if (typeof step.tMs === "number" && Number.isFinite(step.tMs)) return step.tMs;
  const parsed = Date.parse(step.t);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function trimStepsToFrozenThesisWindow<
  T extends { t: string; tMs?: number },
>(steps: readonly T[], input: {
  evalEnd: Date;
  targetStepCount?: number;
}): { steps: T[]; action?: string } {
  const endMs = input.evalEnd.getTime() + 15 * 60_000;
  let trimmed = steps.filter((s) => stepTimeMs(s) < endMs);
  if (
    input.targetStepCount != null &&
    input.targetStepCount > 0 &&
    trimmed.length > input.targetStepCount
  ) {
    trimmed = trimmed.slice(0, input.targetStepCount);
  }
  if (trimmed.length === steps.length) {
    return { steps: [...trimmed] };
  }
  return {
    steps: [...trimmed],
    action: `Eval-trim til frosset thesis-vindu (${trimmed.length}/${steps.length} steg, slutt ${input.evalEnd.toISOString().slice(0, 16).replace("T", " ")})`,
  };
}

function resolveEvalEndFromSteps(
  steps: readonly { t: string; tMs?: number }[],
  fallback: Date,
): Date {
  const last = steps[steps.length - 1];
  if (!last) return fallback;
  const lastMs = stepTimeMs(last);
  if (!Number.isFinite(lastMs)) return fallback;
  return new Date(lastMs + 15 * 60_000);
}

/**
 * Samme eval-vindu og trim som thesis-mpc — brukes av tuning/sensitivitet
 * slik at appendix-steg matcher canonical export (804 × 15 min).
 */
export async function loadThesisEvalStepsForSweep(input: {
  buildingSlug: string;
}): Promise<ThesisEvalStepsForSweep | null> {
  const metrics = await readMetricsSummarySnapshot();
  const frozenEnd = metrics?.evalEnd ? new Date(metrics.evalEnd) : null;
  const frozenStepCount = metrics?.replaySummary?.stepCount;

  const resolved = await resolveEffectiveEvalWindowForMpc({
    buildingSlug: input.buildingSlug,
  });
  const dataset = await loadEvalDatasetForMpc({
    buildingSlug: input.buildingSlug,
    evalStart: resolved.evalStart,
    evalEnd: resolved.evalEnd,
  });
  if (!dataset || dataset.steps.length < 96) return null;

  const windowActions = [...resolved.actions];
  let steps = dataset.steps;
  let evalStart = resolved.evalStart;
  let evalEnd = resolved.evalEnd;

  if (frozenStepCount && frozenStepCount > 0 && dataset.steps.length >= frozenStepCount) {
    steps = dataset.steps.slice(0, frozenStepCount);
    windowActions.push(
      `Trimmet til ${frozenStepCount} steg (metrics_summary canonical export)`,
    );
    evalEnd =
      frozenEnd && !Number.isNaN(frozenEnd.getTime())
        ? frozenEnd
        : resolveEvalEndFromSteps(steps, resolved.evalEnd);
  } else if (frozenEnd && frozenStepCount && frozenStepCount > 0) {
    const frozen = trimStepsToFrozenThesisWindow(steps, {
      evalEnd: frozenEnd,
      targetStepCount: frozenStepCount,
    });
    if (frozen.action) windowActions.push(frozen.action);
    if (frozen.steps.length >= 96) {
      steps = frozen.steps;
      evalEnd = resolveEvalEndFromSteps(steps, frozenEnd);
    }
  }

  if (steps.length < 96) return null;

  if (Number.isNaN(evalEnd.getTime())) {
    evalEnd = resolveEvalEndFromSteps(steps, resolved.evalEnd);
  }
  if (metrics?.evalStart) {
    const frozenStart = new Date(metrics.evalStart);
    if (!Number.isNaN(frozenStart.getTime())) {
      evalStart = frozenStart;
    }
  }

  return {
    steps,
    evalStart,
    evalEnd,
    stepCount: steps.length,
    windowActions,
  };
}
