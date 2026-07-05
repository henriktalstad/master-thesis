import "server-only";

import { getSdCoverageThreshold } from "@/lib/config/thesis-eval";
import { SERIES_GAP_BUCKET_MS } from "@/lib/infraspawn/detect-series-gaps";
import {
  clipRangeToInfluxLookback,
  resolveInfluxMaxLookbackHours,
} from "@/lib/infraspawn/influx-lookback";
import { fillSeriesGapsFromInflux } from "@/lib/infraspawn/fill-series-gaps-from-influx";
import { prisma } from "@/lib/db";

const DEFAULT_MIN_GAP_BUCKETS = 2;
/** Batch-størrelse for Influx hull-henting (unngår for mange parallelle spørringer). */
const SPARSE_BACKFILL_OBJECT_BATCH = 25;

async function resolveMaxSparseObjectIds(sourceId: string): Promise<number> {
  const raw = Number(process.env.INFRASPAWN_SPARSE_BACKFILL_MAX_POINTS ?? "");
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);

  const metaCount = await prisma.infraspawnBacnetPointMeta.count({
    where: { sourceId },
  });
  return Math.max(metaCount, 1);
}

function countExpectedBuckets(startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;
  return Math.max(1, Math.ceil((endMs - startMs) / SERIES_GAP_BUCKET_MS));
}

export type BackfillSparseMirrorResult = {
  sparseObjectCount: number;
  rowsUpserted: number;
  gapsFilled: number;
};

/**
 * Etter global sync: fyll hull for speilpunkter under dekningsterskel innen Influx lookback.
 */
export async function backfillSparseMirrorSignals(
  sourceId: string,
  now: Date = new Date(),
): Promise<BackfillSparseMirrorResult> {
  const threshold = getSdCoverageThreshold();
  const lookbackHours = resolveInfluxMaxLookbackHours();
  const window = clipRangeToInfluxLookback({
    start: new Date(now.getTime() - lookbackHours * 3_600_000),
    end: now,
    now,
  });

  if (!window.queryable) {
    return { sparseObjectCount: 0, rowsUpserted: 0, gapsFilled: 0 };
  }

  const sinceMs = window.start.getTime();
  const untilMs = window.end.getTime();
  const expectedBuckets = countExpectedBuckets(sinceMs, untilMs);
  if (expectedBuckets === 0) {
    return { sparseObjectCount: 0, rowsUpserted: 0, gapsFilled: 0 };
  }

  const minBuckets = Math.max(1, Math.ceil(expectedBuckets * threshold));
  const maxObjectIds = await resolveMaxSparseObjectIds(sourceId);

  const sparseRows = await prisma.$queryRaw<Array<{ objectId: string }>>`
    SELECT m."objectId"
    FROM infraspawn_bacnet_point_meta m
    LEFT JOIN (
      SELECT "objectId", COUNT(*)::int AS cnt
      FROM infraspawn_bacnet_samples
      WHERE "sourceId" = ${sourceId}
        AND resolution = ${"15m"}
        AND "sampledAt" >= ${window.start}
        AND "sampledAt" <= ${window.end}
        AND "valueNum" IS NOT NULL
      GROUP BY "objectId"
    ) s ON s."objectId" = m."objectId"
    WHERE m."sourceId" = ${sourceId}
      AND COALESCE(s.cnt, 0) < ${minBuckets}
    ORDER BY COALESCE(s.cnt, 0) ASC
    LIMIT ${maxObjectIds}
  `;

  const sparseObjectIds = sparseRows.map((row) => row.objectId);
  if (sparseObjectIds.length === 0) {
    return { sparseObjectCount: 0, rowsUpserted: 0, gapsFilled: 0 };
  }

  let totalRowsUpserted = 0;
  let totalGapsFilled = 0;

  for (let i = 0; i < sparseObjectIds.length; i += SPARSE_BACKFILL_OBJECT_BATCH) {
    const batchObjectIds = sparseObjectIds.slice(i, i + SPARSE_BACKFILL_OBJECT_BATCH);

    const sampleRows = await prisma.infraspawnBacnetSample.findMany({
      where: {
        sourceId,
        objectId: { in: batchObjectIds },
        resolution: "15m",
        sampledAt: { gte: window.start, lte: window.end },
        valueNum: { not: null },
      },
      select: { objectId: true, sampledAt: true, valueNum: true },
      orderBy: { sampledAt: "asc" },
    });

    const samplesByObjectId = new Map<
      string,
      Array<{ t: string; value: number | null }>
    >();
    for (const objectId of batchObjectIds) {
      samplesByObjectId.set(objectId, []);
    }
    for (const row of sampleRows) {
      samplesByObjectId.get(row.objectId)?.push({
        t: row.sampledAt.toISOString(),
        value: row.valueNum,
      });
    }

    const filled = await fillSeriesGapsFromInflux({
      sourceId,
      objectIds: batchObjectIds,
      sinceMs,
      untilMs,
      samplesByObjectId,
      minGapBuckets: DEFAULT_MIN_GAP_BUCKETS,
      maxGapsPerObject: 8,
      maxPagesPerGap: 8,
      persist: true,
    });

    for (const samples of filled.values()) {
      totalRowsUpserted += samples.length;
    }
    totalGapsFilled += filled.size;
  }

  if (totalRowsUpserted > 0) {
    console.info("[infraspawn.sync] sparse mirror backfill", {
      sourceId,
      sparseObjectCount: sparseObjectIds.length,
      rowsUpserted: totalRowsUpserted,
      gapsFilled: totalGapsFilled,
    });
  }

  return {
    sparseObjectCount: sparseObjectIds.length,
    rowsUpserted: totalRowsUpserted,
    gapsFilled: totalGapsFilled,
  };
}
