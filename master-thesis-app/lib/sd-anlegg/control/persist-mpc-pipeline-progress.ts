import "server-only";

import type { MpcPersistStatus } from "@/generated/client";
import { prisma, withPrismaRetry } from "@/lib/db";

export async function updatePipelinePersistProgress(input: {
  pipelineRunId: string;
  persistStatus: MpcPersistStatus;
  persistedStepCount?: number;
  persistError?: string | null;
}): Promise<void> {
  await withPrismaRetry(
    () =>
      prisma.sdAnleggMpcPipelineRun.update({
        where: { id: input.pipelineRunId },
        data: {
          persistStatus: input.persistStatus,
          ...(input.persistedStepCount != null
            ? { persistedStepCount: input.persistedStepCount }
            : {}),
          ...(input.persistError !== undefined
            ? { persistError: input.persistError }
            : {}),
        },
      }),
    { retries: 3, delayMs: 500 },
  );
}

export async function markPipelinePersistFailed(input: {
  pipelineRunId: string;
  error: unknown;
  persistedStepCount?: number;
}): Promise<void> {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error);
  await updatePipelinePersistProgress({
    pipelineRunId: input.pipelineRunId,
    persistStatus: "FAILED",
    persistedStepCount: input.persistedStepCount,
    persistError: message.slice(0, 2000),
  });
}
