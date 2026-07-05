import "server-only";

import { Prisma } from "@/generated/client";
import {
  rollupStoredRowsToDaily,
  rollupStoredRowsToHourly,
} from "@/lib/infraspawn/bucket-aggregate";
import {
  getInfraspawn15mRetentionDays,
  INFRASPAWN_RESOLUTION_15M,
  INFRASPAWN_RESOLUTION_DAY,
  INFRASPAWN_RESOLUTION_HOUR,
} from "@/lib/infraspawn/resolution";
import { prisma, withPrismaRetry } from "@/lib/db";
import { upsertSampleBatch } from "@/services/infraspawn/batch-sample-upsert";

const COMPACT_BATCH_SIZE = 5_000;
const HOUR_TO_DAY_RETENTION_DAYS = 730;

const compactSampleSelect = {
  objectId: true,
  sampledAt: true,
  valueNum: true,
  quality: true,
  sampleCount: true,
} as const;

export type CompactInfraspawnSamplesResult = {
  sourcesProcessed: number;
  rows15mToHour: number;
  rows15mDeleted: number;
  rowsHourToDay: number;
  errors: string[];
};

export type CompactInfraspawnSourceResult = {
  sourceId: string;
  rows15mToHour: number;
  rows15mDeleted: number;
  rowsHourToDay: number;
  error?: string;
};

export type CompactionCutoffs = {
  cutoff15m: Date;
  cutoffHourToDay: Date;
};

export function resolveCompactionCutoffs(now = Date.now()): CompactionCutoffs {
  return {
    cutoff15m: new Date(
      now - getInfraspawn15mRetentionDays() * 24 * 60 * 60 * 1000,
    ),
    cutoffHourToDay: new Date(
      now - HOUR_TO_DAY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ),
  };
}

async function compact15mToHourForSource(
  sourceId: string,
  cutoff: Date,
): Promise<{ upserted: number; deleted: number }> {
  let upserted = 0;
  let deleted = 0;

  while (true) {
    const rows = await withPrismaRetry(() =>
      prisma.infraspawnBacnetSample.findMany({
        where: {
          sourceId,
          resolution: INFRASPAWN_RESOLUTION_15M,
          sampledAt: { lt: cutoff },
        },
        select: compactSampleSelect,
        orderBy: { sampledAt: "asc" },
        take: COMPACT_BATCH_SIZE,
      }),
    );

    if (rows.length === 0) break;

    const aggregated = rollupStoredRowsToHourly(rows);
    if (aggregated.length > 0) {
      await upsertSampleBatch(sourceId, aggregated, INFRASPAWN_RESOLUTION_HOUR);
      upserted += aggregated.length;
    }

    const minSampledAt = rows[0]!.sampledAt;
    const maxSampledAt = rows[rows.length - 1]!.sampledAt;

    const deleteResult = await withPrismaRetry(() =>
      prisma.infraspawnBacnetSample.deleteMany({
        where: {
          sourceId,
          resolution: INFRASPAWN_RESOLUTION_15M,
          sampledAt: {
            gte: minSampledAt,
            lte: maxSampledAt,
          },
        },
      }),
    );
    deleted += deleteResult.count;

    if (rows.length < COMPACT_BATCH_SIZE) break;
  }

  return { upserted, deleted };
}

async function compactHourToDayForSource(
  sourceId: string,
  cutoff: Date,
): Promise<number> {
  let upserted = 0;
  let cursor: Date | undefined;

  while (true) {
    const rows = await withPrismaRetry(() =>
      prisma.infraspawnBacnetSample.findMany({
        where: {
          sourceId,
          resolution: INFRASPAWN_RESOLUTION_HOUR,
          sampledAt: {
            lt: cutoff,
            ...(cursor ? { gt: cursor } : {}),
          },
        },
        select: compactSampleSelect,
        orderBy: { sampledAt: "asc" },
        take: COMPACT_BATCH_SIZE,
      }),
    );

    if (rows.length === 0) break;

    const aggregated = rollupStoredRowsToDaily(rows);
    if (aggregated.length > 0) {
      await upsertSampleBatch(sourceId, aggregated, INFRASPAWN_RESOLUTION_DAY);
      upserted += aggregated.length;
    }

    cursor = rows[rows.length - 1]!.sampledAt;
    if (rows.length < COMPACT_BATCH_SIZE) break;
  }

  return upserted;
}

export async function listCompactionSourceIds(input: {
  cutoff15m: Date;
  cutoffHourToDay: Date;
}): Promise<string[]> {
  const rows = await prisma.infraspawnSource.findMany({
    where: {
      OR: [
        { isActive: true },
        {
          samples: {
            some: {
              OR: [
                {
                  resolution: INFRASPAWN_RESOLUTION_15M,
                  sampledAt: { lt: input.cutoff15m },
                },
                {
                  resolution: INFRASPAWN_RESOLUTION_HOUR,
                  sampledAt: { lt: input.cutoffHourToDay },
                },
              ],
            },
          },
        },
      ],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  return rows.map((row) => row.id);
}

export async function compactInfraspawnSource(
  sourceId: string,
  cutoffs: CompactionCutoffs,
): Promise<CompactInfraspawnSourceResult> {
  try {
    const compact15m = await compact15mToHourForSource(
      sourceId,
      cutoffs.cutoff15m,
    );
    const rowsHourToDay = await compactHourToDayForSource(
      sourceId,
      cutoffs.cutoffHourToDay,
    );

    return {
      sourceId,
      rows15mToHour: compact15m.upserted,
      rows15mDeleted: compact15m.deleted,
      rowsHourToDay,
    };
  } catch (error) {
    return {
      sourceId,
      rows15mToHour: 0,
      rows15mDeleted: 0,
      rowsHourToDay: 0,
      error: error instanceof Error ? error.message : "Ukjent kompakteringsfeil",
    };
  }
}

export async function compactInfraspawnSamples(): Promise<CompactInfraspawnSamplesResult> {
  const cutoffs = resolveCompactionCutoffs();
  const sourceIds = await listCompactionSourceIds(cutoffs);

  const result: CompactInfraspawnSamplesResult = {
    sourcesProcessed: sourceIds.length,
    rows15mToHour: 0,
    rows15mDeleted: 0,
    rowsHourToDay: 0,
    errors: [],
  };

  for (const sourceId of sourceIds) {
    const compacted = await compactInfraspawnSource(sourceId, cutoffs);
    result.rows15mToHour += compacted.rows15mToHour;
    result.rows15mDeleted += compacted.rows15mDeleted;
    result.rowsHourToDay += compacted.rowsHourToDay;
    if (compacted.error) {
      result.errors.push(`${sourceId}: ${compacted.error}`);
    }
  }

  return result;
}

export async function countCompactable15mRows(): Promise<number> {
  const cutoff = resolveCompactionCutoffs().cutoff15m;
  const row = await prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "infraspawn_bacnet_samples"
    WHERE "resolution" = ${INFRASPAWN_RESOLUTION_15M}
      AND "sampledAt" < ${cutoff}
  `);
  return Number(row[0]?.count ?? 0);
}
