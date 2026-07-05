import "server-only";

import { prisma } from "@/lib/db";
import {
  isPipelineRunPersistentlyComplete,
  MIN_THESIS_REPLAY_STEPS,
} from "./pipeline-run-completeness-logic";

export { isPipelineRunPersistentlyComplete, MIN_THESIS_REPLAY_STEPS };

export async function countPipelineReplaySteps(
  pipelineRunId: string,
): Promise<number> {
  return prisma.sdAnleggMpcPipelineReplayStep.count({
    where: { pipelineRunId },
  });
}

export async function loadPipelineRunPersistedStepCount(
  pipelineRunId: string,
  meta?: {
    persistedStepCount?: number | null;
    persistStatus?: string | null;
  },
): Promise<number> {
  if (
    meta?.persistedStepCount != null &&
    meta.persistedStepCount > 0 &&
    meta.persistStatus != null &&
    meta.persistStatus !== "PENDING"
  ) {
    return meta.persistedStepCount;
  }
  return countPipelineReplaySteps(pipelineRunId);
}
