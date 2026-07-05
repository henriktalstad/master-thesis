export type FillMpcStepGapsOptions = {
  /** Maks antall 15-min-steg som fylles fremover fra siste måling. */
  maxForwardSteps?: number;
  /** Maks antall ledende hull fylles bakover fra første måling. */
  maxBackwardSteps?: number;
};

export type FillMpcStepGapsResult = {
  filled: Map<string, number>;
  filledStepCount: number;
  rawStepCount: number;
};

/**
 * Forward/backward-fill av 15-min-serier på MPC-rutenett.
 * Brukes etter bucketing — nøkler må matche buildMpcTimeGrid / mpcStepKeyFromMs.
 */
export function fillMpcStepGaps(
  grid: readonly string[],
  series: ReadonlyMap<string, number>,
  options: FillMpcStepGapsOptions = {},
): FillMpcStepGapsResult {
  const maxForward = options.maxForwardSteps ?? 4;
  const maxBackward = options.maxBackwardSteps ?? 4;
  const filled = new Map<string, number>();
  let filledStepCount = 0;

  let lastValue: number | undefined;
  let forwardGap = 0;

  for (const step of grid) {
    const raw = series.get(step);
    if (raw != null && Number.isFinite(raw)) {
      filled.set(step, raw);
      lastValue = raw;
      forwardGap = 0;
      continue;
    }

    if (lastValue != null && forwardGap < maxForward) {
      filled.set(step, lastValue);
      filledStepCount += 1;
      forwardGap += 1;
    }
  }

  if (maxBackward > 0) {
    let firstValue: number | undefined;
    let firstIndex = -1;
    for (let i = 0; i < grid.length; i++) {
      const value = filled.get(grid[i]!) ?? series.get(grid[i]!);
      if (value != null && Number.isFinite(value)) {
        firstValue = value;
        firstIndex = i;
        break;
      }
    }

    if (firstValue != null && firstIndex > 0) {
      const limit = Math.min(firstIndex, maxBackward);
      for (let i = firstIndex - 1; i >= firstIndex - limit; i -= 1) {
        if (i < 0) break;
        const step = grid[i]!;
        if (filled.has(step)) continue;
        filled.set(step, firstValue);
        filledStepCount += 1;
      }
    }
  }

  return {
    filled,
    filledStepCount,
    rawStepCount: series.size,
  };
}
