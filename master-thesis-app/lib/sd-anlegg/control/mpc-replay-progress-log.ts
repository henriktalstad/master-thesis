let lastLoggedMilestone = -1;

export function logMpcReplayProgress(progress: {
  stepIndex: number;
  totalSteps: number;
  elapsedMs: number;
  fallbackSteps: number;
}): void {
  const isMilestone =
    progress.stepIndex % 100 === 0 ||
    progress.stepIndex === progress.totalSteps - 1;
  if (!isMilestone || progress.stepIndex === lastLoggedMilestone) return;
  lastLoggedMilestone = progress.stepIndex;
  console.info(
    `[mpc-replay] ${progress.stepIndex + 1}/${progress.totalSteps} steg · ${progress.elapsedMs} ms · fallback ${progress.fallbackSteps}`,
  );
}

export function resetMpcReplayProgressLog(): void {
  lastLoggedMilestone = -1;
}
