import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_EVENTS,
  type InfraspawnSyncCompletedEvent,
  type MpcPersistSdBucketsEvent,
  type MpcSimulationRequestedEvent,
} from "@/lib/inngest/events";
import {
  assessPostInfraspawnMpcPlan,
  buildInfraspawnSyncCompletedEvent,
  revalidateStyringWorkspace,
  runControlTickJob,
  runIncrementalMpcReplayJob,
  runMpcBackfillAfterSyncJob,
  runPersistSdObservedBucketsJob,
  runWarmSdObservedBucketsJob,
  runPipelineJob,
  runSyncInfraspawnSourcesJob,
  shouldEmitInfraspawnSyncCompleted,
} from "@/lib/jobs/pipeline-jobs";
import {
  failMpcSimulationJobStep,
  finalizeMpcSimulationJobStep,
  prepareMpcSimulationJobStep,
  runMpcSimulationReplayBatchStep,
} from "@/services/mpc/run-mpc-simulation-inngest-steps";

export const cronSyncInfraspawn = inngest.createFunction(
  {
    id: "cron-sync-infraspawn",
    name: "Cron: sync-infraspawn",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const sync = await step.run("sync-influx-sources", runSyncInfraspawnSourcesJob);

    if (!shouldEmitInfraspawnSyncCompleted(sync)) {
      return { sync, postSync: { emitted: false } };
    }

    const event = buildInfraspawnSyncCompletedEvent(sync);
    await step.sendEvent("post-sync-events", {
      name: INNGEST_EVENTS.INFRASPAWN_SYNC_COMPLETED,
      data: event satisfies InfraspawnSyncCompletedEvent,
    });
    return { sync, postSync: { emitted: true, rowsUpserted: event.rowsUpserted } };
  },
);

export const onInfraspawnSyncCompleted = inngest.createFunction(
  {
    id: "mpc-post-infraspawn-pipeline",
    name: "MPC: post-infraspawn pipeline",
    concurrency: { limit: 1, key: "mpc-post-infraspawn" },
    triggers: [{ event: INNGEST_EVENTS.INFRASPAWN_SYNC_COMPLETED }],
  },
  async ({ event, step }) => {
    const syncEvent = event.data as InfraspawnSyncCompletedEvent;
    const rowsUpserted = syncEvent.rowsUpserted ?? 0;

    const plan = await step.run("assess-post-sync-plan", () =>
      assessPostInfraspawnMpcPlan({ rowsUpserted }),
    );

    const backfill = plan.backfill
      ? await step.run("mpc-backfill", runMpcBackfillAfterSyncJob)
      : { skipped: true, reason: plan.reasons.join(", ") || "not_needed" };

    const controlTick = plan.controlTick
      ? await step.run("control-tick", () => runControlTickJob("post_sync"))
      : { skipped: true, reason: plan.reasons.join(", ") || "not_needed" };

    const incrementalReplay = plan.incrementalReplay
      ? await step.run("incremental-replay", runIncrementalMpcReplayJob)
      : { skipped: true, reason: plan.reasons.join(", ") || "not_needed" };

    const warmBuckets =
      rowsUpserted > 0
        ? await step.run("warm-sd-buckets", () => runWarmSdObservedBucketsJob())
        : { skipped: true as const };

    if (plan.backfill || plan.controlTick || plan.incrementalReplay) {
      await step.run("revalidate-styring", async () => {
        revalidateStyringWorkspace();
        return { ok: true };
      });
    }

    return { plan, backfill, controlTick, incrementalReplay, warmBuckets };
  },
);

export const cronSyncEnergyPrices = inngest.createFunction(
  {
    id: "cron-sync-energy-prices",
    name: "Cron: sync-energy-prices",
    triggers: [{ cron: "30 5 * * *" }],
  },
  async ({ step }) =>
    step.run("sync-energy-prices", () => runPipelineJob("sync-energy-prices")),
);

