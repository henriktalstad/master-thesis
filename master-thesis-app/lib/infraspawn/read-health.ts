import "server-only";

import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/db";
import { loadLatestPostgresSamplesByPoint } from "@/lib/infraspawn/latest-postgres-samples";
import { parseInfraspawnPointStatusMetadata } from "@/lib/infraspawn/point-metadata";
import { INFRASPAWN_RESOLUTION_15M } from "@/lib/infraspawn/resolution";
import type { InfraspawnBuildingHealthSummary } from "@/lib/infraspawn/types";
import { minutesSinceIso } from "@/lib/infraspawn/display-format";
import {
  resolveInfraspawnPointDisplayStatus,
} from "@/lib/infraspawn/point-status";

export async function loadInfraspawnBuildingHealthSummary(input: {
  integrationId: string;
  buildingId: string;
}): Promise<InfraspawnBuildingHealthSummary> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sources = await prisma.infraspawnSource.findMany({
    where: {
      integrationId: input.integrationId,
      buildingId: input.buildingId,
      isActive: true,
    },
    select: {
      id: true,
      lastSuccessfulSyncAt: true,
      _count: {
        select: {
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

  if (sources.length === 0) {
    return {
      pointCount: 0,
      unhealthyPointCount: 0,
      alarmPointCount: 0,
      faultPointCount: 0,
      outOfServicePointCount: 0,
      noValuePointCount: 0,
      oldestSampleAt: null,
      newestSampleAt: null,
      newestSampleAgeMinutes: null,
      lastSuccessfulSyncAt: null,
      samplesLast24h: 0,
    };
  }

  const sourceIds = sources.map((source) => source.id);

  const [metaRows, latestSampleRows, sampleBounds24h, sampleBoundsOverall] =
    await Promise.all([
      prisma.infraspawnBacnetPointMeta.findMany({
        where: { sourceId: { in: sourceIds } },
        select: {
          sourceId: true,
          objectId: true,
          objectName: true,
          description: true,
          unit: true,
          rawMetadata: true,
        },
      }),
      loadLatestPostgresSamplesByPoint(sourceIds),
      prisma.$queryRaw<
        Array<{ oldest: Date | null; newest: Date | null }>
      >(Prisma.sql`
      SELECT
        MIN("sampledAt") AS oldest,
        MAX("sampledAt") AS newest
      FROM "infraspawn_bacnet_samples"
      WHERE "sourceId" IN (${Prisma.join(sourceIds)})
        AND "resolution" = ${INFRASPAWN_RESOLUTION_15M}
        AND "sampledAt" >= ${since24h}
    `),
      prisma.$queryRaw<
        Array<{ newest: Date | null }>
      >(Prisma.sql`
      SELECT MAX("sampledAt") AS newest
      FROM "infraspawn_bacnet_samples"
      WHERE "sourceId" IN (${Prisma.join(sourceIds)})
        AND "resolution" = ${INFRASPAWN_RESOLUTION_15M}
    `),
    ]);

  const latestByKey = new Map(
    latestSampleRows.map((row) => [`${row.sourceId}:${row.objectId}`, row]),
  );

  let unhealthyPointCount = 0;
  let alarmPointCount = 0;
  let faultPointCount = 0;
  let outOfServicePointCount = 0;
  let noValuePointCount = 0;

  for (const meta of metaRows) {
    const statusMeta = parseInfraspawnPointStatusMetadata(meta.rawMetadata);
    const latest = latestByKey.get(`${meta.sourceId}:${meta.objectId}`);
    const lastValue = latest?.valueNum ?? null;

    const point = {
      objectId: meta.objectId,
      objectName: meta.objectName,
      description: meta.description,
      unit: meta.unit,
      lastValue,
      quality: statusMeta?.quality ?? null,
      statusFault: statusMeta?.status_fault ?? false,
      statusInAlarm: statusMeta?.status_inAlarm ?? false,
      statusOutOfService: statusMeta?.status_outOfService ?? false,
    };

    const displayStatus = resolveInfraspawnPointDisplayStatus(point);
    if (displayStatus === "alarm") alarmPointCount += 1;
    if (displayStatus === "fault") faultPointCount += 1;
    if (displayStatus === "out_of_service") outOfServicePointCount += 1;
    if (displayStatus != null) unhealthyPointCount += 1;

    if (lastValue == null || Number.isNaN(lastValue)) {
      noValuePointCount += 1;
    }
  }

  const bounds24h = sampleBounds24h[0];
  const newestSampleAt =
    sampleBoundsOverall[0]?.newest?.toISOString() ?? null;
  const oldestSampleAt = bounds24h?.oldest?.toISOString() ?? null;

  const syncTimes = sources
    .map((source) => source.lastSuccessfulSyncAt)
    .filter((date): date is Date => date != null);
  const lastSuccessfulSyncAt =
    syncTimes.length > 0
      ? new Date(
          Math.max(...syncTimes.map((date) => date.getTime())),
        ).toISOString()
      : null;

  return {
    pointCount: metaRows.length,
    unhealthyPointCount,
    alarmPointCount,
    faultPointCount,
    outOfServicePointCount,
    noValuePointCount,
    oldestSampleAt,
    newestSampleAt,
    newestSampleAgeMinutes: minutesSinceIso(newestSampleAt),
    lastSuccessfulSyncAt,
    samplesLast24h: sources.reduce(
      (sum, source) => sum + source._count.samples,
      0,
    ),
  };
}
