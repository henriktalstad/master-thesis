import "server-only";

import {
  aggregateBacnetRowsTo15m,
  clipRangeToInfluxLookback,
  resolveInfluxMaxLookbackHours,
  type AggregatedBacnetRow,
} from "@/lib/infraspawn/bucket-aggregate";
import { getInfraspawnInfluxHost } from "@/lib/infraspawn/influx-host";
import { buildInfluxBacnetObjectIdFilter } from "@/lib/infraspawn/influx-sql-fields";
import { resolveInfluxTableName } from "@/lib/infraspawn/influx-table";
import { formatInfluxSqlTimeLiteral } from "@/lib/infraspawn/influx-sql-time";
import { INFRASPAWN_RESOLUTION_15M } from "@/lib/infraspawn/resolution";
import {
  advanceSyncAfterEmptyWindow,
  advanceSyncAfterPage,
  computeSyncWindowUntil,
  INFRASPAWN_SYNC_QUERY_WINDOW_MS,
  isInfluxFileLimitError,
  shrinkSyncQueryWindowMs,
} from "@/lib/infraspawn/sync-query-window";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";
import { prisma } from "@/lib/db";
import { upsertMetaBatch } from "@/services/infraspawn/batch-meta-upsert";
import { upsertSampleBatch } from "@/services/infraspawn/batch-sample-upsert";
import { queryInfluxSql } from "@/services/infraspawn/influx-query";
import { resolveInfluxApiToken } from "@/services/infraspawn/source-influx-credentials";

const MAX_ROWS_PER_PAGE = 25_000;
const DEFAULT_MAX_PAGES = 24;

function formatInfluxTimestamp(d: Date): string {
  return formatInfluxSqlTimeLiteral(d);
}

async function fetchInfluxPage(input: {
  token: string;
  database: string;
  tableName: string;
  after: Date;
  until: Date;
  objectIds: string[];
}): Promise<InfraspawnBacnetRow[]> {
  const fromIso = formatInfluxTimestamp(input.after);
  const untilIso = formatInfluxTimestamp(input.until);
  const objectFilter = buildInfluxBacnetObjectIdFilter(input.objectIds);
  const sql = `SELECT * FROM ${input.tableName} WHERE time > '${fromIso}' AND time <= '${untilIso}' ${objectFilter} ORDER BY time ASC LIMIT ${MAX_ROWS_PER_PAGE}`;

  const { rows } = await queryInfluxSql({
    host: getInfraspawnInfluxHost(),
    token: input.token,
    database: input.database,
    sql,
  });

  return rows;
}

async function fetchInfluxPageWithRetry(input: {
  token: string;
  database: string;
  tableName: string;
  after: Date;
  until: Date;
  objectIds: string[];
}): Promise<{ rows: InfraspawnBacnetRow[]; effectiveUntil: Date }> {
  let effectiveUntil = input.until;

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const rows = await fetchInfluxPage({ ...input, until: effectiveUntil });
      return { rows, effectiveUntil };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ukjent Influx-feil";
      const spanMs = effectiveUntil.getTime() - input.after.getTime();
      const shrunkSpan = shrinkSyncQueryWindowMs(spanMs);
      if (isInfluxFileLimitError(message) && shrunkSpan != null) {
        effectiveUntil = new Date(input.after.getTime() + shrunkSpan);
        continue;
      }
      throw error;
    }
  }

  return fetchInfluxPageWithRetry(input);
}

export type FetchControlSignalsRangeResult = {
  success: boolean;
  rowsUpserted: number;
  rawRowsFetched: number;
  pagesFetched: number;
  aggregatedRows: AggregatedBacnetRow[];
  message: string;
};