export const cronSyncGridTariffs = inngest.createFunction(
  {
    id: "cron-sync-grid-tariffs",
    name: "Cron: sync-grid-tariffs",
    triggers: [{ cron: "25 5 * * *" }],
  },
  async ({ step }) =>
    step.run("sync-grid-tariffs", () => runPipelineJob("sync-grid-tariffs")),
);

export const cronSyncWeather = inngest.createFunction(
  {
    id: "cron-sync-weather",
    name: "Cron: sync-weather",
    triggers: [{ cron: "15 * * * *" }],
  },
  async ({ step }) => step.run("sync-weather", () => runPipelineJob("sync-weather")),
);

export const cronEnsureThesisMpc = inngest.createFunction(
  {
    id: "cron-ensure-thesis-mpc-data",
    name: "Cron: ensure-thesis-mpc-data",
    triggers: [{ cron: "0 7,11,15,19 * * *" }],
  },
  async ({ step }) =>
    step.run("ensure-thesis-mpc", () => runPipelineJob("ensure-thesis-mpc-data")),
);

export const cronSyncBuildingMeteringDaily = inngest.createFunction(
  {
    id: "cron-sync-building-metering-daily",
    name: "Cron: sync-building-metering-daily",
    triggers: [{ cron: "0 9 * * *" }],
  },
  async ({ step }) =>
    step.run("sync-metering-daily", () =>
      runPipelineJob("sync-building-metering-daily"),
    ),
);

export const cronLiveMpcReplay = inngest.createFunction(
  {
    id: "cron-run-live-mpc-replay",
    name: "Cron: run-live-mpc-replay",
    triggers: [{ cron: "15 9 * * *" }],
  },
  async ({ step }) =>
    step.run("live-mpc-replay", () => runPipelineJob("run-live-mpc-replay")),
);

export const cronCompactInfraspawn = inngest.createFunction(
  {
    id: "cron-compact-infraspawn",
    name: "Cron: compact-infraspawn",
    triggers: [{ cron: "0 3 * * *" }],
  },
  async ({ step }) =>
    step.run("compact-infraspawn", () => runPipelineJob("compact-infraspawn")),
);

