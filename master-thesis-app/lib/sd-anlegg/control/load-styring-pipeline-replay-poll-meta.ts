import "server-only";

import { prisma } from "@/lib/db";
import { countPipelineReplaySteps } from "./pipeline-run-completeness";
import { FULL_REPLAY_COVERAGE_RATIO } from "./resolve-replay-summary";

export type StyringPipelineReplayPollMeta = {
  persistedStepCount: number;
  expectedStepCount: number;
  incomplete: boolean;
  persistStatus: string | null;
  chartsGeneratedAt: string | null;
};

export async function loadStyringPipelineReplayPollMeta(
  pipelineRunId: string | null,
): Promise<StyringPipelineReplayPollMeta | null> {
  if (!pipelineRunId) return null;

  const row = await prisma.sdAnleggMpcPipelineRun.findUnique({
    where: { id: pipelineRunId },
    select: {
      stepCount: true,
      persistedStepCount: true,
      persistStatus: true,
      chartsGeneratedAt: true,
    },
  });
  if (!row) return null;

  const dbCount = await countPipelineReplaySteps(pipelineRunId);
  const persistedStepCount = Math.max(dbCount, row.persistedStepCount ?? 0);
  const expectedStepCount = row.stepCount;

  return {
    persistedStepCount,
    expectedStepCount,
    incomplete:
      expectedStepCount > 0 &&
      persistedStepCount > 0 &&
      persistedStepCount < expectedStepCount * FULL_REPLAY_COVERAGE_RATIO,
    persistStatus: row.persistStatus ?? null,
    chartsGeneratedAt: row.chartsGeneratedAt?.toISOString() ?? null,
  };
}
