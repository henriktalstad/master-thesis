import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { compactInfraspawnSamples } from "@/services/infraspawn/compact-samples";
import { syncAllActiveInfraspawnSources } from "@/services/infraspawn/sync-source";
import { syncEnergyPrices } from "@/services/energy/sync-energy-prices";
import { syncBuildingGridTariffs } from "@/services/grid-tariffs/sync-building-grid-tariffs";
import { syncCaseWeather } from "@/services/frost/sync-case-weather";
import { analyzeMpcEvalCoverage } from "@/services/mpc/analyze-eval-coverage";
import { runMpcWhenReady } from "@/services/mpc/run-mpc-when-ready";
import { runControlTick } from "@/services/mpc/run-control-tick";
import { runIncrementalMpcReplayCatchUp } from "@/services/mpc/run-incremental-mpc-replay";
import { isInngestEnabled } from "@/lib/inngest/client";
import { INNGEST_EVENTS, type InfraspawnSyncCompletedEvent } from "@/lib/inngest/events";
import { sendInngestEvent } from "@/lib/inngest/send";
import { isMpcAutoRunEnabled } from "@/lib/config/mpc-automation";
import { getDefaultBuildingSlug } from "@/lib/config/env";
import type { ControlSdHourlyProfile } from "@/lib/sd-anlegg/control/control-sd-calibration";
import { upsertSdObservedControlBuckets } from "@/lib/sd-anlegg/control/persist-sd-observed-buckets";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import { loadSdFineProfilesForControl } from "@/lib/sd-anlegg/control/load-cached-sd-fine-profiles";
import { STYRING_GRAIN_MAX_LOOKBACK_HOURS } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";
import { prisma } from "@/lib/db";

export const PIPELINE_JOB_NAMES = [
  "sync-infraspawn",
  "sync-energy-prices",
  "sync-grid-tariffs",
  "sync-weather",
  "run-control-tick",
  "run-live-mpc-replay",
  "ensure-thesis-mpc-data",
  "sync-building-metering-daily",
  "compact-infraspawn",
] as const;

export type PipelineJobName = (typeof PIPELINE_JOB_NAMES)[number];

export function revalidateStyringWorkspace(buildingSlug?: string | null): void {
  const slug = buildingSlug?.trim() || getDefaultBuildingSlug();
  if (!slug) return;
  revalidatePath(`/sd-anlegg/${slug}/styring`);
  revalidateTag(`mpc-coverage:${slug}`, { expire: 0 });
}

export async function runSyncInfraspawnSourcesJob(): Promise<InfraspawnSyncJobResult> {
  return syncAllActiveInfraspawnSources();
}

export type InfraspawnSyncJobResult = Awaited<
  ReturnType<typeof syncAllActiveInfraspawnSources>
>;

export function totalInfraspawnRowsUpserted(
  sync: InfraspawnSyncJobResult,
): number {
  return sync.results.reduce((sum, row) => sum + row.rowsUpserted, 0);
}

/** Send post-sync MPC-kjede kun når minst én kilde syncet OK og det kom nye rader. */
export function shouldEmitInfraspawnSyncCompleted(
  sync: InfraspawnSyncJobResult,
): boolean {
  if (sync.succeeded === 0) return false;
  return totalInfraspawnRowsUpserted(sync) > 0;
}

export function buildInfraspawnSyncCompletedEvent(
  sync: InfraspawnSyncJobResult,
): InfraspawnSyncCompletedEvent {
  return {
    ok: sync.failed === 0,
    sourcesSynced: sync.succeeded,
    rowsUpserted: totalInfraspawnRowsUpserted(sync),
    succeeded: sync.succeeded,
    failed: sync.failed,
  };
}

export async function emitInfraspawnSyncCompletedIfNeeded(
  sync: InfraspawnSyncJobResult,
): Promise<{ emitted: boolean; event?: InfraspawnSyncCompletedEvent }> {
  if (!shouldEmitInfraspawnSyncCompleted(sync)) {
    return { emitted: false };
  }

  const event = buildInfraspawnSyncCompletedEvent(sync);

  if (isInngestEnabled()) {
    await sendInngestEvent({
      name: INNGEST_EVENTS.INFRASPAWN_SYNC_COMPLETED,
      data: event,
    });
    return { emitted: true, event };
  }

  await runPostInfraspawnMpcPipelineJob({ rowsUpserted: event.rowsUpserted ?? 0 });
  return { emitted: true, event };
}

