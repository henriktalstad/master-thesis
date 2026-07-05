import "server-only";

import {
  resolvePrimaryResolutionForHours,
  type InfraspawnSampleResolution,
} from "@/lib/infraspawn/resolution";
import { resolveSampleObjectIdAliases } from "@/lib/infraspawn/resolve-sample-object-ids";
import { prisma } from "@/lib/db";

export type InfraspawnMirrorSample = {
  t: string;
  value: number | null;
};

async function loadSamplesForResolution(input: {
  sourceId: string;
  objectIds: string[];
  since: Date;
  resolution: InfraspawnSampleResolution;
}): Promise<
  Map<string, { samples: InfraspawnMirrorSample[]; unit: string | null }>
> {
  const uniqueObjectIds = [...new Set(input.objectIds)];
  const results = new Map<
    string,
    { samples: InfraspawnMirrorSample[]; unit: string | null }
  >();

  if (uniqueObjectIds.length === 0) return results;

  const [metaRows, sampleRows] = await Promise.all([
    prisma.infraspawnBacnetPointMeta.findMany({
      where: {
        sourceId: input.sourceId,
        objectId: { in: uniqueObjectIds },
      },
      select: { objectId: true, unit: true },
    }),
    prisma.infraspawnBacnetSample.findMany({
      where: {
        sourceId: input.sourceId,
        objectId: { in: uniqueObjectIds },
        resolution: input.resolution,
        sampledAt: { gte: input.since },
      },
      select: { objectId: true, sampledAt: true, valueNum: true },
      orderBy: { sampledAt: "asc" },
    }),
  ]);

  const unitByObjectId = new Map(
    metaRows.map((row) => [row.objectId, row.unit]),
  );

  for (const objectId of uniqueObjectIds) {
    results.set(objectId, {
      samples: [],
      unit: unitByObjectId.get(objectId) ?? null,
    });
  }

  for (const row of sampleRows) {
    const entry = results.get(row.objectId);
    if (!entry) continue;
    entry.samples.push({
      t: row.sampledAt.toISOString(),
      value: row.valueNum,
    });
  }

  return results;
}

export async function loadInfraspawnMirrorSeries(input: {
  sourceId: string;
  objectId: string;
  hours: number;
  resolution?: InfraspawnSampleResolution;
}): Promise<{ samples: InfraspawnMirrorSample[]; unit: string | null }> {
  const resolution =
    input.resolution ?? resolvePrimaryResolutionForHours(input.hours);
  const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);

  const batch = await loadSamplesForResolution({
    sourceId: input.sourceId,
    objectIds: [input.objectId],
    since,
    resolution,
  });

  return batch.get(input.objectId) ?? { samples: [], unit: null };
}

export async function loadInfraspawnMirrorSeriesBatch(input: {
  sourceId: string;
  objectIds: string[];
  hours: number;
  resolution?: InfraspawnSampleResolution;
}): Promise<
  Map<string, { samples: InfraspawnMirrorSample[]; unit: string | null }>
> {
  const uniqueObjectIds = [...new Set(input.objectIds)];
  const resolution =
    input.resolution ?? resolvePrimaryResolutionForHours(input.hours);
  const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);

  const aliasMap = await resolveSampleObjectIdAliases(
    input.sourceId,
    uniqueObjectIds,
  );
  const canonicalObjectIds = [
    ...new Set(uniqueObjectIds.map((objectId) => aliasMap.get(objectId) ?? objectId)),
  ];

  const primaryCanonical = await loadSamplesForResolution({
    sourceId: input.sourceId,
    objectIds: canonicalObjectIds,
    since,
    resolution,
  });

  const primary = new Map<
    string,
    { samples: InfraspawnMirrorSample[]; unit: string | null }
  >();
  for (const requested of uniqueObjectIds) {
    const canonical = aliasMap.get(requested) ?? requested;
    primary.set(
      requested,
      primaryCanonical.get(canonical) ?? { samples: [], unit: null },
    );
  }

  if (resolution !== "15m") {
    return primary;
  }

  const needsFallback = uniqueObjectIds.filter((objectId) => {
    const entry = primary.get(objectId);
    return !entry || entry.samples.length === 0;
  });

  if (needsFallback.length === 0) {
    return primary;
  }

  const needsFallbackCanonical = [
    ...new Set(
      needsFallback.map((objectId) => aliasMap.get(objectId) ?? objectId),
    ),
  ];

  const hourFallbackCanonical = await loadSamplesForResolution({
    sourceId: input.sourceId,
    objectIds: needsFallbackCanonical,
    since,
    resolution: "hour",
  });

  for (const objectId of needsFallback) {
    const canonical = aliasMap.get(objectId) ?? objectId;
    const hourEntry = hourFallbackCanonical.get(canonical);
    if (!hourEntry || hourEntry.samples.length === 0) continue;
    primary.set(objectId, hourEntry);
  }

  return primary;
}
