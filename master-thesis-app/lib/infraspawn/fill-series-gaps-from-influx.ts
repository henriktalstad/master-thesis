import "server-only";

import type { AggregatedBacnetRow } from "@/lib/infraspawn/bucket-aggregate";
import { clipRangeToInfluxLookback } from "@/lib/infraspawn/influx-lookback";
import {
  collectPerObjectInfluxGaps,
  type GapDetectionSample,
} from "@/lib/infraspawn/series-gap-plan";
import { fetchControlSignalsRangeFromInflux } from "@/services/infraspawn/fetch-control-signals-range";

export type SeriesGapSample = GapDetectionSample;

function aggregatedToSeriesSamples(
  rows: readonly AggregatedBacnetRow[],
): SeriesGapSample[] {
  return rows.map((row) => ({
    t: row.sampledAt.toISOString(),
    value: row.valueNum,
  }));
}

/**
 * Henter manglende 15m-intervaller per objectId fra Influx (målrettet per hull).
 * Kan persistere til Postgres slik at speilet fylles for senere visning.
 */
export async function fillSeriesGapsFromInflux(input: {
  sourceId: string;
  objectIds: string[];
  sinceMs: number;
  untilMs: number;
  samplesByObjectId: ReadonlyMap<string, readonly SeriesGapSample[]>;
  minGapBuckets?: number;
  maxGapsPerObject?: number;
  maxPagesPerGap?: number;
  persist?: boolean;
}): Promise<Map<string, SeriesGapSample[]>> {
  const persist = input.persist !== false;
  const minGapBuckets = input.minGapBuckets ?? 2;
  const window = clipRangeToInfluxLookback({
    start: new Date(input.sinceMs),
    end: new Date(input.untilMs),
  });

  const filledByObject = new Map<string, SeriesGapSample[]>();
  if (!window.queryable) return filledByObject;

  const sinceMs = window.start.getTime();
  const untilMs = window.end.getTime();
  const gapsByObject = collectPerObjectInfluxGaps({
    samplesByObjectId: input.samplesByObjectId,
    objectIds: input.objectIds,
    sinceMs,
    untilMs,
    minGapBuckets,
    maxGapsPerObject: input.maxGapsPerObject,
  });

  if (gapsByObject.size === 0) return filledByObject;

  await Promise.all(
    [...gapsByObject.entries()].flatMap(([objectId, gaps]) =>
      gaps.map(async (gap) => {
        const fetched = await fetchControlSignalsRangeFromInflux({
          sourceId: input.sourceId,
          objectIds: [objectId],
          start: new Date(gap.startMs),
          end: new Date(gap.endMs),
          maxPages: input.maxPagesPerGap ?? 8,
          persist,
        });
        if (fetched.aggregatedRows.length === 0) return;

        const existing = filledByObject.get(objectId) ?? [];
        filledByObject.set(objectId, [
          ...existing,
          ...aggregatedToSeriesSamples(fetched.aggregatedRows),
        ]);
      }),
    ),
  );

  return filledByObject;
}
