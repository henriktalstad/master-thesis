import "server-only";

import { aggregateBacnetRowsTo15m } from "@/lib/infraspawn/bucket-aggregate";
import {
  loadInfraspawnMirrorSeriesBatch,
} from "@/lib/infraspawn/postgres-series";
import { resolvePrimaryResolutionForHours } from "@/lib/infraspawn/resolution";
import { objectHasSignificantGap } from "@/lib/infraspawn/detect-series-gaps";
import {
  seriesNeedsInfluxEnrichment,
} from "@/lib/infraspawn/series-gap-plan";
import { SD_ANLEGG_MIRROR_BUCKET_MS } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import { resolveSdAnleggChartInfluxLookbackMinutes } from "@/lib/infraspawn/sd-anlegg-live-lookback";
import {
  mergeInfraspawnSeriesSamples,
  type InfraspawnSeriesSample,
} from "@/lib/infraspawn/series-samples";
import { getMpcGapFillMaxSteps } from "@/lib/config/thesis-eval";
import { fillSeriesGapsFromInflux } from "@/lib/infraspawn/fill-series-gaps-from-influx";
import { queryInfluxLivePointRows } from "@/services/infraspawn/sd-anlegg-live";

export type SdAnleggSeriesLoadResult = {
  samples: InfraspawnSeriesSample[];
  unit: string | null;
  resolution: ReturnType<typeof resolvePrimaryResolutionForHours>;
};

export type SdAnleggInfluxCredentials = {
  token: string;
  database: string;
  tableName: string;
  host?: string;
};

function filterSamplesSince(
  samples: readonly InfraspawnSeriesSample[],
  sinceMs: number,
): InfraspawnSeriesSample[] {
  return samples.filter((sample) => {
    const ms = new Date(sample.t).getTime();
    return !Number.isNaN(ms) && ms >= sinceMs;
  });
}

async function enrichBatchWithInfluxTail(input: {
  sourceId: string;
  batch: Map<string, SdAnleggSeriesLoadResult>;
  objectIds: string[];
  hours: number;
  influx: SdAnleggInfluxCredentials;
}): Promise<Map<string, SdAnleggSeriesLoadResult>> {
  const sinceMs = Date.now() - input.hours * 3_600_000;
  const untilMs = Date.now();
  const staleThresholdMs = Date.now() - SD_ANLEGG_MIRROR_BUCKET_MS * 2;
  const minGapBuckets = getMpcGapFillMaxSteps();

  const needsEnrichment = input.objectIds.filter((objectId) =>
    seriesNeedsInfluxEnrichment({
      samples: input.batch.get(objectId)?.samples ?? [],
      sinceMs,
      untilMs,
      staleThresholdMs,
      minGapBuckets,
    }),
  );

  if (needsEnrichment.length === 0) return input.batch;

  const batchForLookback = new Map(
    [...input.batch.entries()].map(([objectId, entry]) => [
      objectId,
      { samples: entry.samples },
    ]),
  );

  const samplesByObjectId = new Map(
    needsEnrichment.map((objectId) => [
      objectId,
      input.batch.get(objectId)?.samples ?? [],
    ]),
  );

  const gapFilled = await fillSeriesGapsFromInflux({
    sourceId: input.sourceId,
    objectIds: needsEnrichment,
    sinceMs,
    untilMs,
    samplesByObjectId,
    minGapBuckets,
    maxGapsPerObject: 8,
    maxPagesPerGap: 8,
    persist: true,
  });

  const next = new Map(input.batch);

  for (const objectId of needsEnrichment) {
    const existing = next.get(objectId);
    if (!existing) continue;

    let merged = existing.samples;
    const gapSamples = gapFilled.get(objectId);
    if (gapSamples && gapSamples.length > 0) {
      merged = mergeInfraspawnSeriesSamples(
        merged,
        gapSamples.map((sample) => ({
          t: sample.t,
          value: sample.value ?? null,
        })),
      );
    }

    const stillStale =
      merged.filter((sample) => new Date(sample.t).getTime() >= sinceMs)
        .length === 0 ||
      Math.max(
        ...merged
          .filter((sample) => new Date(sample.t).getTime() >= sinceMs)
          .map((sample) => new Date(sample.t).getTime()),
        0,
      ) < staleThresholdMs;

    const stillHasGaps = objectHasSignificantGap(
      merged,
      sinceMs,
      untilMs,
      minGapBuckets,
    );

    if (stillStale || stillHasGaps) {
      const lookbackMinutes = resolveSdAnleggChartInfluxLookbackMinutes({
        mirrorByObject: batchForLookback,
        objectIds: [objectId],
        hours: input.hours,
        sinceMs,
      });

      const rows = await queryInfluxLivePointRows({
        token: input.influx.token,
        database: input.influx.database,
        tableName: input.influx.tableName,
        objectIds: [objectId],
        lookbackMinutes,
        maxRows: 10_000,
      });

      if (rows.length > 0) {
        const tailSamples = aggregateBacnetRowsTo15m(rows).map((row) => ({
          t: row.sampledAt.toISOString(),
          value: row.valueNum,
        }));
        merged = mergeInfraspawnSeriesSamples(merged, tailSamples);
      }
    }

    next.set(objectId, {
      ...existing,
      samples: filterSamplesSince(merged, sinceMs),
    });
  }

  return next;
}

export async function loadSdAnleggChartSeriesBatch(input: {
  sourceId: string;
  objectIds: string[];
  hours: number;
  influx?: SdAnleggInfluxCredentials;
}): Promise<Map<string, SdAnleggSeriesLoadResult>> {
  const uniqueObjectIds = [...new Set(input.objectIds)];
  const results = new Map<string, SdAnleggSeriesLoadResult>();

  if (uniqueObjectIds.length === 0) return results;

  const resolution = resolvePrimaryResolutionForHours(input.hours);
  const mirrorBatch = await loadInfraspawnMirrorSeriesBatch({
    sourceId: input.sourceId,
    objectIds: uniqueObjectIds,
    hours: input.hours,
    resolution,
  });

  for (const objectId of uniqueObjectIds) {
    const mirror = mirrorBatch.get(objectId) ?? { samples: [], unit: null };
    results.set(objectId, {
      samples: mirror.samples,
      unit: mirror.unit,
      resolution,
    });
  }

  if (!input.influx) return results;

  return enrichBatchWithInfluxTail({
    sourceId: input.sourceId,
    batch: results,
    objectIds: uniqueObjectIds,
    hours: input.hours,
    influx: input.influx,
  });
}