export async function fetchControlSignalsRangeFromInflux(input: {
  sourceId: string;
  objectIds: string[];
  start: Date;
  end: Date;
  maxPages?: number;
  persist?: boolean;
}): Promise<FetchControlSignalsRangeResult> {
  const uniqueObjectIds = [...new Set(input.objectIds)];
  const persist = input.persist !== false;
  const empty = {
    success: false,
    rowsUpserted: 0,
    rawRowsFetched: 0,
    pagesFetched: 0,
    aggregatedRows: [] as AggregatedBacnetRow[],
    message: "",
  };

  if (uniqueObjectIds.length === 0) {
    return { ...empty, message: "Ingen objectIds" };
  }

  const clipped = clipRangeToInfluxLookback({
    start: input.start,
    end: input.end,
  });
  const lookbackHours = resolveInfluxMaxLookbackHours();

  if (!clipped.queryable) {
    return {
      ...empty,
      message: `Influx spørres bare ${lookbackHours} t tilbake — eldre data må finnes i Postgres`,
    };
  }

  const source = await prisma.infraspawnSource.findUnique({
    where: { id: input.sourceId },
    select: {
      id: true,
      isActive: true,
      apiTokenEncrypted: true,
      influxDatabase: true,
      metadata: true,
    },
  });

  if (!source?.isActive) {
    return { ...empty, message: "Kilde ikke funnet eller inaktiv" };
  }

  const token = resolveInfluxApiToken(source.apiTokenEncrypted);
  const tableName = resolveInfluxTableName(source.metadata);
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const queryStart = clipped.start;
  const queryEnd = clipped.end;

  let cursor = queryStart;
  const syncUntil = queryEnd;
  let windowUntil = computeSyncWindowUntil({
    cursor,
    syncUntil,
    windowMs: INFRASPAWN_SYNC_QUERY_WINDOW_MS,
  });

  let rowsUpserted = 0;
  let rawRowsFetched = 0;
  let pagesFetched = 0;
  const aggregatedRows: AggregatedBacnetRow[] = [];
  const allowedObjectIds = new Set(uniqueObjectIds);

  for (let page = 0; page < maxPages; page++) {
    if (cursor.getTime() >= syncUntil.getTime()) break;

    const { rows: pageRows, effectiveUntil } = await fetchInfluxPageWithRetry({
      token,
      database: source.influxDatabase,
      tableName,
      after: cursor,
      until: windowUntil,
      objectIds: uniqueObjectIds,
    });

    pagesFetched += 1;
    rawRowsFetched += pageRows.length;

    if (pageRows.length === 0) {
      const next = advanceSyncAfterEmptyWindow({
        windowUntil: effectiveUntil,
        syncUntil,
        windowMs: INFRASPAWN_SYNC_QUERY_WINDOW_MS,
      });
      cursor = next.cursor;
      if (next.done) break;
      windowUntil = next.windowUntil;
      continue;
    }

    const filtered = pageRows.filter((row) =>
      allowedObjectIds.has(row.objectId),
    );
    if (filtered.length > 0) {
      const quarterHourRows = aggregateBacnetRowsTo15m(filtered);
      aggregatedRows.push(...quarterHourRows);
      if (persist) {
        await upsertMetaBatch(input.sourceId, filtered);
        if (quarterHourRows.length > 0) {
          await upsertSampleBatch(
            input.sourceId,
            quarterHourRows,
            INFRASPAWN_RESOLUTION_15M,
          );
          rowsUpserted += quarterHourRows.length;
        }
      }
    }

    const pageMax = pageRows.reduce<Date>(
      (max, row) => (row.sampledAt > max ? row.sampledAt : max),
      pageRows[0]!.sampledAt,
    );

    const next = advanceSyncAfterPage({
      cursor,
      windowUntil: effectiveUntil,
      syncUntil,
      pageMax,
      rowCount: pageRows.length,
      maxRowsPerRun: MAX_ROWS_PER_PAGE,
      overlapMs: 30_000,
      windowMs: INFRASPAWN_SYNC_QUERY_WINDOW_MS,
    });
    cursor = next.cursor;
    if (next.done) {
      if (effectiveUntil.getTime() < windowUntil.getTime()) {
        cursor = new Date(pageMax.getTime() - 30_000);
      } else {
        break;
      }
    } else {
      windowUntil = next.windowUntil;
    }
  }

  return {
    success: true,
    rowsUpserted,
    rawRowsFetched,
    pagesFetched,
    aggregatedRows,
    message: clipped.clipped
      ? `Influx direkte (${lookbackHours} t cap): ${rowsUpserted} 15m-rader (${pagesFetched} sider)`
      : `Influx direkte: ${rowsUpserted} 15m-rader (${pagesFetched} sider)`,
  };
}

/**
 * Henter kontrollsignaler direkte fra Influx (maks ~2 d tilbake) og persisterer 15m i Postgres.
 * Eldre eval-data må allerede ligge i Postgres fra kontinuerlig sync.
 */
export async function fetchAndPersistControlSignalsRange(input: {
  sourceId: string;
  objectIds: string[];
  start: Date;
  end: Date;
  maxPages?: number;
}): Promise<FetchControlSignalsRangeResult> {
  return fetchControlSignalsRangeFromInflux({ ...input, persist: true });
}
