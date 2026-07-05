import type { ControlDisplayStepMinutes, StyringSignalGrain } from "./resolve-control-lookback";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

/** Min. andel av forventede timer før materialisert time-cache brukes. */
export const HOURLY_CACHE_MIN_COVERAGE = 0.5;

export function hourlyBucketCoverageRatio(
  bucketCount: number,
  lookbackHours: number,
): number {
  const expected = Math.max(1, Math.ceil(lookbackHours));
  return Math.min(1, bucketCount / expected);
}

export function shouldUseHourlyBucketCache(
  bucketCount: number,
  lookbackHours: number,
): boolean {
  return (
    hourlyBucketCoverageRatio(bucketCount, lookbackHours) >=
    HOURLY_CACHE_MIN_COVERAGE
  );
}

export function expectedControlSignalStepCount(input: {
  stepMinutes: ControlDisplayStepMinutes;
  lookbackHours: number;
  effectiveHours: number;
}): number {
  if (input.stepMinutes >= 60) {
    return Math.ceil(input.lookbackHours);
  }
  return Math.ceil((input.effectiveHours * 60) / input.stepMinutes);
}

export function controlSignalSeriesCoverageRatio(
  stepCount: number,
  expectedStepCount: number,
): number {
  return Math.min(1, stepCount / Math.max(expectedStepCount, 1));
}

export function buildControlSignalResolutionNote(input: {
  stepMinutes: ControlDisplayStepMinutes;
  grain: StyringSignalGrain;
  lookbackHours: number;
  autoHour: boolean;
}): string | null {
  if (!input.autoHour || input.stepMinutes < 60) return null;
  const days = input.lookbackHours / 24;
  const periodLabel =
    days >= 7 && Number.isInteger(days)
      ? `${days} d`
      : `${Math.round(input.lookbackHours)} t`;
  if (input.grain === "15") {
    return `Timevis snitt — ${periodLabel} valgt`;
  }
  return `Timevis gjennomsnitt for rask visning av lang periode.`;
}

export type ControlSignalSeriesMetadata = {
  expectedStepCount: number;
  coverageRatio: number;
  resolutionNote: string | null;
};

export function buildControlSignalSeriesMetadata(input: {
  steps: readonly MpcReplayStep[];
  stepMinutes: ControlDisplayStepMinutes;
  lookbackHours: number;
  effectiveHours: number;
  grain: StyringSignalGrain;
  autoHour?: boolean;
}): ControlSignalSeriesMetadata {
  const expectedStepCount = expectedControlSignalStepCount({
    stepMinutes: input.stepMinutes,
    lookbackHours: input.lookbackHours,
    effectiveHours: input.effectiveHours,
  });
  return {
    expectedStepCount,
    coverageRatio: controlSignalSeriesCoverageRatio(
      input.steps.length,
      expectedStepCount,
    ),
    resolutionNote: buildControlSignalResolutionNote({
      stepMinutes: input.stepMinutes,
      grain: input.grain,
      lookbackHours: input.lookbackHours,
      autoHour: input.autoHour ?? input.stepMinutes >= 60,
    }),
  };
}
