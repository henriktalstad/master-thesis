import "server-only";

import {
  aggregateBacnetRowsTo15m,
  resolveInfluxMaxLookbackHours,
} from "@/lib/infraspawn/bucket-aggregate";
import { getInfraspawnInfluxHost } from "@/lib/infraspawn/influx-host";
import { resolveInfluxTableName } from "@/lib/infraspawn/influx-table";
import { INFRASPAWN_RESOLUTION_15M } from "@/lib/infraspawn/resolution";
import {
  advanceSyncAfterEmptyWindow,
  advanceSyncAfterPage,
  computeSyncWindowUntil,
  INFRASPAWN_SYNC_QUERY_WINDOW_MS,
  isInfluxFileLimitError,
  shrinkSyncQueryWindowMs,
} from "@/lib/infraspawn/sync-query-window";
import { normalizeInfraspawnSyncError } from "@/lib/infraspawn/sync-errors";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";
import { prisma, withPrismaRetry } from "@/lib/db";
import { resolveInfluxApiToken } from "@/services/infraspawn/source-influx-credentials";
import { upsertMetaBatch } from "@/services/infraspawn/batch-meta-upsert";
import { upsertSampleBatch } from "@/services/infraspawn/batch-sample-upsert";
import { queryInfluxSql } from "@/services/infraspawn/influx-query";
import { detectInfraspawnAlarmTransitions } from "@/lib/infraspawn/detect-alarm-transitions";
import { escapeInfluxSqlString } from "@/lib/infraspawn/influx-sql-literal";
import {
  formatInfluxSqlTimeLiteral,
  INFRASPAWN_HOT_TAIL_LOOKBACK_HOURS,
  influxRowTimeLiteral,
} from "@/lib/infraspawn/influx-sql-time";
import { claimInfraspawnSourceSync } from "@/lib/infraspawn/claim-sync-source";
import { reconcileStaleOpenAlarms } from "@/lib/infraspawn/reconcile-stale-open-alarms";
import { resolveSyncWatermarkAfterRun } from "@/lib/infraspawn/resolve-sync-watermark";
import { backfillSparseMirrorSignals } from "@/services/infraspawn/backfill-sparse-mirror-signals";

const SYNC_OVERLAP_MS = 30_000;
const MAX_ROWS_PER_RUN = 25_000;
const MAX_SYNC_PAGES = 30;
const RECENT_PRIORITY_MS = 6 * 60 * 60 * 1000;
const DEFAULT_TAIL_MAX_PAGES = 36;
const DEFAULT_SYNC_CONCURRENCY = 3;
const INFRASPAWN_SYNC_STATUS_TX = { maxWait: 15_000, timeout: 30_000 } as const;

function getTailMaxPages(): number {
  const raw = process.env.INFRASPAWN_SYNC_TAIL_MAX_PAGES;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_TAIL_MAX_PAGES;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TAIL_MAX_PAGES;
}

function getSyncConcurrency(): number {
  const raw = process.env.INFRASPAWN_SYNC_CONCURRENCY;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_SYNC_CONCURRENCY;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SYNC_CONCURRENCY;
}

function formatInfluxTimestamp(d: Date): string {
  return formatInfluxSqlTimeLiteral(d);
}

function initialLookbackFrom(now: Date): Date {
  return new Date(
    now.getTime() - resolveInfluxMaxLookbackHours() * 3_600_000,
  );
}

