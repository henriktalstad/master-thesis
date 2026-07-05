import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";

export {
  INFRASPAWN_INFLUX_MAX_LOOKBACK_HOURS,
  INFRASPAWN_INFLUX_MAX_LOOKBACK_HOURS_DEFAULT,
  resolveInfluxMaxLookbackHours,
  getInfluxEarliestQueryableAt,
  clipRangeToInfluxLookback,
  evalStartsBeforeInfluxLookback,
} from "./influx-lookback";

export type AggregatedBacnetRow = InfraspawnBacnetRow & {
  sampleCount: number;
};

export type StoredSampleRow = {
  objectId: string;
  sampledAt: Date;
  valueNum: number | null;
  quality: string | null;
  sampleCount?: number | null;
};

type BucketState = AggregatedBacnetRow;

export function truncateToUtcMinutes(date: Date, stepMinutes: number): Date {
  const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const floored = Math.floor(totalMinutes / stepMinutes) * stepMinutes;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      Math.floor(floored / 60),
      floored % 60,
      0,
      0,
    ),
  );
}

export function truncateToUtc15m(date: Date): Date {
  return truncateToUtcMinutes(date, 15);
}

export function truncateToUtc5m(date: Date): Date {
  return truncateToUtcMinutes(date, 5);
}

export function truncateToUtc1m(date: Date): Date {
  return truncateToUtcMinutes(date, 1);
}

export function truncateToUtcHour(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0,
    ),
  );
}

export function truncateToUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export function toAggregatedBacnetRow(row: StoredSampleRow): AggregatedBacnetRow {
  return {
    objectId: row.objectId,
    sampledAt: row.sampledAt,
    valueNum: row.valueNum,
    quality: row.quality,
    objectName: null,
    description: null,
    unit: null,
    raw: {},
    sampleCount: row.sampleCount ?? 1,
  };
}

function aggregateBacnetRowsWithTruncate(
  rows: readonly InfraspawnBacnetRow[],
  truncate: (date: Date) => Date,
): AggregatedBacnetRow[] {
  const buckets = new Map<string, BucketState>();

  for (const row of rows) {
    const bucketStart = truncate(row.sampledAt);
    const key = `${row.objectId}\0${bucketStart.toISOString()}`;
    const existing = buckets.get(key);

    if (!existing || row.sampledAt >= existing.sampledAt) {
      buckets.set(key, {
        ...row,
        sampledAt: bucketStart,
        sampleCount: (existing?.sampleCount ?? 0) + 1,
      });
    } else {
      buckets.set(key, {
        ...existing,
        sampleCount: existing.sampleCount + 1,
      });
    }
  }

  return Array.from(buckets.values()).sort(
    (a, b) => a.sampledAt.getTime() - b.sampledAt.getTime(),
  );
}

function aggregateAggregatedRowsToBucket(
  rows: readonly AggregatedBacnetRow[],
  truncate: (date: Date) => Date,
): AggregatedBacnetRow[] {
  const buckets = new Map<string, BucketState>();

  for (const row of rows) {
    const bucketStart = truncate(row.sampledAt);
    const key = `${row.objectId}\0${bucketStart.toISOString()}`;
    const existing = buckets.get(key);

    if (!existing || row.sampledAt >= existing.sampledAt) {
      buckets.set(key, {
        ...row,
        sampledAt: bucketStart,
        sampleCount: (existing?.sampleCount ?? 0) + row.sampleCount,
      });
    } else {
      buckets.set(key, {
        ...existing,
        sampleCount: existing.sampleCount + row.sampleCount,
      });
    }
  }

  return Array.from(buckets.values()).sort(
    (a, b) => a.sampledAt.getTime() - b.sampledAt.getTime(),
  );
}

export function aggregateBacnetRowsTo15m(
  rows: readonly InfraspawnBacnetRow[],
): AggregatedBacnetRow[] {
  return aggregateBacnetRowsWithTruncate(rows, truncateToUtc15m);
}

export function aggregateBacnetRowsTo5m(
  rows: readonly InfraspawnBacnetRow[],
): AggregatedBacnetRow[] {
  return aggregateBacnetRowsWithTruncate(rows, truncateToUtc5m);
}

export function aggregateBacnetRowsTo1m(
  rows: readonly InfraspawnBacnetRow[],
): AggregatedBacnetRow[] {
  return aggregateBacnetRowsWithTruncate(rows, truncateToUtc1m);
}

export function aggregateBacnetRowsToHourly(
  rows: readonly InfraspawnBacnetRow[],
): AggregatedBacnetRow[] {
  return aggregateBacnetRowsWithTruncate(rows, truncateToUtcHour);
}

export function aggregateBacnetRowsToDaily(
  rows: readonly InfraspawnBacnetRow[],
): AggregatedBacnetRow[] {
  return aggregateBacnetRowsWithTruncate(rows, truncateToUtcDay);
}

export function rollupStoredRowsToHourly(
  rows: readonly StoredSampleRow[],
): AggregatedBacnetRow[] {
  return aggregateAggregatedRowsToBucket(
    rows.map(toAggregatedBacnetRow),
    truncateToUtcHour,
  );
}

export function rollupStoredRowsToDaily(
  rows: readonly StoredSampleRow[],
): AggregatedBacnetRow[] {
  return aggregateAggregatedRowsToBucket(
    rows.map(toAggregatedBacnetRow),
    truncateToUtcDay,
  );
}
