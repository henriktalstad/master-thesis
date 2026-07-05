import "server-only";

import { loadInfraspawnMirrorSeriesBatch } from "@/lib/infraspawn/postgres-series";
import { resolvePrimaryResolutionForHours } from "@/lib/infraspawn/resolution";
import type { InfraspawnChartSeriesEntry } from "@/lib/infraspawn/types";

export async function loadChartSeriesBatch(input: {
  sourceId: string;
  objectIds: string[];
  hours: number;
}): Promise<Map<string, InfraspawnChartSeriesEntry>> {
  const uniqueObjectIds = [...new Set(input.objectIds)];
  const results = new Map<string, InfraspawnChartSeriesEntry>();

  if (uniqueObjectIds.length === 0) return results;

  const resolution = resolvePrimaryResolutionForHours(input.hours);
  const batch = await loadInfraspawnMirrorSeriesBatch({
    sourceId: input.sourceId,
    objectIds: uniqueObjectIds,
    hours: input.hours,
    resolution,
  });

  for (const objectId of uniqueObjectIds) {
    const entry = batch.get(objectId) ?? { samples: [], unit: null };
    results.set(objectId, {
      sourceId: input.sourceId,
      objectId,
      samples: entry.samples,
      unit: entry.unit,
    });
  }

  return results;
}

export async function loadChartSeriesForPoints(input: {
  points: { sourceId: string; objectId: string }[];
  hours: number;
}): Promise<InfraspawnChartSeriesEntry[]> {
  const bySource = new Map<string, string[]>();
  for (const point of input.points) {
    const list = bySource.get(point.sourceId) ?? [];
    list.push(point.objectId);
    bySource.set(point.sourceId, list);
  }

  const batches = await Promise.all(
    [...bySource.entries()].map(async ([sourceId, objectIds]) =>
      loadChartSeriesBatch({ sourceId, objectIds, hours: input.hours }),
    ),
  );

  return batches.flatMap((batch) => [...batch.values()]);
}
