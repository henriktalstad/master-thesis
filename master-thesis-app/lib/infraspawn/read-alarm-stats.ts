import "server-only";

import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/db";
import {
  aggregateAlarmTypeStats,
  type AlarmStatsRawRow,
} from "@/lib/infraspawn/aggregate-alarm-type-stats";
import type {
  InfraspawnAlarmStats,
  InfraspawnAlarmStatsPeriod,
} from "@/lib/infraspawn/alarm-stats-types";
import {
  buildAlarmPointLookupKey,
  loadPointMetaForAlarmKeys,
} from "@/lib/infraspawn/load-point-meta-for-alarm-keys";
import { addDaysToYmd, osloYmdFromDate, toUTCForOslo } from "@/lib/utils";

function resolveAlarmStatsPeriodWindow(
  periodDays: InfraspawnAlarmStatsPeriod,
  now: Date = new Date(),
): { from: Date; fromYmd: string; toYmd: string } {
  const todayYmd = osloYmdFromDate(now);
  const fromYmd = addDaysToYmd(todayYmd, -periodDays);
  return {
    from: new Date(toUTCForOslo(fromYmd, 0)),
    fromYmd,
    toYmd: todayYmd,
  };
}

export async function getInfraspawnAlarmStatsForBuilding(input: {
  buildingId: string;
  periodDays: InfraspawnAlarmStatsPeriod;
  typeKey?: string | null;
}): Promise<InfraspawnAlarmStats> {
  const { from, fromYmd, toYmd } = resolveAlarmStatsPeriodWindow(input.periodDays);
  const to = new Date(toUTCForOslo(addDaysToYmd(toYmd, 1), 0));

  const rawRows = await prisma.$queryRaw<
    Array<{
      day: string;
      sourceId: string;
      alarmText: string;
      objectId: string;
      count: bigint;
    }>
  >(Prisma.sql`
    SELECT
      to_char(
        date_trunc('day', "activatedAt" AT TIME ZONE 'Europe/Oslo'),
        'YYYY-MM-DD'
      ) AS day,
      "sourceId",
      "alarmText",
      "objectId",
      COUNT(*)::bigint AS count
    FROM "infraspawn_alarm_events"
    WHERE "buildingId" = ${input.buildingId}
      AND "activatedAt" >= ${from}
      AND "activatedAt" < ${to}
    GROUP BY 1, 2, 3, 4
    ORDER BY 1 ASC
  `);

  const uniqueKeys = [
    ...new Map(
      rawRows.map((row) => [
        buildAlarmPointLookupKey(row.sourceId, row.objectId),
        { sourceId: row.sourceId, objectId: row.objectId },
      ]),
    ).values(),
  ];

  const pointMeta = await loadPointMetaForAlarmKeys(uniqueKeys);

  const enrichedRows: AlarmStatsRawRow[] = rawRows.map((row) => {
    const meta = pointMeta.get(
      buildAlarmPointLookupKey(row.sourceId, row.objectId),
    );
    return {
      day: row.day,
      sourceId: row.sourceId,
      alarmText: row.alarmText,
      objectId: row.objectId,
      count: Number(row.count),
      objectName: meta?.objectName ?? null,
      description: meta?.description ?? null,
    };
  });

  const aggregated = aggregateAlarmTypeStats(
    enrichedRows,
    input.typeKey ?? null,
  );

  return {
    periodDays: input.periodDays,
    from: new Date(toUTCForOslo(fromYmd, 0)).toISOString(),
    to: to.toISOString(),
    totalCount: aggregated.totalCount,
    byType: aggregated.byType,
    dailyBuckets: aggregated.dailyBuckets,
  };
}
