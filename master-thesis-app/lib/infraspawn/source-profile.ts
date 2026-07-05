import "server-only";

import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/db";
import { INFRASPAWN_RESOLUTION_15M } from "@/lib/infraspawn/resolution";
import {
  isInfraspawnPointHealthy,
  parseInfraspawnPointStatusMetadata,
} from "@/lib/infraspawn/point-metadata";
import { minutesSinceIso } from "@/lib/infraspawn/display-format";

export type InfraspawnSourceProfile = {
  sourceId: string;
  label: string;
  influxDatabase: string;
  buildingName: string | null;
  isActive: boolean;
  pointCount: number;
  samplesLast24h: number;
  oldestSampleAt: string | null;
  newestSampleAt: string | null;
  syncLagMinutes: number | null;
  lastSuccessfulSyncAt: string | null;
  syncStatus: string | null;
  watermarkAt: string | null;
  unitCounts: Record<string, number>;
  qualityCounts: Record<string, number>;
  unhealthyPointCount: number;
  estimatedPollIntervalSeconds: number | null;
};

export async function profileInfraspawnSource(
  sourceId: string,
): Promise<InfraspawnSourceProfile | null> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const source = await prisma.infraspawnSource.findUnique({
    where: { id: sourceId },
    include: {
      building: { select: { name: true } },
      syncState: true,
      _count: {
        select: {
          pointMeta: true,
          samples: {
            where: {
              sampledAt: { gte: since24h },
              resolution: INFRASPAWN_RESOLUTION_15M,
            },
          },
        },
      },
    },
  });

  if (!source) return null;

  const [sampleBounds24h, sampleBoundsOverall, metaRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ oldest: Date | null }>
    >(Prisma.sql`
      SELECT MIN("sampledAt") AS oldest
      FROM "infraspawn_bacnet_samples"
      WHERE "sourceId" = ${sourceId}
        AND "resolution" = ${INFRASPAWN_RESOLUTION_15M}
        AND "sampledAt" >= ${since24h}
    `),
    prisma.$queryRaw<
      Array<{ newest: Date | null }>
    >(Prisma.sql`
      SELECT MAX("sampledAt") AS newest
      FROM "infraspawn_bacnet_samples"
      WHERE "sourceId" = ${sourceId}
        AND "resolution" = ${INFRASPAWN_RESOLUTION_15M}
    `),
    prisma.infraspawnBacnetPointMeta.findMany({
      where: { sourceId },
      select: { unit: true, rawMetadata: true },
    }),
  ]);

  const bounds24h = sampleBounds24h[0];
  const newestSampleAt =
    sampleBoundsOverall[0]?.newest?.toISOString() ?? null;
  const oldestSampleAt = bounds24h?.oldest?.toISOString() ?? null;

  const unitCounts: Record<string, number> = {};
  const qualityCounts: Record<string, number> = {};
  let unhealthyPointCount = 0;

  for (const meta of metaRows) {
    const unit = meta.unit?.trim() || "ukjent";
    unitCounts[unit] = (unitCounts[unit] ?? 0) + 1;

    const status = parseInfraspawnPointStatusMetadata(meta.rawMetadata);
    const quality = status?.quality?.trim() || "ukjent";
    qualityCounts[quality] = (qualityCounts[quality] ?? 0) + 1;

    if (!isInfraspawnPointHealthy(status)) {
      unhealthyPointCount += 1;
    }
  }

  const sampleCount = source._count.samples;
  const pointCount = Math.max(source._count.pointMeta, 1);
  const estimatedPollIntervalSeconds =
    sampleCount > 0
      ? Math.round((24 * 60 * 60) / (sampleCount / pointCount))
      : null;

  return {
    sourceId: source.id,
    label: source.label,
    influxDatabase: source.influxDatabase,
    buildingName: source.building?.name ?? null,
    isActive: source.isActive,
    pointCount: source._count.pointMeta,
    samplesLast24h: sampleCount,
    oldestSampleAt,
    newestSampleAt,
    syncLagMinutes: minutesSinceIso(newestSampleAt),
    lastSuccessfulSyncAt: source.lastSuccessfulSyncAt?.toISOString() ?? null,
    syncStatus: source.syncState?.status ?? null,
    watermarkAt: source.syncState?.watermarkAt?.toISOString() ?? null,
    unitCounts,
    qualityCounts,
    unhealthyPointCount,
    estimatedPollIntervalSeconds,
  };
}

export async function profileInfraspawnSourcesForOrg(
  organizationId: string,
): Promise<InfraspawnSourceProfile[]> {
  const sources = await prisma.infraspawnSource.findMany({
    where: { organizationId },
    select: { id: true },
    orderBy: { label: "asc" },
  });

  const profiles = await Promise.all(
    sources.map((source) => profileInfraspawnSource(source.id)),
  );

  return profiles.filter((profile): profile is InfraspawnSourceProfile =>
    profile != null,
  );
}
