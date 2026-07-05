import "server-only";

import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/db";

export type LatestPostgresSampleRow = {
  sourceId: string;
  objectId: string;
  valueNum: number | null;
  sampledAt: Date;
};

/** Finest resolution (15m → hour → day), deretter nyeste sampledAt. */
export async function loadLatestPostgresSamplesByPoint(
  sourceIds: readonly string[],
): Promise<LatestPostgresSampleRow[]> {
  if (sourceIds.length === 0) return [];

  return prisma.$queryRaw<LatestPostgresSampleRow[]>(Prisma.sql`
    SELECT DISTINCT ON ("sourceId", "objectId")
      "sourceId",
      "objectId",
      "valueNum",
      "sampledAt"
    FROM "infraspawn_bacnet_samples"
    WHERE "sourceId" IN (${Prisma.join(sourceIds)})
    ORDER BY
      "sourceId",
      "objectId",
      CASE "resolution"
        WHEN '15m' THEN 0
        WHEN 'hour' THEN 1
        WHEN 'day' THEN 2
        ELSE 3
      END,
      "sampledAt" DESC
  `);
}

export async function loadLatestPostgresSamplesForPoints(
  points: readonly { sourceId: string; objectId: string }[],
): Promise<LatestPostgresSampleRow[]> {
  if (points.length === 0) return [];

  const sourceIds = [...new Set(points.map((point) => point.sourceId))];
  const objectIds = [...new Set(points.map((point) => point.objectId))];
  const keySet = new Set(
    points.map((point) => `${point.sourceId}:${point.objectId}`),
  );

  const rows = await prisma.$queryRaw<LatestPostgresSampleRow[]>(Prisma.sql`
    SELECT DISTINCT ON ("sourceId", "objectId")
      "sourceId",
      "objectId",
      "valueNum",
      "sampledAt"
    FROM "infraspawn_bacnet_samples"
    WHERE "sourceId" IN (${Prisma.join(sourceIds)})
      AND "objectId" IN (${Prisma.join(objectIds)})
    ORDER BY
      "sourceId",
      "objectId",
      CASE "resolution"
        WHEN '15m' THEN 0
        WHEN 'hour' THEN 1
        WHEN 'day' THEN 2
        ELSE 3
      END,
      "sampledAt" DESC
  `);

  return rows.filter((row) =>
    keySet.has(`${row.sourceId}:${row.objectId}`),
  );
}
