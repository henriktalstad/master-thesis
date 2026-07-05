import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { ControlPeriodMode } from "./resolve-control-lookback";

export type ControlLoopDisplaySource = "live-replay" | "eval-replay";

export type ControlLoopDisplayResolution = {
  steps: MpcReplayStep[];
  source: ControlLoopDisplaySource;
  /** Andel av forventede 15-min-intervaller i tidsrommet (0–1). */
  coverageRatio: number;
  coverageHint: string | null;
};

const STEP_MS = 15 * 60_000;

/** Maks tidshull (ms) før vi anser serien som brutt. */
export function maxControlLoopGapMs(stepMinutes: number): number {
  const stepMs = stepMinutes * 60_000;
  return Math.max(stepMs * 2.5, 75 * 60_000);
}

function sortStepsByTime(steps: readonly MpcReplayStep[]): MpcReplayStep[] {
  return [...steps].sort(
    (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime(),
  );
}

/**
 * Fjern kun ledende orphan-blokk før første store tidshull.
 * Beholder resten av lookback-vinduet (inkl. interne hull — graf bryter linjer).
 */
export function trimLeadingGapOnly(
  steps: readonly MpcReplayStep[],
  stepMinutes = 15,
): MpcReplayStep[] {
  if (steps.length <= 1) return [...steps];

  const sorted = sortStepsByTime(steps);
  const maxGapMs = maxControlLoopGapMs(stepMinutes);

  for (let i = 1; i < sorted.length; i++) {
    const prevMs = new Date(sorted[i - 1]!.t).getTime();
    const currMs = new Date(sorted[i]!.t).getTime();
    if (
      Number.isFinite(prevMs) &&
      Number.isFinite(currMs) &&
      currMs - prevMs > maxGapMs
    ) {
      return sorted.slice(i);
    }
  }

  return sorted;
}

/**
 * Behold kun sammenhengende hale til «nå» — dropper alt før siste store tidshull.
 * Brukes kun der seed-fjerning etter siste hull er ønsket (legacy).
 */
export function trimControlLoopStepsToContinuousTail(
  steps: readonly MpcReplayStep[],
  stepMinutes = 15,
): MpcReplayStep[] {
  if (steps.length <= 1) return [...steps];

  const sorted = sortStepsByTime(steps);
  const maxGapMs = maxControlLoopGapMs(stepMinutes);

  let startIndex = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevMs = new Date(sorted[i - 1]!.t).getTime();
    const currMs = new Date(sorted[i]!.t).getTime();
    if (
      Number.isFinite(prevMs) &&
      Number.isFinite(currMs) &&
      currMs - prevMs > maxGapMs
    ) {
      startIndex = i;
    }
  }

  return sorted.slice(startIndex);
}

/** Hvor tett 15-min-dekningen er innenfor første–siste steg. */
export function controlLoopStepDensity(
  steps: readonly MpcReplayStep[],
): number {
  if (steps.length === 0) return 0;
  if (steps.length === 1) return 1;
  const first = new Date(steps[0]!.t).getTime();
  const last = new Date(steps[steps.length - 1]!.t).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) {
    return 1;
  }
  const expected = Math.floor((last - first) / STEP_MS) + 1;
  return Math.min(1, steps.length / Math.max(expected, 1));
}

function buildCoverageHint(
  steps: readonly MpcReplayStep[],
  ratio: number,
): string | null {
  if (steps.length < 2 || ratio >= 0.85) return null;
  const first = new Date(steps[0]!.t).getTime();
  const last = new Date(steps[steps.length - 1]!.t).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  const spanHours = Math.round((last - first) / 3_600_000);
  const pct = Math.round(ratio * 100);
  return `${steps.length} intervaller à 15 min over ${spanHours} t (${pct} % dekning) — eldre hull er skjult.`;
}

/**
 * Velger beste 15-min rekke for «Styring over tid».
 * Live DB (`SdAnleggMpcReplayStep`) foretrekkes når dekningen er god;
 * ellers faller vi tilbake til eval-replay (samme kilde som Kontrollsignaler).
 */
export function resolveControlLoopDisplaySteps(
  liveSteps: readonly MpcReplayStep[],
  evalReplayTail: readonly MpcReplayStep[],
  stepMinutes = 15,
  options?: { periodMode?: ControlPeriodMode },
): ControlLoopDisplayResolution {
  if (options?.periodMode === "eval") {
    const steps = sortStepsByTime(evalReplayTail);
    return {
      steps,
      source: "eval-replay",
      coverageRatio: controlLoopStepDensity(steps),
      coverageHint: buildCoverageHint(steps, controlLoopStepDensity(steps)),
    };
  }

  const liveDensity = controlLoopStepDensity(liveSteps);
  const evalDensity = controlLoopStepDensity(evalReplayTail);

  const preferLive =
    liveSteps.length > 0 &&
    (evalReplayTail.length === 0 ||
      (liveDensity >= 0.5 && liveSteps.length >= evalReplayTail.length * 0.6) ||
      (liveDensity >= evalDensity && liveSteps.length >= evalReplayTail.length * 0.8));

  const rawSteps = preferLive ? [...liveSteps] : [...evalReplayTail];
  const steps = trimLeadingGapOnly(rawSteps, stepMinutes);
  const source: ControlLoopDisplaySource = preferLive
    ? "live-replay"
    : "eval-replay";
  const coverageRatio = controlLoopStepDensity(steps);

  return {
    steps,
    source,
    coverageRatio,
    coverageHint: buildCoverageHint(steps, coverageRatio),
  };
}