export type PostInfraspawnMpcPlan = {
  backfill: boolean;
  controlTick: boolean;
  incrementalReplay: boolean;
  reasons: string[];
};

export async function assessPostInfraspawnMpcPlan(input: {
  rowsUpserted: number;
}): Promise<PostInfraspawnMpcPlan> {
  const plan: PostInfraspawnMpcPlan = {
    backfill: false,
    controlTick: false,
    incrementalReplay: false,
    reasons: [],
  };

  if (!isMpcAutoRunEnabled()) {
    plan.reasons.push("MPC_AUTO_RUN disabled");
    return plan;
  }

  if (input.rowsUpserted <= 0) {
    plan.reasons.push("no_new_sync_rows");
    return plan;
  }

  const coverage = await analyzeMpcEvalCoverage({});

  if (coverage?.needsBackfill || (coverage?.missingCanonicals.length ?? 0) > 0) {
    plan.backfill = true;
    plan.controlTick = true;
    plan.incrementalReplay = true;
    plan.reasons.push("needs_backfill");
    return plan;
  }

  plan.controlTick = true;
  plan.incrementalReplay = true;
  plan.reasons.push("new_sync_rows");
  return plan;
}

export async function runMpcBackfillAfterSyncJob(): Promise<unknown> {
  if (!isMpcAutoRunEnabled()) {
    return { skipped: true, reason: "MPC_AUTO_RUN disabled" };
  }
  try {
    const coverage = await analyzeMpcEvalCoverage({});
    if (
      !coverage?.needsBackfill &&
      (coverage?.missingCanonicals.length ?? 0) === 0
    ) {
      return { skipped: true, reason: "coverage_ok" };
    }
    return await runMpcWhenReady({
      mode: "backfill",
      forceRefresh: coverage?.needsBackfill ?? false,
    });
  } catch (error) {
    console.warn("[pipeline.mpc] backfill etter sync feilet:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runControlTickJob(
  triggerSource: "cron" | "post_sync" | "inngest" | "manual" = "cron",
): Promise<unknown> {
  return runControlTick({ triggerSource });
}

export async function runIncrementalMpcReplayJob(): Promise<unknown> {
  if (!isMpcAutoRunEnabled()) {
    return { skipped: true, reason: "MPC_AUTO_RUN disabled" };
  }
  try {
    return await runIncrementalMpcReplayCatchUp();
  } catch (error) {
    console.warn("[pipeline.incremental-replay] feilet:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** MPC-kjede etter vellykket Influx-sync — brukes uten Inngest (inline) og av post-sync-handler. */
export async function runPostInfraspawnMpcPipelineJob(input?: {
  rowsUpserted?: number;
}): Promise<{
  plan: PostInfraspawnMpcPlan;
  backfill: unknown;
  controlTick: unknown;
  incrementalReplay: unknown;
  warmBuckets: unknown;
}> {
  const plan = await assessPostInfraspawnMpcPlan({
    rowsUpserted: input?.rowsUpserted ?? 0,
  });

  const backfill = plan.backfill
    ? await runMpcBackfillAfterSyncJob()
    : { skipped: true, reason: plan.reasons.join(", ") || "not_needed" };

  let controlTick: unknown = { skipped: true, reason: "not_needed" };
  if (plan.controlTick) {
    try {
      controlTick = await runControlTickJob("post_sync");
    } catch (error) {
      console.warn("[pipeline.control-tick] etter sync feilet:", error);
      controlTick = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const incrementalReplay = plan.incrementalReplay
    ? await runIncrementalMpcReplayJob()
    : { skipped: true, reason: plan.reasons.join(", ") || "not_needed" };

  const warmBuckets =
    (input?.rowsUpserted ?? 0) > 0
      ? await runWarmSdObservedBucketsJob().catch((error) => ({
          warmed: [] as Array<1 | 5>,
          bucketsWritten: 0,
          error: error instanceof Error ? error.message : String(error),
        }))
      : { skipped: true as const };

  if (plan.backfill || plan.controlTick || plan.incrementalReplay) {
    revalidateStyringWorkspace();
  }

  return { plan, backfill, controlTick, incrementalReplay, warmBuckets };
}

export async function runPersistSdObservedBucketsJob(input: {
  buildingId: string;
  buildingSlug: string;
  profiles: ControlSdHourlyProfile[];
  bucketMinutes: 1 | 5;
  pipelineRunId: string | null;
}): Promise<{ bucketsWritten: number }> {
  const result = await upsertSdObservedControlBuckets({
    buildingId: input.buildingId,
    profiles: input.profiles,
    bucketMinutes: input.bucketMinutes,
    pipelineRunId: input.pipelineRunId,
  });
  revalidateTag(`mpc-coverage:${input.buildingSlug}`, { expire: 0 });
  return result;
}

/** Forvarm sd_observed buckets etter Influx-sync — reduserer treg første lasting i UI. */
export async function runWarmSdObservedBucketsJob(input?: {
  buildingSlug?: string;
}): Promise<{ warmed: Array<1 | 5>; bucketsWritten: number }> {
  const buildingSlug = input?.buildingSlug?.trim() || getDefaultBuildingSlug();
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) {
    return { warmed: [], bucketsWritten: 0 };
  }

  const building = await prisma.building.findFirst({
    where: { slug: buildingSlug },
    select: { id: true },
  });
  if (!building) {
    return { warmed: [], bucketsWritten: 0 };
  }

  const mpcSource = await resolveMpcBuildingSource({ buildingSlug });
  if (!mpcSource?.sourceId) {
    return { warmed: [], bucketsWritten: 0 };
  }

  const lookbackHours = STYRING_GRAIN_MAX_LOOKBACK_HOURS["5"];
  let bucketsWritten = 0;
  const warmed: Array<1 | 5> = [];

  for (const stepMinutes of [5, 1] as const) {
    const hours =
      stepMinutes === 1
        ? STYRING_GRAIN_MAX_LOOKBACK_HOURS["1"]
        : lookbackHours;
    const sd = await loadSdFineProfilesForControl({
      buildingSlug,
      buildingId: building.id,
      sourceId: mpcSource.sourceId,
      hours,
      stepMinutes,
    });
    if (sd.profiles.length === 0) continue;
    const result = await runPersistSdObservedBucketsJob({
      buildingId: building.id,
      buildingSlug,
      profiles: sd.profiles,
      bucketMinutes: stepMinutes,
      pipelineRunId: null,
    });
    bucketsWritten += result.bucketsWritten;
    warmed.push(stepMinutes);
  }

  return { warmed, bucketsWritten };
}

export async function runPipelineJob(job: PipelineJobName): Promise<unknown> {
  switch (job) {
    case "sync-infraspawn": {
      const sync = await runSyncInfraspawnSourcesJob();
      const followUp = await emitInfraspawnSyncCompletedIfNeeded(sync);
      return { sync, followUp };
    }
    case "sync-energy-prices":
      return syncEnergyPrices();
    case "sync-grid-tariffs":
      return syncBuildingGridTariffs();
    case "sync-weather":
      return syncCaseWeather();
    case "compact-infraspawn":
      return compactInfraspawnSamples();
    case "ensure-thesis-mpc-data":
      return runMpcWhenReady({ mode: "backfill", forceRun: true });
    case "run-live-mpc-replay":
      return runMpcWhenReady({ mode: "replay", forceRun: true });
    case "run-control-tick":
      return runControlTickJob("cron");
    case "sync-building-metering-daily": {
      const { syncBuildingMeteringDaily } = await import(
        "@/services/energy/sync-building-metering-daily"
      );
      return syncBuildingMeteringDaily();
    }
    default: {
      const _exhaustive: never = job;
      return _exhaustive;
    }
  }
}
