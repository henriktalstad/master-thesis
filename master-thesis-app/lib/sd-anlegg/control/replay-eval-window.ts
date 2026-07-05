import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

/** Steg innen [evalStart, evalEnd) — samme konvensjon som BHCC-timefilter. */
export function filterReplayStepsToEvalWindow(
  steps: readonly MpcReplayStep[],
  evalStart: Date | string,
  evalEnd: Date | string,
): MpcReplayStep[] {
  const startMs = new Date(evalStart).getTime();
  const endMs = new Date(evalEnd).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return [...steps];
  }
  return steps.filter((step) => {
    const t = new Date(step.t).getTime();
    return t >= startMs && t < endMs;
  });
}

export function countReplayStepsOutsideEvalWindow(
  steps: readonly MpcReplayStep[],
  evalStart: Date | string,
  evalEnd: Date | string,
): number {
  const startMs = new Date(evalStart).getTime();
  const endMs = new Date(evalEnd).getTime();
  return steps.filter((step) => {
    const t = new Date(step.t).getTime();
    return t < startMs || t >= endMs;
  }).length;
}
