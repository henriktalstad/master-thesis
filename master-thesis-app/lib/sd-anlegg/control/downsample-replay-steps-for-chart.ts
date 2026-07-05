import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

/** Maks punkter i Over tid-graf — full serie beholdes i Detalj-tabell. */
export const LOOP_CHART_MAX_POINTS = 400;

/**
 * Uniform downsampling for chart rendering — beholder første, siste og jevn stride.
 */
export function downsampleReplayStepsForChart(
  steps: readonly MpcReplayStep[],
  maxPoints = LOOP_CHART_MAX_POINTS,
): MpcReplayStep[] {
  if (steps.length <= maxPoints) return [...steps];

  const stride = Math.ceil(steps.length / maxPoints);
  const sampled: MpcReplayStep[] = [];
  for (let i = 0; i < steps.length; i += stride) {
    sampled.push(steps[i]!);
  }

  const last = steps[steps.length - 1]!;
  if (sampled[sampled.length - 1]?.t !== last.t) {
    sampled.push(last);
  }

  return sampled;
}

export function loopChartDownsampleNote(
  shownCount: number,
  totalCount: number,
): string | null {
  if (shownCount >= totalCount) return null;
  return `Viser ${shownCount.toLocaleString("nb-NO")} av ${totalCount.toLocaleString("nb-NO")} punkter i grafen — full serie i Detalj.`;
}
