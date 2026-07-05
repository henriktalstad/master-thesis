import "server-only";

import { getMpcGapFillMaxSteps } from "@/lib/config/thesis-eval";
import { clipRangeToInfluxLookback } from "@/lib/infraspawn/influx-lookback";
import { collectMergedMirrorGaps } from "@/lib/infraspawn/series-gap-plan";
import { prisma } from "@/lib/db";
import { fetchAndPersistControlSignalsRange } from "@/services/infraspawn/fetch-control-signals-range";

export type BackfillSignalGapsResult = {
  gapsDetected: number;
  gapsFilled: number;
  rowsUpserted: number;
  message: string;
};

async function loadMirrorSamplesByObject(input: {
  sourceId: string;
  objectIds: string[];
  since: Date;
  until: Date;
}): Promise<Map<string, Array<{ t: string }>>> {
  const rows = await prisma.infraspawnBacnetSample.findMany({
    where: {
      sourceId: input.sourceId,
      objectId: { in: input.objectIds },
      resolution: "15m",
      sampledAt: { gte: input.since, lte: input.until },
      valueNum: { not: null },
    },
    select: { objectId: true, sampledAt: true },
    orderBy: { sampledAt: "asc" },
  });

  const byObject = new Map<string, Array<{ t: string }>>();
  for (const objectId of input.objectIds) {
    byObject.set(objectId, []);
  }
  for (const row of rows) {
    byObject.get(row.objectId)?.push({ t: row.sampledAt.toISOString() });
  }
  return byObject;
}

export async function backfillSignalGapsFromInflux(input: {
  sourceId: string;
  objectIds: string[];
  windowStart: Date;
  windowEnd: Date;
  minGapBuckets?: number;
  maxPagesPerGap?: number;
  maxGapsTotal?: number;
}): Promise<BackfillSignalGapsResult> {
  const uniqueObjectIds = [...new Set(input.objectIds)];
  if (uniqueObjectIds.length === 0) {
    return {
      gapsDetected: 0,
      gapsFilled: 0,
      rowsUpserted: 0,
      message: "Hull-backfill: ingen objectIds",
    };
  }

  const clipped = clipRangeToInfluxLookback({
    start: input.windowStart,
    end: input.windowEnd,
  });
  if (!clipped.queryable) {
    return {
      gapsDetected: 0,
      gapsFilled: 0,
      rowsUpserted: 0,
      message: "Hull-backfill: vindu utenfor Influx lookback",
    };
  }

  const sinceMs = clipped.start.getTime();
  const untilMs = clipped.end.getTime();
  const minGapBuckets = input.minGapBuckets ?? getMpcGapFillMaxSteps();
  const maxPagesPerGap = input.maxPagesPerGap ?? 8;

  const samplesByObject = await loadMirrorSamplesByObject({
    sourceId: input.sourceId,
    objectIds: uniqueObjectIds,
    since: clipped.start,
    until: clipped.end,
  });

  const mergedGaps = collectMergedMirrorGaps({
    samplesByObjectId: samplesByObject,
    sinceMs,
    untilMs,
    minGapBuckets,
    maxGapsTotal: input.maxGapsTotal ?? 12,
  });

  if (mergedGaps.length === 0) {
    return {
      gapsDetected: 0,
      gapsFilled: 0,
      rowsUpserted: 0,
      message: "Hull-backfill: ingen hull funnet",
    };
  }

  const results = await Promise.all(
    mergedGaps.map((gap) =>
      fetchAndPersistControlSignalsRange({
        sourceId: input.sourceId,
        objectIds: uniqueObjectIds,
        start: new Date(gap.startMs),
        end: new Date(gap.endMs),
        maxPages: maxPagesPerGap,
      }),
    ),
  );

  let gapsFilled = 0;
  let rowsUpserted = 0;
  for (const result of results) {
    if (result.rowsUpserted > 0) gapsFilled += 1;
    rowsUpserted += result.rowsUpserted;
  }

  return {
    gapsDetected: mergedGaps.length,
    gapsFilled,
    rowsUpserted,
    message: `Hull-backfill: ${gapsFilled}/${mergedGaps.length} intervaller, ${rowsUpserted} 15m-rader`,
  };
}
