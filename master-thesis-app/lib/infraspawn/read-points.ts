import "server-only";

import { prisma } from "@/lib/db";
import {
  loadLatestPostgresSamplesByPoint,
  loadLatestPostgresSamplesForPoints,
} from "@/lib/infraspawn/latest-postgres-samples";
import { parseInfraspawnPointStatusMetadata } from "@/lib/infraspawn/point-metadata";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function mapPointStatus(rawMetadata: unknown) {
  const status = parseInfraspawnPointStatusMetadata(rawMetadata);
  return {
    quality: status?.quality ?? null,
    statusFault: status?.status_fault ?? false,
    statusInAlarm: status?.status_inAlarm ?? false,
    statusOutOfService: status?.status_outOfService ?? false,
    statusOverridden: status?.status_overridden ?? false,
  };
}

function mapMetaToPointListItem(
  meta: {
    sourceId: string;
    objectId: string;
    objectName: string | null;
    description: string | null;
    unit: string | null;
    rawMetadata: unknown;
  },
  sourceLabelById: Map<string, string>,
  latest: { valueNum: number | null; sampledAt: Date } | undefined,
): InfraspawnPointListItem {
  const status = mapPointStatus(meta.rawMetadata);

  return {
    sourceId: meta.sourceId,
    sourceLabel: sourceLabelById.get(meta.sourceId) ?? meta.sourceId,
    objectId: meta.objectId,
    objectName: meta.objectName,
    description: meta.description,
    unit: meta.unit,
    lastValue: latest?.valueNum ?? null,
    lastSampledAt: latest?.sampledAt.toISOString() ?? null,
    valueSource: "postgres-sync",
    ...status,
  };
}

/** Metadata uten måleverdi — brukes når kun liste/status trengs. */
export async function listInfraspawnPointMetaForBuilding(
  integrationId: string,
  buildingId: string,
): Promise<InfraspawnPointListItem[]> {
  const sources = await prisma.infraspawnSource.findMany({
    where: {
      integrationId,
      buildingId,
      isActive: true,
    },
    select: { id: true, label: true },
  });

  if (sources.length === 0) return [];

  const sourceIds = sources.map((s) => s.id);
  const sourceLabelById = new Map(sources.map((s) => [s.id, s.label]));

  const metaRows = await prisma.infraspawnBacnetPointMeta.findMany({
    where: { sourceId: { in: sourceIds } },
    orderBy: [{ objectName: "asc" }, { objectId: "asc" }],
  });

  return metaRows.map((meta) =>
    mapMetaToPointListItem(meta, sourceLabelById, undefined),
  );
}

/** Fyll hull etter initial paint fra synkede samples. */
export async function fillPointsMissingValuesFromPostgres(
  points: readonly InfraspawnPointListItem[],
): Promise<InfraspawnPointListItem[]> {
  const missing = points.filter((point) => point.lastValue == null);
  if (missing.length === 0) {
    return [...points];
  }

  const syncedRows = await loadLatestPostgresSamplesForPoints(
    missing.map((point) => ({
      sourceId: point.sourceId,
      objectId: point.objectId,
    })),
  );
  const syncedByKey = new Map(
    syncedRows.map((row) => [
      `${row.sourceId}:${row.objectId}`,
      {
        lastValue: row.valueNum,
        lastSampledAt: row.sampledAt.toISOString(),
      },
    ]),
  );

  return points.map((point) => {
    if (point.lastValue != null) return point;
    const fallback = syncedByKey.get(`${point.sourceId}:${point.objectId}`);
    if (!fallback || fallback.lastValue == null) return point;

    return {
      ...point,
      lastValue: fallback.lastValue,
      lastSampledAt: fallback.lastSampledAt,
      valueSource: "postgres-sync",
    };
  });
}

export async function listInfraspawnPointsForBuilding(
  integrationId: string,
  buildingId: string,
): Promise<InfraspawnPointListItem[]> {
  const sources = await prisma.infraspawnSource.findMany({
    where: {
      integrationId,
      buildingId,
      isActive: true,
    },
    select: { id: true, label: true },
  });

  if (sources.length === 0) return [];

  const sourceIds = sources.map((s) => s.id);
  const sourceLabelById = new Map(sources.map((s) => [s.id, s.label]));

  const metaRows = await prisma.infraspawnBacnetPointMeta.findMany({
    where: { sourceId: { in: sourceIds } },
    orderBy: [{ objectName: "asc" }, { objectId: "asc" }],
  });

  if (metaRows.length === 0) return [];

  const latestRows = await loadLatestPostgresSamplesByPoint(sourceIds);

  const latestByKey = new Map(
    latestRows.map((row) => [`${row.sourceId}:${row.objectId}`, row]),
  );

  return metaRows.map((meta) => {
    const latest = latestByKey.get(`${meta.sourceId}:${meta.objectId}`);
    return mapMetaToPointListItem(meta, sourceLabelById, latest);
  });
}
