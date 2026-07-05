import "server-only";

import { prisma, PRISMA_TX_TIMEOUT_MS } from "@/lib/db";
import { MPC_CONTROL_MODEL_VERSION } from "@/lib/sd-anlegg/control/control-constants";
import { toPrismaJson } from "@/lib/sd-anlegg/control/prisma-json";
import type { ControlSdHourlyProfile } from "@/lib/sd-anlegg/control/control-sd-calibration";
import { buildObservedControlVector } from "@/services/mpc/build-u-meas";
import type { CompactControlSignalHourPayload } from "@/lib/sd-anlegg/control/compact-control-signal-bucket";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";

export const SD_OBSERVED_BUCKET_SOURCE = "sd_observed";

const UPSERT_CHUNK = 64;

function profileToObservedPayload(
  profile: ControlSdHourlyProfile,
): CompactControlSignalHourPayload | null {
  const u = buildObservedControlVector({
    supplySetpointC: profile.supplySetpointC,
    supplySetpointCalcC: profile.supplySetpointCalcC,
    supplyFanPct: profile.supplyFanPct,
    exhaustFanPct: profile.exhaustFanPct,
    heatingValvePct: profile.heatingValvePct,
    coolingValveFeedbackPct: profile.coolingValvePct,
  });
  if (!u) return null;
  return {
    o: MPC_CONTROL_KEYS.map((key) => u[key]),
    s: MPC_CONTROL_KEYS.map(() => 0),
    m: MPC_CONTROL_KEYS.map(() => 0),
    n: 1,
  };
}
export async function upsertSdObservedControlBuckets(input: {
  buildingId: string;
  profiles: readonly ControlSdHourlyProfile[];
  bucketMinutes: 1 | 5;
  pipelineRunId?: string | null;
}): Promise<{ bucketsWritten: number }> {
  if (input.profiles.length === 0) return { bucketsWritten: 0 };

  let bucketsWritten = 0;
  for (let i = 0; i < input.profiles.length; i += UPSERT_CHUNK) {
    const chunk = input.profiles.slice(i, i + UPSERT_CHUNK);
    const rows = chunk
      .map((profile) => {
        const payload = profileToObservedPayload(profile);
        if (!payload) return null;
        return { profile, payload };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    if (rows.length === 0) continue;

    await prisma.$transaction(
      rows.map(({ profile, payload }) =>
        prisma.sdAnleggControlSignalBucket.upsert({
          where: {
            buildingId_bucketAt_bucketMinutes_modelVersion_sourceKind: {
              buildingId: input.buildingId,
              bucketAt: new Date(profile.hour),
              bucketMinutes: input.bucketMinutes,
              modelVersion: MPC_CONTROL_MODEL_VERSION,
              sourceKind: SD_OBSERVED_BUCKET_SOURCE,
            },
          },
          create: {
            buildingId: input.buildingId,
            bucketAt: new Date(profile.hour),
            bucketMinutes: input.bucketMinutes,
            sourceKind: SD_OBSERVED_BUCKET_SOURCE,
            modelVersion: MPC_CONTROL_MODEL_VERSION,
            pipelineRunId: input.pipelineRunId ?? null,
            payload: toPrismaJson(payload),
            stepCount: 1,
          },
          update: {
            pipelineRunId: input.pipelineRunId ?? null,
            payload: toPrismaJson(payload),
            stepCount: 1,
          },
        }),
      ),
      { timeout: PRISMA_TX_TIMEOUT_MS },
    );
    bucketsWritten += rows.length;
  }

  return { bucketsWritten };
}

export async function loadSdObservedBucketProfiles(input: {
  buildingId: string;
  since: Date;
  bucketMinutes: 1 | 5;
  maxBuckets?: number;
  maxAgeMs?: number;
}): Promise<ControlSdHourlyProfile[] | null> {
  const maxAgeMs = input.maxAgeMs ?? 20 * 60_000;
  const rows = await prisma.sdAnleggControlSignalBucket.findMany({
    where: {
      buildingId: input.buildingId,
      bucketMinutes: input.bucketMinutes,
      sourceKind: SD_OBSERVED_BUCKET_SOURCE,
      modelVersion: MPC_CONTROL_MODEL_VERSION,
      bucketAt: { gte: input.since },
    },
    orderBy: { bucketAt: "desc" },
    take: input.maxBuckets,
    select: {
      bucketAt: true,
      updatedAt: true,
      payload: true,
    },
  });

  if (rows.length === 0) return null;

  const newest = rows[0]?.updatedAt.getTime() ?? 0;
  if (Date.now() - newest > maxAgeMs) return null;

  return rows.reverse().map((row) => {
    const payload = row.payload as CompactControlSignalHourPayload;
    const profile: ControlSdHourlyProfile = { hour: row.bucketAt.toISOString() };
    if (payload.o) {
      profile.supplySetpointC = payload.o[0];
      profile.supplyFanPct = payload.o[1];
      profile.exhaustFanPct = payload.o[2];
      profile.heatingValvePct = payload.o[3];
      profile.coolingValvePct = payload.o[4];
    }
    return profile;
  });
}
