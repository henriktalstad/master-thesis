import "server-only";

import { prisma } from "@/lib/db";
import { hasDatabaseUrl, getDefaultBuildingSlug } from "@/lib/config/env";

export type DbHealthSummary = {
  connected: boolean;
  buildingSlug: string;
  pointMetaCount: number | null;
  sampleCount: number | null;
  controlPlanCount: number | null;
  syncStatus: string | null;
  lastSyncAt: string | null;
  error: string | null;
};

export async function getDbHealthSummary(): Promise<DbHealthSummary> {
  const buildingSlug = getDefaultBuildingSlug();
  const base: DbHealthSummary = {
    connected: false,
    buildingSlug,
    pointMetaCount: null,
    sampleCount: null,
    controlPlanCount: null,
    syncStatus: null,
    lastSyncAt: null,
    error: null,
  };

  if (!hasDatabaseUrl()) {
    return {
      ...base,
      error: "DATABASE_URL mangler — kopier .env.example til .env.local",
    };
  }

  try {
    const building = await prisma.building.findFirst({
      where: { slug: buildingSlug },
      select: {
        id: true,
        infraspawnSources: {
          where: { isActive: true },
          take: 1,
          select: {
            id: true,
            lastSyncAt: true,
            syncState: { select: { status: true } },
          },
        },
        _count: {
          select: { sdAnleggMpcPipelineRuns: true },
        },
      },
    });

    const source = building?.infraspawnSources[0];
    let pointMetaCount = 0;
    let sampleCount = 0;

    if (source) {
      [pointMetaCount, sampleCount] = await Promise.all([
        prisma.infraspawnBacnetPointMeta.count({
          where: { sourceId: source.id },
        }),
        prisma.infraspawnBacnetSample.count({
          where: { sourceId: source.id },
        }),
      ]);
    }

    return {
      connected: true,
      buildingSlug,
      pointMetaCount,
      sampleCount,
      controlPlanCount: building?._count.sdAnleggMpcPipelineRuns ?? 0,
      syncStatus: source?.syncState?.status ?? null,
      lastSyncAt: source?.lastSyncAt?.toISOString() ?? null,
      error: building ? null : `Fant ikke bygg med slug «${buildingSlug}»`,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : "Databasefeil",
    };
  }
}

export async function listPointMetaPreview(limit = 12) {
  if (!hasDatabaseUrl()) return [];

  const buildingSlug = getDefaultBuildingSlug();
  const building = await prisma.building.findFirst({
    where: { slug: buildingSlug },
    select: {
      infraspawnSources: {
        where: { isActive: true },
        take: 1,
        select: { id: true },
      },
    },
  });

  const sourceId = building?.infraspawnSources[0]?.id;
  if (!sourceId) return [];

  return prisma.infraspawnBacnetPointMeta.findMany({
    where: { sourceId },
    orderBy: { objectName: "asc" },
    take: limit,
    select: {
      objectId: true,
      objectName: true,
      description: true,
      unit: true,
    },
  });
}