/** Live control loop — every 15 min, offset from infraspawn sync (at :05, :20, :35, :50). */
export const cronRunControlTick = inngest.createFunction(
  {
    id: "cron-run-control-tick",
    name: "Cron: run-control-tick",
    triggers: [{ cron: "5,20,35,50 * * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("control-tick", () =>
      runControlTickJob("cron"),
    );
    await step.run("revalidate-styring", async () => {
      revalidateStyringWorkspace();
      return { ok: true };
    });
    return result;
  },
);

export const mpcSimulationRequested = inngest.createFunction(
  {
    id: "mpc-simulation-run",
    name: "MPC: simulation job",
    concurrency: { limit: 1, key: "event.data.buildingId" },
    triggers: [{ event: INNGEST_EVENTS.MPC_SIMULATION_REQUESTED }],
  },
  async ({ event, step }) => {
    const data = event.data as MpcSimulationRequestedEvent;
    const evalStart = data.evalStart ? new Date(data.evalStart) : undefined;
    const evalEnd = data.evalEnd ? new Date(data.evalEnd) : undefined;
    const solverProfile = data.solverProfile ?? "thesis";

    const prepared = await step.run("prepare-simulation", () =>
      prepareMpcSimulationJobStep({
        buildingSlug: data.buildingSlug,
        buildingId: data.buildingId,
        jobId: data.jobId,
        evalStart,
        evalEnd,
      }),
    );

    if (!prepared.ok) {
      await step.run("fail-prepare", () =>
        failMpcSimulationJobStep({
          buildingId: data.buildingId,
          jobId: data.jobId,
          message: prepared.reason,
        }),
      );
      return { ok: false, reason: prepared.reason };
    }

    for (let batchIndex = 0; batchIndex < prepared.batchCount; batchIndex++) {
      const batch = await step.run(`replay-batch-${batchIndex}`, () =>
        runMpcSimulationReplayBatchStep({
          buildingSlug: data.buildingSlug,
          buildingId: data.buildingId,
          jobId: data.jobId,
          batchIndex,
          evalStart,
          evalEnd,
          solverProfile,
        }),
      );
      if (!batch.ok) {
        await step.run(`fail-batch-${batchIndex}`, () =>
          failMpcSimulationJobStep({
            buildingId: data.buildingId,
            jobId: data.jobId,
            message: batch.reason ?? "batch_failed",
          }),
        );
        return { ok: false, reason: batch.reason };
      }
      if (batch.done) break;
    }

    const finalized = await step.run("finalize-artifacts", () =>
      finalizeMpcSimulationJobStep({
        buildingSlug: data.buildingSlug,
        buildingId: data.buildingId,
        jobId: data.jobId,
      }),
    );

    if (!finalized.ok) {
      await step.run("fail-finalize", () =>
        failMpcSimulationJobStep({
          buildingId: data.buildingId,
          jobId: data.jobId,
          message: finalized.reason ?? "artifact_persist_failed",
        }),
      );
      return { ok: false, reason: finalized.reason };
    }

    await step.run("revalidate-styring", async () => {
      revalidateStyringWorkspace(data.buildingSlug);
      return { ok: true };
    });

    return {
      ok: true,
      jobId: data.jobId,
      pipelineRunId: finalized.pipelineRunId,
      totalSteps: prepared.totalSteps,
    };
  },
);

export const mpcPersistSdBuckets = inngest.createFunction(
  {
    id: "mpc-persist-sd-buckets",
    name: "MPC: persist SD observed buckets",
    concurrency: { limit: 2, key: "event.data.buildingId" },
    triggers: [{ event: INNGEST_EVENTS.MPC_PERSIST_SD_BUCKETS }],
  },
  async ({ event, step }) => {
    const data = event.data as MpcPersistSdBucketsEvent;
    return step.run("persist-buckets", () =>
      runPersistSdObservedBucketsJob({
        buildingId: data.buildingId,
        buildingSlug: data.buildingSlug,
        profiles: data.profiles,
        bucketMinutes: data.bucketMinutes,
        pipelineRunId: data.pipelineRunId,
      }),
    );
  },
);

export const mpcControlTickRequested = inngest.createFunction(
  {
    id: "mpc-control-tick-requested",
    name: "MPC: control tick (event)",
    concurrency: { limit: 1, key: "event.data.buildingSlug" },
    triggers: [{ event: INNGEST_EVENTS.MPC_CONTROL_TICK_REQUESTED }],
  },
  async ({ event, step }) => {
    const triggerSource =
      (event.data as { triggerSource?: string }).triggerSource ?? "inngest";
    const buildingSlug = (event.data as { buildingSlug?: string }).buildingSlug;
    const result = await step.run("control-tick", () =>
      runControlTickJob(
        triggerSource === "post_sync"
          ? "post_sync"
          : triggerSource === "manual"
            ? "manual"
            : "inngest",
      ),
    );
    await step.run("revalidate-styring", async () => {
      revalidateStyringWorkspace(buildingSlug);
      return { ok: true };
    });
    return result;
  },
);

export const inngestFunctions = [
  cronSyncInfraspawn,
  onInfraspawnSyncCompleted,
  cronSyncEnergyPrices,
  cronSyncGridTariffs,
  cronSyncWeather,
  cronEnsureThesisMpc,
  cronSyncBuildingMeteringDaily,
  cronLiveMpcReplay,
  cronRunControlTick,
  cronCompactInfraspawn,
  mpcSimulationRequested,
  mpcPersistSdBuckets,
  mpcControlTickRequested,
];
