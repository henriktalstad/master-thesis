import "server-only";

import { prisma, PRISMA_TX_TIMEOUT_MS } from "@/lib/db";
import { MPC_CONTROL_MODEL_VERSION } from "@/lib/sd-anlegg/control/control-constants";
import { toPrismaJson } from "@/lib/sd-anlegg/control/prisma-json";
import {
  aggregateReplayStepsToControlHours,
  type CompactControlSignalHourPayload,
} from "@/lib/sd-anlegg/control/compact-control-signal-hour";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const UPSERT_CHUNK = 48;

export async function upsertControlSignalHoursFromSteps(input: {
  buildingId: string;
  steps: readonly MpcReplayStep[];
  calibrationFingerprint?: string | null;
  pipelineRunId?: string | null;
}): Promise<{ hoursWritten: number }> {
  if (input.steps.length === 0) return { hoursWritten: 0 };

  const hours = aggregateReplayStepsToControlHours(input.steps);
  if (hours.length === 0) return { hoursWritten: 0 };

  let hoursWritten = 0;
  for (let i = 0; i < hours.length; i += UPSERT_CHUNK) {
    const chunk = hours.slice(i, i + UPSERT_CHUNK);
    await prisma.$transaction(
      chunk.map((hour) =>
        prisma.sdAnleggControlSignalHour.upsert({
          where: {
            buildingId_hourAt_modelVersion: {
              buildingId: input.buildingId,
              hourAt: new Date(hour.hourAt),
              modelVersion: MPC_CONTROL_MODEL_VERSION,
            },
          },
          create: {
            buildingId: input.buildingId,
            hourAt: new Date(hour.hourAt),
            modelVersion: MPC_CONTROL_MODEL_VERSION,
            calibrationFingerprint: input.calibrationFingerprint ?? null,
            pipelineRunId: input.pipelineRunId ?? null,
            payload: toPrismaJson(hour.payload),
            stepCount: hour.payload.n,
          },
          update: {
            calibrationFingerprint: input.calibrationFingerprint ?? null,
            pipelineRunId: input.pipelineRunId ?? null,
            payload: toPrismaJson(hour.payload),
            stepCount: hour.payload.n,
          },
        }),
      ),
      { timeout: PRISMA_TX_TIMEOUT_MS },
    );
    hoursWritten += chunk.length;
  }

  const { upsertControlSignalBucketsFromSteps } = await import(
    "@/lib/sd-anlegg/control/persist-control-signal-buckets"
  );
  await upsertControlSignalBucketsFromSteps({
    buildingId: input.buildingId,
    steps: input.steps,
    calibrationFingerprint: input.calibrationFingerprint,
    pipelineRunId: input.pipelineRunId,
  });

  return { hoursWritten };
}

export async function loadControlSignalHourSteps(input: {
  buildingId: string;
  since: Date;
  maxHours?: number;
}): Promise<MpcReplayStep[]> {
  const rows = await prisma.sdAnleggControlSignalHour.findMany({
    where: {
      buildingId: input.buildingId,
      modelVersion: MPC_CONTROL_MODEL_VERSION,
      hourAt: { gte: input.since },
    },
    orderBy: { hourAt: "desc" },
    take: input.maxHours,
    select: {
      hourAt: true,
      payload: true,
    },
  });

  if (rows.length === 0) return [];

  const { expandControlSignalHourToReplayStep } = await import(
    "@/lib/sd-anlegg/control/compact-control-signal-hour"
  );

  return rows.reverse().map((row) =>
    expandControlSignalHourToReplayStep(
      row.hourAt.toISOString(),
      row.payload as CompactControlSignalHourPayload,
    ),
  );
}
