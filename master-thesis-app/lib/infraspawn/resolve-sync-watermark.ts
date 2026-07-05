/** Beregner neste vannmerke etter Influx-sync (UTC). */
export function resolveSyncWatermarkAfterRun(input: {
  watermarkBase: Date;
  recentStart: Date;
  tailReachedSyncUntil: boolean;
  tailEndCursor: Date;
  maxSampledAt: Date | null;
  overlapMs: number;
}): Date {
  const baseMs = input.watermarkBase.getTime();
  const dataMs = input.maxSampledAt?.getTime() ?? baseMs;

  if (input.tailReachedSyncUntil) {
    return new Date(
      Math.max(dataMs, input.recentStart.getTime(), baseMs),
    );
  }

  const progressMs = input.tailEndCursor.getTime() - input.overlapMs;
  return new Date(Math.max(dataMs, progressMs, baseMs));
}
