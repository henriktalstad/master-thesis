import { resolveAlarmSignalTitle } from "@/lib/infraspawn/alarm-signal-label";

export type AlarmStatsRawRow = {
  day: string;
  sourceId: string;
  alarmText: string;
  objectId: string;
  count: number;
  objectName?: string | null;
  description?: string | null;
};

export type AlarmTypeStat = {
  typeKey: string;
  label: string;
  count: number;
};

export function slugifyAlarmTypeKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

export function aggregateAlarmTypeStats(
  rows: readonly AlarmStatsRawRow[],
  typeKey: string | null,
): {
  totalCount: number;
  byType: AlarmTypeStat[];
  dailyBuckets: Array<{ day: string; count: number }>;
} {
  const typeMap = new Map<string, { label: string; count: number }>();

  for (const row of rows) {
    const label = resolveAlarmSignalTitle({
      alarmText: row.alarmText,
      objectId: row.objectId,
      objectName: row.objectName,
      description: row.description,
    });
    const key = slugifyAlarmTypeKey(label);
    const existing = typeMap.get(key);
    if (existing) {
      existing.count += row.count;
    } else {
      typeMap.set(key, { label, count: row.count });
    }
  }

  const byType = [...typeMap.entries()]
    .map(([key, data]) => ({ typeKey: key, ...data }))
    .sort((a, b) => b.count - a.count);

  const dayMap = new Map<string, number>();
  for (const row of rows) {
    if (typeKey != null) {
      const rowKey = slugifyAlarmTypeKey(
        resolveAlarmSignalTitle({
          alarmText: row.alarmText,
          objectId: row.objectId,
          objectName: row.objectName,
          description: row.description,
        }),
      );
      if (rowKey !== typeKey) continue;
    }
    dayMap.set(row.day, (dayMap.get(row.day) ?? 0) + row.count);
  }

  const dailyBuckets = [...dayMap.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const totalCount =
    typeKey != null
      ? dailyBuckets.reduce((sum, bucket) => sum + bucket.count, 0)
      : byType.reduce((sum, type) => sum + type.count, 0);

  return { totalCount, byType, dailyBuckets };
}
