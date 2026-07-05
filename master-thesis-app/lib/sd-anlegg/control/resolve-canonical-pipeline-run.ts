import { prisma } from "@/lib/db";
import { isReplayFanSignalPlausible } from "./assess-replay-quality";
import {
  isPipelineRunPersistentlyComplete,
  loadPipelineRunPersistedStepCount,
  MIN_THESIS_REPLAY_STEPS,
} from "./pipeline-run-completeness";

const CANONICAL_RUN_ENV = "MPC_CANONICAL_PIPELINE_RUN_ID";

type RunCandidate = {
  id: string;
  stepCount: number;
  persistedStepCount: number | null;
  persistStatus: string | null;
  createdAt: Date;
  evalStart: Date;
  evalEnd: Date;
  deltaCostVsEmulatedPct: number | null;
  fallbackSteps: number | null;
};

const RUN_SELECT = {
  id: true,
  stepCount: true,
  persistedStepCount: true,
  persistStatus: true,
  createdAt: true,
  evalStart: true,
  evalEnd: true,
  deltaCostVsEmulatedPct: true,
  fallbackSteps: true,
} as const;

/** Prefer frozen thesis window (804 × 15 min) over longer catch-up replays. */
function thesisWindowStepBonus(run: RunCandidate): number {
  const thesisStart = process.env.THESIS_EVAL_START?.trim();
  const targetSteps = 804;
  if (thesisStart && run.evalStart?.toISOString().startsWith(thesisStart)) {
    const stepDelta = Math.abs(run.stepCount - targetSteps);
    if (stepDelta <= 12) return 500;
    if (stepDelta <= 48) return 200;
  }
  if (run.stepCount >= 800 && run.stepCount <= 820) return 150;
  if (run.stepCount > 900) return -300;
  return 0;
}

/** Lower is better — prefer thesis-coherent replays over raw step count. */
function thesisRunRank(run: RunCandidate, persisted: number): number {
  const fallbackRate =
    run.fallbackSteps != null && run.stepCount > 0
      ? run.fallbackSteps / run.stepCount
      : 1;
  const deltaVsEmulated = run.deltaCostVsEmulatedPct ?? 999;
  const emulatedCoherent = deltaVsEmulated <= 0 ? 0 : 1;
  const lowFallback = fallbackRate <= 0.06 ? 0 : 1;
  return (
    emulatedCoherent * 1000 +
    lowFallback * 100 +
    Math.min(99, Math.round(fallbackRate * 100)) +
    Math.max(0, Math.min(99, Math.round(deltaVsEmulated))) -
    Math.min(99, Math.floor(persisted / 10)) -
    thesisWindowStepBonus(run)
  );
}

async function fanSamplesFromReplayRun(
  pipelineRunId: string,
  sampleSize = 120,
): Promise<number[]> {
  const rows = await prisma.sdAnleggMpcPipelineReplayStep.findMany({
    where: { pipelineRunId },
    select: {
      controlTracks: {
        where: { track: "OBSERVED" },
        select: { supplyFanPct: true },
        take: 1,
      },
    },
    take: sampleSize,
    orderBy: { stepAt: "asc" },
  });

  return rows
    .map((row) => row.controlTracks[0]?.supplyFanPct)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

async function persistedCountForRun(run: RunCandidate): Promise<number> {
  return loadPipelineRunPersistedStepCount(run.id, {
    persistedStepCount: run.persistedStepCount,
    persistStatus: run.persistStatus,
  });
}

async function isCompleteRun(run: RunCandidate): Promise<boolean> {
  const persisted = await persistedCountForRun(run);
  return isPipelineRunPersistentlyComplete({
    expectedStepCount: run.stepCount,
    persistedStepCount: persisted,
  });
}

async function pickBestCompleteRun(
  runs: RunCandidate[],
): Promise<string | null> {
  let bestId: string | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestPersisted = 0;
  let bestCreatedAt = 0;
  let bestEvalEndMs = 0;

  for (const run of runs) {
    const persisted = await persistedCountForRun(run);
    if (
      !isPipelineRunPersistentlyComplete({
        expectedStepCount: run.stepCount,
        persistedStepCount: persisted,
      })
    ) {
      continue;
    }
    const rank = thesisRunRank(run, persisted);
    const createdAtMs = run.createdAt.getTime();
    const evalEndMs = run.evalEnd?.getTime() ?? 0;
    if (
      evalEndMs > bestEvalEndMs ||
      (evalEndMs === bestEvalEndMs &&
        (rank < bestRank ||
          (rank === bestRank &&
            (persisted > bestPersisted ||
              (persisted === bestPersisted && createdAtMs > bestCreatedAt)))))
    ) {
      bestId = run.id;
      bestRank = rank;
      bestPersisted = persisted;
      bestCreatedAt = createdAtMs;
      bestEvalEndMs = evalEndMs;
    }
  }

  return bestId;
}

async function resolveLegacyCanonicalRunId(
  buildingId: string,
): Promise<string | null> {
  const thesisCandidates = await prisma.sdAnleggMpcPipelineRun.findMany({
    where: {
      buildingId,
      stepCount: { gte: MIN_THESIS_REPLAY_STEPS, lte: 1100 },
      deltaCostVsEmulatedPct: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: RUN_SELECT,
  });

  const completeThesis = await pickBestCompleteRun(thesisCandidates);
  if (completeThesis) return completeThesis;

  const candidates = await prisma.sdAnleggMpcPipelineRun.findMany({
    where: { buildingId, replayQuality: null },
    orderBy: [{ stepCount: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: RUN_SELECT,
  });

  for (const candidate of candidates) {
    const persisted = await persistedCountForRun(candidate);
    if (
      !isPipelineRunPersistentlyComplete({
        expectedStepCount: candidate.stepCount,
        persistedStepCount: persisted,
      })
    ) {
      continue;
    }
    const samples = await fanSamplesFromReplayRun(candidate.id);
    if (isReplayFanSignalPlausible(samples)) {
      return candidate.id;
    }
  }

  for (const candidate of candidates) {
    if (await isCompleteRun(candidate)) {
      return candidate.id;
    }
  }

  return null;
}

export async function resolveCanonicalMpcPipelineRunId(
  buildingId: string,
): Promise<string | null> {
  const envId = process.env[CANONICAL_RUN_ENV]?.trim();
  if (envId) {
    const row = await prisma.sdAnleggMpcPipelineRun.findFirst({
      where: { id: envId, buildingId },
      select: RUN_SELECT,
    });
    if (row && (await isCompleteRun(row))) return row.id;
  }

  const validRuns = await prisma.sdAnleggMpcPipelineRun.findMany({
    where: { buildingId, replayQuality: "VALID" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: RUN_SELECT,
  });

  const completeValid = await pickBestCompleteRun(validRuns);
  if (completeValid) return completeValid;

  const legacy = await resolveLegacyCanonicalRunId(buildingId);
  if (legacy) return legacy;

  const latestComplete = await prisma.sdAnleggMpcPipelineRun.findMany({
    where: { buildingId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: RUN_SELECT,
  });

  return pickBestCompleteRun(latestComplete);
}

export { isReplayFanSignalPlausible } from "./assess-replay-quality";
export {
  countPipelineReplaySteps,
  isPipelineRunPersistentlyComplete,
  loadPipelineRunPersistedStepCount,
} from "./pipeline-run-completeness";
