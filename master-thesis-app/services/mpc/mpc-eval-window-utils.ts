import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import { parseThesisEnvEndDate } from "@/lib/config/thesis-eval";
import {
  assessMpcStepValidity,
  countOptimizableSteps,
} from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";

const MPC_STEP_MS = 15 * 60 * 1000;
const MIN_EVAL_STEPS = 96;

/** Konfigurert eval-start/slutt — slutt ruller til nå når THESIS_EVAL_END mangler. */
export function resolveConfiguredEvalWindow(input: {
  evalStart?: Date;
  evalEnd?: Date;
  thesisStart?: Date | null;
  thesisEnd?: Date | null;
  now?: Date;
}): { evalStart: Date; evalEnd: Date } {
  const now = input.now ?? new Date();
  const evalStart =
    input.evalStart ??
    input.thesisStart ??
    new Date(now.getTime() - 14 * 86400000);
  let evalEnd = input.evalEnd ?? input.thesisEnd ?? now;
  if (evalEnd.getTime() > now.getTime()) {
    evalEnd = now;
  }
  return { evalStart, evalEnd };
}

/** Konfigurert evalEnd med inkluderende THESIS_EVAL_END-dag når env er satt. */
export function resolveConfiguredEvalEndFromEnv(now: Date = new Date()): Date {
  const thesisEnd = parseThesisEnvEndDate(process.env.THESIS_EVAL_END);
  if (!thesisEnd) return now;
  return thesisEnd.getTime() > now.getTime() ? now : thesisEnd;
}

/** Klipp evalEnd til siste steg med uMeas i et allerede lastet datasett. */
export function trimEvalEndToLastUMeasStep(input: {
  evalEnd: Date;
  steps: readonly { t: string; uMeas?: unknown | null }[];
}): { evalEnd: Date; trimmed: boolean } {
  const withMeas = input.steps.filter((s) => s.uMeas);
  if (withMeas.length === 0) {
    return { evalEnd: input.evalEnd, trimmed: false };
  }
  const lastStepEnd = new Date(
    new Date(withMeas[withMeas.length - 1]!.t).getTime() + MPC_STEP_MS,
  );
  if (lastStepEnd.getTime() >= input.evalEnd.getTime()) {
    return { evalEnd: input.evalEnd, trimmed: false };
  }
  return { evalEnd: lastStepEnd, trimmed: true };
}

export function sdStepEndFromSample(sampleAt: Date): Date {
  return new Date(sampleAt.getTime() + MPC_STEP_MS);
}

/**
 * Fjern påfølgende fallback-steg fra slutten (alarm/pumpe-feil-hale).
 */
export function trimEvalEndTrailingFallbackSuffix(input: {
  evalEnd: Date;
  steps: readonly MpcTimestep[];
  minSteps?: number;
}): {
  evalEnd: Date;
  steps: MpcTimestep[];
  trimmed: boolean;
  optimizablePct: number;
} {
  const minSteps = input.minSteps ?? MIN_EVAL_STEPS;
  let steps = [...input.steps];
  if (steps.length === 0) {
    return { evalEnd: input.evalEnd, steps, trimmed: false, optimizablePct: 0 };
  }

  let trimmed = false;
  while (steps.length > minSteps) {
    const last = steps[steps.length - 1]!;
    if (assessMpcStepValidity(last).canOptimize) break;
    steps = steps.slice(0, -1);
    trimmed = true;
  }

  const { optimizablePct } = countOptimizableSteps(steps);
  if (!trimmed) {
    return { evalEnd: input.evalEnd, steps, trimmed: false, optimizablePct };
  }

  const last = steps[steps.length - 1]!;
  const evalEnd = new Date(new Date(last.t).getTime() + MPC_STEP_MS);
  return { evalEnd, steps, trimmed: true, optimizablePct };
}

/** Klipp kun påfølgende fallback-hale — ikke globale optimizable-krav. */
export function trimEvalEndToMinOptimizablePct(input: {
  evalEnd: Date;
  steps: readonly MpcTimestep[];
  minOptimizablePct: number;
  minSteps?: number;
}): {
  evalEnd: Date;
  steps: MpcTimestep[];
  trimmed: boolean;
  optimizablePct: number;
} {
  void input.minOptimizablePct;
  return trimEvalEndTrailingFallbackSuffix({
    evalEnd: input.evalEnd,
    steps: input.steps,
    minSteps: input.minSteps,
  });
}
