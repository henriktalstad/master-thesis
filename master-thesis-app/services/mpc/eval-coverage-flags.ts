import { getMpcSdStaleSampleHours } from "@/lib/config/thesis-eval";
import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";

const MPC_STEP_MS = MPC_STEP_MINUTES * 60_000;

export function isMpcEvalSampleStale(input: {
  latestSampleAt: string | null | undefined;
  evalEnd: Date | string;
  now?: Date;
  staleAfterHours?: number;
}): boolean {
  const now = input.now ?? new Date();
  const staleMs = (input.staleAfterHours ?? getMpcSdStaleSampleHours()) * 3600_000;
  const evalEndMs = new Date(input.evalEnd).getTime();
  if (Number.isNaN(evalEndMs)) return true;

  if (!input.latestSampleAt) {
    return now.getTime() - evalEndMs <= 7 * 24 * 3600_000;
  }

  const latestMs = new Date(input.latestSampleAt).getTime();
  if (Number.isNaN(latestMs)) return true;

  const evalFrozen = evalEndMs <= now.getTime() - MPC_STEP_MS;
  if (evalFrozen) {
    return latestMs < evalEndMs - MPC_STEP_MS;
  }

  const evalTailMs = Math.min(evalEndMs, now.getTime());
  const lagBehindEvalTail = evalTailMs - latestMs > staleMs;
  const lagBehindClock = now.getTime() - latestMs > staleMs;
  return lagBehindEvalTail || lagBehindClock;
}

export function buildEvalCoverageFlags(input: {
  uMeasPct: number;
  plantNeedsBackfill: boolean;
  thresholdPct: number;
  latestSampleAt?: string | null;
  evalEnd?: Date | string;
  now?: Date;
  staleAfterHours?: number;
}): {
  needsMpcBackfill: boolean;
  needsPlantBackfill: boolean;
  needsSampleRefresh: boolean;
  needsBackfill: boolean;
} {
  const needsMpcBackfill = input.uMeasPct < input.thresholdPct;
  const needsPlantBackfill = input.plantNeedsBackfill;
  const needsSampleRefresh =
    input.evalEnd != null
      ? isMpcEvalSampleStale({
          latestSampleAt: input.latestSampleAt,
          evalEnd: input.evalEnd,
          now: input.now,
          staleAfterHours: input.staleAfterHours,
        })
      : input.latestSampleAt
        ? isMpcEvalSampleStale({
            latestSampleAt: input.latestSampleAt,
            evalEnd: input.now ?? new Date(),
            now: input.now,
            staleAfterHours: input.staleAfterHours,
          })
        : false;
  return {
    needsMpcBackfill,
    needsPlantBackfill,
    needsSampleRefresh,
    needsBackfill: needsMpcBackfill || needsPlantBackfill || needsSampleRefresh,
  };
}
