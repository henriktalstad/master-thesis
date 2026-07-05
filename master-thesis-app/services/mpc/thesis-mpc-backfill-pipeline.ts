import "server-only";

import { prisma } from "@/lib/db";
import {
  clipRangeToInfluxLookback,
  evalStartsBeforeInfluxLookback,
  getInfluxEarliestQueryableAt,
  resolveInfluxMaxLookbackHours,
} from "@/lib/infraspawn/influx-lookback";
import { isInfraspawnSourceSyncActive } from "@/lib/infraspawn/claim-sync-source";
import { fetchAndPersistControlSignalsRange } from "@/services/infraspawn/fetch-control-signals-range";
import { syncInfraspawnSource } from "@/services/infraspawn/sync-source";
import {
  analyzeMpcEvalCoverage,
  analyzeMpcEvalCoverageFull,
  type MpcEvalCoverageReport,
} from "./analyze-eval-coverage";
import { backfillSignalGapsFromInflux } from "./backfill-signal-gaps-from-influx";
import { loadMpcResolveContextBySource } from "./load-mpc-resolve-context";
import { listMpcPointMeta } from "./mpc-point-meta";
import { resolveEvalDatasetObjectIds } from "./resolve-eval-dataset-object-ids";

export type ThesisMpcBackfillInput = {
  buildingSlug?: string;
  sourceId: string;
  evalStart: Date;
  evalEnd: Date;
  thresholdPct: number;
  allowDirectInflux: boolean;
  directInfluxMaxPages: number;
  skipFullSourceSync: boolean;
  maxSyncIterations: number;
  coverageFallback: MpcEvalCoverageReport | null;
};

export async function refreshEvalCoverage(
  buildingSlug?: string,
): Promise<MpcEvalCoverageReport | null> {
  return analyzeMpcEvalCoverage({ buildingSlug });
}

async function fetchEvalSignalsFromInflux(input: {
  sourceId: string;
  objectIds: string[];
  evalStart: Date;
  evalEnd: Date;
  maxPages: number;
}): Promise<Awaited<ReturnType<typeof fetchAndPersistControlSignalsRange>>> {
  const window = clipRangeToInfluxLookback({
    start: input.evalStart,
    end: input.evalEnd,
  });
  if (!window.queryable) {
    const hours = resolveInfluxMaxLookbackHours();
    return {
      success: false,
      rowsUpserted: 0,
      rawRowsFetched: 0,
      pagesFetched: 0,
      aggregatedRows: [],
      message: `Influx (${hours} t lookback) — ingenting å hente for eval-vindu`,
    };
  }
  return fetchAndPersistControlSignalsRange({
    sourceId: input.sourceId,
    objectIds: input.objectIds,
    start: window.start,
    end: window.end,
    maxPages: input.maxPages,
  });
}

async function appendSignalGapBackfill(input: {
  sourceId: string;
  objectIds: string[];
  influxWindow: ReturnType<typeof clipRangeToInfluxLookback>;
  directInfluxMaxPages: number;
  messagePrefix?: string;
}): Promise<string | null> {
  if (input.objectIds.length === 0 || !input.influxWindow.queryable) {
    return null;
  }

  const gapFill = await backfillSignalGapsFromInflux({
    sourceId: input.sourceId,
    objectIds: input.objectIds,
    windowStart: input.influxWindow.start,
    windowEnd: input.influxWindow.end,
    maxPagesPerGap: Math.max(4, Math.floor(input.directInfluxMaxPages / 8)),
  });

  if (gapFill.gapsDetected === 0) return null;
  return input.messagePrefix
    ? `${input.messagePrefix}${gapFill.message}`
    : gapFill.message;
}

async function oldestSampleAt(sourceId: string): Promise<Date | null> {
  const row = await prisma.infraspawnBacnetSample.findFirst({
    where: { sourceId },
    orderBy: { sampledAt: "asc" },
    select: { sampledAt: true },
  });
  return row?.sampledAt ?? null;
}

async function resetWatermarkToEvalStart(
  sourceId: string,
  evalStart: Date,
): Promise<void> {
  await prisma.infraspawnSyncState.upsert({
    where: { sourceId },
    create: {
      sourceId,
      watermarkAt: evalStart,
      status: "SUCCESS",
    },
    update: {
      watermarkAt: evalStart,
      status: "SUCCESS",
      lastError: null,
    },
  });
}

async function runSyncLoop(
  sourceId: string,
  maxIterations: number,
): Promise<{ iterations: number; rowsUpserted: number; lastError?: string }> {
  if (await isInfraspawnSourceSyncActive(sourceId)) {
    return { iterations: 0, rowsUpserted: 0 };
  }

  let rowsUpserted = 0;
  for (let i = 0; i < maxIterations; i++) {
    const result = await syncInfraspawnSource(sourceId);
    if (result.skipped) {
      return { iterations: i, rowsUpserted };
    }
    rowsUpserted += result.rowsUpserted;
    if (!result.success) {
      return {
        iterations: i + 1,
        rowsUpserted,
        lastError: result.error,
      };
    }
    if (result.rowsUpserted === 0 && i >= 2) {
      return { iterations: i + 1, rowsUpserted };
    }
  }
  return { iterations: maxIterations, rowsUpserted };
}

