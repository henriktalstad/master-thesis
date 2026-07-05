/** Min. antall replay-steg for thesis/canonical (≈ 1 uke @ 15 min). */
export const MIN_THESIS_REPLAY_STEPS = 672;

const COMPLETE_RATIO = 0.95;

/** Persistert replay dekker forventet eval (ignorerer metadata-only runs). Klient-sikker. */
export function isPipelineRunPersistentlyComplete(input: {
  expectedStepCount: number;
  persistedStepCount: number;
}): boolean {
  const { expectedStepCount, persistedStepCount } = input;
  if (persistedStepCount < 96) return false;
  if (expectedStepCount <= 0) return persistedStepCount >= 96;

  const ratioTarget = Math.floor(expectedStepCount * COMPLETE_RATIO);
  if (expectedStepCount >= MIN_THESIS_REPLAY_STEPS) {
    return (
      persistedStepCount >= MIN_THESIS_REPLAY_STEPS &&
      persistedStepCount >= ratioTarget
    );
  }

  return persistedStepCount >= ratioTarget;
}