async function recordSyncFailure(sourceId: string, message: string) {
  try {
    await withPrismaRetry(() =>
      prisma.$transaction(
        [
          prisma.infraspawnSyncState.update({
            where: { sourceId },
            data: { status: "ERROR", lastError: message },
          }),
          prisma.infraspawnSource.update({
            where: { id: sourceId },
            data: { lastError: message },
          }),
        ],
        INFRASPAWN_SYNC_STATUS_TX,
      ),
    );
  } catch (error) {
    console.error("[infraspawn.sync] recordSyncFailure", {
      sourceId,
      message,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function finalizeInfraspawnSyncSuccess(input: {
  sourceId: string;
  integrationId: string;
  now: Date;
  nextWatermark: Date;
  rowsUpserted: number;
}): Promise<void> {
  await withPrismaRetry(() =>
    prisma.$transaction(
      [
        prisma.infraspawnSyncState.update({
          where: { sourceId: input.sourceId },
          data: {
            status: "SUCCESS",
            watermarkAt: input.nextWatermark,
            rowsUpserted: input.rowsUpserted,
            lastError: null,
          },
        }),
        prisma.infraspawnSource.update({
          where: { id: input.sourceId },
          data: {
            lastSuccessfulSyncAt: input.now,
            lastError: null,
          },
        }),
        prisma.integration.update({
          where: { id: input.integrationId },
          data: {
            lastSyncAt: input.now,
            lastSuccessfulSyncAt: input.now,
            status: "ACTIVE",
          },
        }),
      ],
      INFRASPAWN_SYNC_STATUS_TX,
    ),
  );
}

async function fetchInfluxPage(input: {
  token: string;
  database: string;
  tableName: string;
  until: Date;
  after?: Date;
  afterLiteral?: string;
  useRelativeLowerBound?: boolean;
  lookbackHours?: number;
  order?: "ASC" | "DESC";
}): Promise<InfraspawnBacnetRow[]> {
  const tableName = input.tableName;
  const order = input.order ?? "ASC";
  let sql: string;

  if (input.useRelativeLowerBound) {
    const hours = input.lookbackHours ?? INFRASPAWN_HOT_TAIL_LOOKBACK_HOURS;
    sql = `SELECT * FROM ${tableName} WHERE time >= now() - INTERVAL '${hours} hours' AND time <= now() ORDER BY time ${order} LIMIT ${MAX_ROWS_PER_RUN}`;
  } else if (input.afterLiteral) {
    const after = escapeInfluxSqlString(input.afterLiteral);
    const untilIso = formatInfluxTimestamp(input.until);
    sql = `SELECT * FROM ${tableName} WHERE time > '${after}' AND time <= '${untilIso}' ORDER BY time ${order} LIMIT ${MAX_ROWS_PER_RUN}`;
  } else if (input.after) {
    const fromIso = formatInfluxTimestamp(input.after);
    const untilIso = formatInfluxTimestamp(input.until);
    sql = `SELECT * FROM ${tableName} WHERE time > '${fromIso}' AND time <= '${untilIso}' ORDER BY time ${order} LIMIT ${MAX_ROWS_PER_RUN}`;
  } else {
    throw new Error("Influx side krever after, afterLiteral eller useRelativeLowerBound");
  }

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
  until: Date;
  after?: Date;
  afterLiteral?: string;
  useRelativeLowerBound?: boolean;
  lookbackHours?: number;
  order?: "ASC" | "DESC";
}): Promise<{ rows: InfraspawnBacnetRow[]; effectiveUntil: Date }> {
  let effectiveUntil = input.until;
  const afterDate = input.after ?? new Date(0);

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const rows = await fetchInfluxPage({
        token: input.token,
        database: input.database,
        tableName: input.tableName,
        until: effectiveUntil,
        after: input.afterLiteral ? undefined : input.after,
        afterLiteral: input.afterLiteral,
        useRelativeLowerBound: input.useRelativeLowerBound,
        lookbackHours: input.lookbackHours,
        order: input.order,
      });
      return { rows, effectiveUntil };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ukjent Influx-feil";
      if (!input.after && !input.afterLiteral) {
        throw error;
      }
      const spanMs = effectiveUntil.getTime() - afterDate.getTime();
      const shrunkSpan = shrinkSyncQueryWindowMs(spanMs);
      if (isInfluxFileLimitError(message) && shrunkSpan != null) {
        effectiveUntil = new Date(afterDate.getTime() + shrunkSpan);
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    "Influx-spørring feilet: tidsvindu for smalt etter file-limit. Prøv igjen senere.",
  );
}

type SyncRangeResult = {
  rowsUpserted: number;
  rawRowsFetched: number;
  maxSampledAt: Date | null;
  objectIds: Set<string>;
  pagesFetched: number;
  endCursor: Date;
  reachedSyncUntil: boolean;
};

async function processInfluxPageRows(input: {
  sourceId: string;
  buildingId: string;
  pageRows: InfraspawnBacnetRow[];
  result: SyncRangeResult;
}): Promise<Date | null> {
  if (input.pageRows.length === 0) return null;

  input.result.pagesFetched += 1;
  input.result.rawRowsFetched += input.pageRows.length;

  try {
    await detectInfraspawnAlarmTransitions({
      sourceId: input.sourceId,
      buildingId: input.buildingId,
      rows: input.pageRows,
    });
  } catch (alarmError) {
    console.warn("[infraspawn.sync] alarm-transitions feilet — fortsetter sample-lagring", {
      sourceId: input.sourceId,
      objectCount: input.pageRows.length,
      error:
        alarmError instanceof Error ? alarmError.message : String(alarmError),
    });
  }

  await upsertMetaBatch(input.sourceId, input.pageRows);

  const quarterHourRows = aggregateBacnetRowsTo15m(input.pageRows);
  if (quarterHourRows.length > 0) {
    await upsertSampleBatch(
      input.sourceId,
      quarterHourRows,
      INFRASPAWN_RESOLUTION_15M,
    );
    input.result.rowsUpserted += quarterHourRows.length;
  }

  for (const row of input.pageRows) {
    input.result.objectIds.add(row.objectId);
  }

  const pageMax = input.pageRows.reduce<Date>(
    (max, row) => (row.sampledAt > max ? row.sampledAt : max),
    input.pageRows[0]!.sampledAt,
  );
  if (!input.result.maxSampledAt || pageMax > input.result.maxSampledAt) {
    input.result.maxSampledAt = pageMax;
  }

  return pageMax;
}
async function syncInfluxHotTail(input: {
  sourceId: string;
  buildingId: string;
  token: string;
  database: string;
  tableName: string;
  cursorStart: Date;
  syncUntil: Date;
  maxPages: number;
}): Promise<SyncRangeResult> {
  const result: SyncRangeResult = {
    rowsUpserted: 0,
    rawRowsFetched: 0,
    maxSampledAt: null,
    objectIds: new Set(),
    pagesFetched: 0,
    endCursor: input.cursorStart,
    reachedSyncUntil: false,
  };

  let pagesUsed = 0;
  let afterLiteral: string | undefined;
  let useRelative = true;
  let descDone = false;

  if (pagesUsed < input.maxPages) {
    const { rows: descRows } = await fetchInfluxPageWithRetry({
      token: input.token,
      database: input.database,
      tableName: input.tableName,
      until: input.syncUntil,
      useRelativeLowerBound: true,
      lookbackHours: INFRASPAWN_HOT_TAIL_LOOKBACK_HOURS,
      order: "DESC",
    });

    if (descRows.length > 0) {
      await processInfluxPageRows({
        sourceId: input.sourceId,
        buildingId: input.buildingId,
        pageRows: descRows,
        result,
      });
      pagesUsed += 1;

      if (descRows.length < MAX_ROWS_PER_RUN) {
        result.reachedSyncUntil = true;
        result.endCursor = input.syncUntil;
        descDone = true;
      } else {
        const oldestInBatch = descRows.reduce((min, row) =>
          row.sampledAt < min.sampledAt ? row : min,
        );
        afterLiteral = influxRowTimeLiteral(oldestInBatch);
        useRelative = false;
      }
    } else {
      result.reachedSyncUntil = true;
      result.endCursor = input.syncUntil;
      return result;
    }
  }

  if (descDone) {
    return result;
  }

  let after: Date | undefined = useRelative ? input.cursorStart : undefined;

  for (; pagesUsed < input.maxPages; pagesUsed += 1) {
    const { rows: pageRows } = await fetchInfluxPageWithRetry({
      token: input.token,
      database: input.database,
      tableName: input.tableName,
      until: input.syncUntil,
      after,
      afterLiteral,
      useRelativeLowerBound: useRelative && !afterLiteral,
      lookbackHours: INFRASPAWN_HOT_TAIL_LOOKBACK_HOURS,
      order: "ASC",
    });

    useRelative = false;
    after = undefined;

    if (pageRows.length === 0) {
      result.reachedSyncUntil = true;
      result.endCursor = input.syncUntil;
      break;
    }

    const pageMax = await processInfluxPageRows({
      sourceId: input.sourceId,
      buildingId: input.buildingId,
      pageRows,
      result,
    });

    if (!pageMax) break;

    if (pageRows.length >= MAX_ROWS_PER_RUN) {
      const lastRow = pageRows[pageRows.length - 1]!;
      afterLiteral = influxRowTimeLiteral(lastRow);
      result.endCursor = new Date(pageMax.getTime() - SYNC_OVERLAP_MS);
    } else {
      result.reachedSyncUntil = true;
      result.endCursor = input.syncUntil;
      break;
    }
  }

  return result;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function syncInfluxRange(input: {
  sourceId: string;
  buildingId: string;
  token: string;
  database: string;
  tableName: string;
  cursorStart: Date;
  syncUntil: Date;
  maxPages: number;
  windowMs?: number;
  seed?: SyncRangeResult;
}): Promise<SyncRangeResult> {
  const queryWindowMs = input.windowMs ?? INFRASPAWN_SYNC_QUERY_WINDOW_MS;
  let cursor = input.cursorStart;
  let windowUntil = computeSyncWindowUntil({
    cursor,
    syncUntil: input.syncUntil,
    windowMs: queryWindowMs,
  });

  const result: SyncRangeResult = {
    rowsUpserted: input.seed?.rowsUpserted ?? 0,
    rawRowsFetched: input.seed?.rawRowsFetched ?? 0,
    maxSampledAt: input.seed?.maxSampledAt ?? null,
    objectIds: new Set(input.seed?.objectIds ?? []),
    pagesFetched: input.seed?.pagesFetched ?? 0,
    endCursor: input.seed?.endCursor ?? input.cursorStart,
    reachedSyncUntil: input.seed?.reachedSyncUntil ?? false,
  };

  for (let page = 0; page < input.maxPages; page++) {
    if (cursor.getTime() >= input.syncUntil.getTime()) {
      break;
    }

    const plannedWindowUntil = windowUntil;
    const { rows: pageRows, effectiveUntil } = await fetchInfluxPageWithRetry({
      token: input.token,
      database: input.database,
      tableName: input.tableName,
      after: cursor,
      until: plannedWindowUntil,
    });

    if (pageRows.length === 0) {
      const next = advanceSyncAfterEmptyWindow({
        windowUntil: effectiveUntil,
        syncUntil: input.syncUntil,
        windowMs: queryWindowMs,
      });
      cursor = next.cursor;
      result.endCursor = cursor;
      result.reachedSyncUntil = next.done;
      windowUntil = next.windowUntil;
      if (next.done) {
        break;
      }
      continue;
    }

    const pageMax = await processInfluxPageRows({
      sourceId: input.sourceId,
      buildingId: input.buildingId,
      pageRows,
      result,
    });

    if (!pageMax) {
      continue;
    }

    const next = advanceSyncAfterPage({
      cursor,
      windowUntil: effectiveUntil,
      syncUntil: input.syncUntil,
      pageMax,
      rowCount: pageRows.length,
      maxRowsPerRun: MAX_ROWS_PER_RUN,
      overlapMs: SYNC_OVERLAP_MS,
      windowMs: queryWindowMs,
    });
    cursor = next.cursor;
    result.endCursor = cursor;
    result.reachedSyncUntil = next.done;
    if (next.done) {
      if (effectiveUntil.getTime() < plannedWindowUntil.getTime()) {
        cursor = new Date(pageMax.getTime() - SYNC_OVERLAP_MS);
        result.endCursor = cursor;
        result.reachedSyncUntil = false;
      } else {
        break;
      }
    } else {
      windowUntil = next.windowUntil;
    }
  }

  if (cursor.getTime() >= input.syncUntil.getTime()) {
    result.reachedSyncUntil = true;
    result.endCursor = input.syncUntil;
  }

  return result;
}

export type SyncInfraspawnSourceResult = {
  sourceId: string;
  success: boolean;
  rowsUpserted: number;
  rawRowsFetched?: number;
  uniqueObjectCount?: number;
  pagesFetched?: number;
  watermarkAt?: string;
  error?: string;
  skipped?: boolean;
};

export async function syncInfraspawnSource(
  sourceId: string,
): Promise<SyncInfraspawnSourceResult> {
  const source = await withPrismaRetry(() =>
    prisma.infraspawnSource.findUnique({
      where: { id: sourceId },
      include: { syncState: true, integration: true },
    }),
  );

  if (!source || !source.isActive) {
    return {
      sourceId,
      success: false,
      rowsUpserted: 0,
      error: "Kilde ikke funnet eller inaktiv",
    };
  }

  const now = new Date();
  const claimed = await claimInfraspawnSourceSync(sourceId, now);
  if (!claimed) {
    console.info("[infraspawn.sync] hopper over — sync kjører allerede", {
      sourceId,
    });
    return {
      sourceId,
      success: true,
      rowsUpserted: 0,
      skipped: true,
    };
  }

  await withPrismaRetry(() =>
    prisma.infraspawnSource.update({
      where: { id: sourceId },
      data: { lastSyncAt: now, lastError: null },
    }),
  );

  try {
    const token = resolveInfluxApiToken(source.apiTokenEncrypted);
    const tableName = resolveInfluxTableName(source.metadata);
    const watermarkBase =
      source.syncState?.watermarkAt ?? initialLookbackFrom(now);
    const syncUntil = now;

    const recentStart = new Date(now.getTime() - RECENT_PRIORITY_MS);
    const tailStart = new Date(
      Math.max(recentStart.getTime(), watermarkBase.getTime()) - SYNC_OVERLAP_MS,
    );

    const tailResult = await syncInfluxHotTail({
      sourceId,
      buildingId: source.buildingId,
      token,
      database: source.influxDatabase,
      tableName,
      cursorStart: tailStart,
      syncUntil,
      maxPages: getTailMaxPages(),
    });

    const backfillStart = new Date(watermarkBase.getTime() - SYNC_OVERLAP_MS);
    let combined = tailResult;

    if (
      tailResult.reachedSyncUntil &&
      backfillStart.getTime() < recentStart.getTime()
    ) {
      const pagesLeft = MAX_SYNC_PAGES - tailResult.pagesFetched;
      if (pagesLeft > 0) {
        const backfillResult = await syncInfluxRange({
          sourceId,
          buildingId: source.buildingId,
          token,
          database: source.influxDatabase,
          tableName,
          cursorStart: backfillStart,
          syncUntil: recentStart,
          maxPages: pagesLeft,
          seed: tailResult,
        });
        combined = backfillResult;
      }
    }

    const nextWatermark = resolveSyncWatermarkAfterRun({
      watermarkBase,
      recentStart,
      tailReachedSyncUntil: tailResult.reachedSyncUntil,
      tailEndCursor: tailResult.endCursor,
      maxSampledAt: combined.maxSampledAt,
      overlapMs: SYNC_OVERLAP_MS,
    });

    console.info("[infraspawn.sync]", {
      sourceId,
      pagesFetched: combined.pagesFetched,
      rawRowsFetched: combined.rawRowsFetched,
      rowsUpserted: combined.rowsUpserted,
      uniqueObjectCount: combined.objectIds.size,
      tailReachedSyncUntil: tailResult.reachedSyncUntil,
      tailPages: tailResult.pagesFetched,
      watermarkAt: nextWatermark.toISOString(),
    });

    const sparseBackfill = await backfillSparseMirrorSignals(sourceId, now);
    combined.rowsUpserted += sparseBackfill.rowsUpserted;

    await finalizeInfraspawnSyncSuccess({
      sourceId,
      integrationId: source.integrationId,
      now,
      nextWatermark,
      rowsUpserted: combined.rowsUpserted,
    });

    const staleCleared = await reconcileStaleOpenAlarms({
      sourceId,
      clearedAt: now,
    });
    if (staleCleared > 0) {
      console.info("[infraspawn.sync] stale open alarms cleared", {
        sourceId,
        count: staleCleared,
      });
    }

    return {
      sourceId,
      success: true,
      rowsUpserted: combined.rowsUpserted,
      rawRowsFetched: combined.rawRowsFetched,
      uniqueObjectCount: combined.objectIds.size,
      pagesFetched: combined.pagesFetched,
      watermarkAt: nextWatermark.toISOString(),
    };
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Ukjent sync-feil";
    const message = normalizeInfraspawnSyncError(rawMessage);

    await recordSyncFailure(sourceId, message);

    return {
      sourceId,
      success: false,
      rowsUpserted: 0,
      error: message,
    };
  }
}

export async function listActiveInfraspawnSourceIds(): Promise<string[]> {
  const sources = await prisma.infraspawnSource.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return sources.map((source) => source.id);
}

export async function syncAllActiveInfraspawnSources(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: SyncInfraspawnSourceResult[];
}> {
  const sourceIds = await listActiveInfraspawnSourceIds();

  if (sourceIds.length === 0) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  const results = await mapWithConcurrency(
    sourceIds,
    getSyncConcurrency(),
    (sourceId) => syncInfraspawnSource(sourceId),
  );

  const succeeded = results.filter((r) => r.success).length;
  return {
    processed: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}
