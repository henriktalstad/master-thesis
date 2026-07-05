import "server-only";

import { prisma, PRISMA_TX_TIMEOUT_MS } from "@/lib/db";
import { MPC_CONTROL_MODEL_VERSION } from "@/lib/sd-anlegg/control/control-constants";
import { toPrismaJson } from "@/lib/sd-anlegg/control/prisma-json";
import {
  aggregateReplayStepsToControlBuckets,
  expandControlSignalBucketToReplayStep,
  type CompactControlSignalHourPayload,
} from "@/lib/sd-anlegg/control/compact-control-signal-bucket";
import {
  MATERIALIZED_CONTROL_BUCKET_MINUTES,
  type MaterializedControlBucketMinutes,
} from "@/lib/sd-anlegg/control/mpc-execution-mode";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const UPSERT_CHUNK = 48;
const SOURCE_KIND = "mpc_replay";

export async function upsertControlSignalBucketsFromSteps(input: {
  buildingId: string;
  steps: readonly MpcReplayStep[];
  calibrationFingerprint?: string | null;
  pipelineRunId?: string | null;
  bucketMinutesList?: readonly MaterializedControlBucketMinutes[];
}): Promise<{ bucketsWritten: number }> {
  if (input.steps.length === 0) return { bucketsWritten: 0 };

  const resolutions =
    input.bucketMinutesList ?? MATERIALIZED_CONTROL_BUCKET_MINUTES;
  let bucketsWritten = 0;

  for (const bucketMinutes of resolutions) {
    const buckets = aggregateReplayStepsToControlBuckets(
      input.steps,
      bucketMinutes,
    );
    if (buckets.length === 0) continue;

    for (let i = 0; i < buckets.length; i += UPSERT_CHUNK) {
      const chunk = buckets.slice(i, i + UPSERT_CHUNK);
      await prisma.$transaction(
        chunk.map((bucket) =>
          prisma.sdAnleggControlSignalBucket.upsert({
            where: {
              buildingId_bucketAt_bucketMinutes_modelVersion_sourceKind: {
                buildingId: input.buildingId,
                bucketAt: new Date(bucket.bucketAt),
                bucketMinutes: bucket.bucketMinutes,
                modelVersion: MPC_CONTROL_MODEL_VERSION,
                sourceKind: SOURCE_KIND,
              },
            },
            create: {
              buildingId: input.buildingId,
              bucketAt: new Date(bucket.bucketAt),
              bucketMinutes: bucket.bucketMinutes,
              sourceKind: SOURCE_KIND,
              modelVersion: MPC_CONTROL_MODEL_VERSION,
              calibrationFingerprint: input.calibrationFingerprint ?? null,
              pipelineRunId: input.pipelineRunId ?? null,
              payload: toPrismaJson(bucket.payload),
              stepCount: bucket.payload.n,
            },
            update: {
              calibrationFingerprint: input.calibrationFingerprint ?? null,
              pipelineRunId: input.pipelineRunId ?? null,
              payload: toPrismaJson(bucket.payload),
              stepCount: bucket.payload.n,
            },
          }),
        ),
        { timeout: PRISMA_TX_TIMEOUT_MS },
      );
      bucketsWritten += chunk.length;
    }
  }

  return { bucketsWritten };
}

export async function loadControlSignalBucketSteps(input: {
  buildingId: string;
  since: Date;
  bucketMinutes: MaterializedControlBucketMinutes;
  maxBuckets?: number;
}): Promise<MpcReplayStep[]> {
  const rows = await prisma.sdAnleggControlSignalBucket.findMany({
    where: {
      buildingId: input.buildingId,
      modelVersion: MPC_CONTROL_MODEL_VERSION,
      sourceKind: SOURCE_KIND,
      bucketMinutes: input.bucketMinutes,
      bucketAt: { gte: input.since },
    },
    orderBy: { bucketAt: "desc" },
    take: input.maxBuckets,
    select: {
      bucketAt: true,
      payload: true,
    },
  });

  if (rows.length === 0) return [];

  return rows.reverse().map((row) =>
    expandControlSignalBucketToReplayStep(
      row.bucketAt.toISOString(),
      row.payload as CompactControlSignalHourPayload,
    ),
  );
}