async function runDirectInfluxPhase(input: {
  backfill: ThesisMpcBackfillInput;
  evalObjectIds: string[];
  influxWindow: ReturnType<typeof clipRangeToInfluxLookback>;
  messagePrefix?: string;
  refreshAfter: boolean;
}): Promise<{ messages: string[]; coverage: MpcEvalCoverageReport | null }> {
  const messages: string[] = [];
  if (!input.backfill.allowDirectInflux || input.evalObjectIds.length === 0) {
    return { messages, coverage: null };
  }

  const direct = await fetchEvalSignalsFromInflux({
    sourceId: input.backfill.sourceId,
    objectIds: input.evalObjectIds,
    evalStart: input.backfill.evalStart,
    evalEnd: input.backfill.evalEnd,
    maxPages: input.backfill.directInfluxMaxPages,
  });
  messages.push(
    input.messagePrefix
      ? `${input.messagePrefix}${direct.message}`
      : direct.message,
  );

  const gapMessage = await appendSignalGapBackfill({
    sourceId: input.backfill.sourceId,
    objectIds: input.evalObjectIds,
    influxWindow: input.influxWindow,
    directInfluxMaxPages: input.backfill.directInfluxMaxPages,
    messagePrefix: input.messagePrefix,
  });
  if (gapMessage) messages.push(gapMessage);

  if (!input.refreshAfter) {
    return { messages, coverage: null };
  }

  const coverage =
    (await refreshEvalCoverage(input.backfill.buildingSlug)) ??
    input.backfill.coverageFallback;
  return { messages, coverage };
}

export async function runThesisMpcBackfillPipeline(
  input: ThesisMpcBackfillInput,
): Promise<{ actions: string[]; coverage: MpcEvalCoverageReport | null }> {
  const actions: string[] = [];
  const mpcCtx = await loadMpcResolveContextBySource(input.sourceId);
  const points = mpcCtx?.points ?? (await listMpcPointMeta(input.sourceId));
  const evalObjectIds = resolveEvalDatasetObjectIds(points, mpcCtx ?? undefined);
  const influxWindow = clipRangeToInfluxLookback({
    start: input.evalStart,
    end: input.evalEnd,
  });

  let coverage = input.coverageFallback;

  const initial = await runDirectInfluxPhase({
    backfill: input,
    evalObjectIds,
    influxWindow,
    refreshAfter: true,
  });
  actions.push(...initial.messages);
  if (initial.coverage) coverage = initial.coverage;

  if (
    !input.skipFullSourceSync &&
    coverage &&
    coverage.needsMpcBackfill &&
    input.maxSyncIterations > 0
  ) {
    const influxEarliest = getInfluxEarliestQueryableAt();
    const syncWatermark = new Date(
      Math.max(input.evalStart.getTime(), influxEarliest.getTime()),
    );
    const oldest = await oldestSampleAt(input.sourceId);
    if (!oldest || oldest.getTime() > syncWatermark.getTime()) {
      await resetWatermarkToEvalStart(input.sourceId, syncWatermark);
      actions.push(
        evalStartsBeforeInfluxLookback(input.evalStart)
          ? `Watermark → ${syncWatermark.toISOString().slice(0, 10)} (Influx max ${resolveInfluxMaxLookbackHours()} t)`
          : `Watermark tilbakestilt til ${syncWatermark.toISOString().slice(0, 10)}`,
      );
    }

    const sync = await runSyncLoop(
      input.sourceId,
      Math.min(input.maxSyncIterations, 2),
    );
    actions.push(
      `Sync (${sync.iterations}×): ${sync.rowsUpserted} rader${sync.lastError ? ` — ${sync.lastError}` : ""}`,
    );
    coverage =
      (await refreshEvalCoverage(input.buildingSlug)) ?? coverage;
  } else if (input.skipFullSourceSync && coverage?.needsMpcBackfill) {
    actions.push(
      "Full sync hoppet over (skipFullSourceSync) — kun direkte Influx for eval-signaler",
    );
  }

  const needsRetry =
    coverage != null &&
    (coverage.needsMpcBackfill || coverage.needsPlantBackfill);

  if (needsRetry && coverage) {
    const retryCoverage = coverage;
    const retry = await runDirectInfluxPhase({
      backfill: input,
      evalObjectIds,
      influxWindow,
      messagePrefix: "Retry ",
      refreshAfter: retryCoverage.needsMpcBackfill,
    });
    actions.push(...retry.messages);
    if (retry.coverage) coverage = retry.coverage;
  }

  coverage =
    (await analyzeMpcEvalCoverageFull({
      buildingSlug: input.buildingSlug,
    })) ?? coverage;

  return { actions, coverage };
}
