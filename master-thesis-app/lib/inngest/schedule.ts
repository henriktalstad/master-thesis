import { getDefaultBuildingSlug } from "@/lib/config/env";
import {
  INNGEST_EVENTS,
  type MpcPersistSdBucketsEvent,
  type MpcSimulationRequestedEvent,
} from "@/lib/inngest/events";
import { sendInngestEvent } from "@/lib/inngest/send";
import { isInngestEnabled } from "@/lib/inngest/client";
import type { ControlSdHourlyProfile } from "@/lib/sd-anlegg/control/control-sd-calibration";
import type { MpcReplaySolverProfile } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { runPersistSdObservedBucketsJob } from "@/lib/jobs/pipeline-jobs";
import { executeMpcSimulationJob } from "@/services/mpc/run-mpc-simulation-job";
import { runControlTick } from "@/services/mpc/run-control-tick";

export async function scheduleControlTickJob(input?: {
  buildingSlug?: string;
  triggerSource?: "manual" | "inngest" | "post_sync";
}): Promise<void> {
  if (isInngestEnabled()) {
    await sendInngestEvent({
      name: INNGEST_EVENTS.MPC_CONTROL_TICK_REQUESTED,
      data: {
        buildingSlug: input?.buildingSlug?.trim() || getDefaultBuildingSlug(),
        triggerSource: input?.triggerSource ?? "inngest",
      },
    });
    return;
  }

  await runControlTick({
    triggerSource: input?.triggerSource ?? "inngest",
  });
}

export async function scheduleMpcSimulationJob(input: {
  buildingId: string;
  buildingSlug: string;
  jobId: string;
  evalStart?: Date;
  evalEnd?: Date;
  solverProfile?: MpcReplaySolverProfile;
}): Promise<{ scheduled: "inngest" | "inline" }> {
  if (isInngestEnabled()) {
    await sendInngestEvent({
      name: INNGEST_EVENTS.MPC_SIMULATION_REQUESTED,
      data: {
        buildingId: input.buildingId,
        buildingSlug: input.buildingSlug,
        jobId: input.jobId,
        evalStart: input.evalStart?.toISOString(),
        evalEnd: input.evalEnd?.toISOString(),
        solverProfile: input.solverProfile ?? "thesis",
      } satisfies MpcSimulationRequestedEvent,
      id: `mpc-simulation-${input.jobId}`,
    });
    return { scheduled: "inngest" };
  }

  void executeMpcSimulationJob({
    buildingId: input.buildingId,
    buildingSlug: input.buildingSlug,
    jobId: input.jobId,
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
    solverProfile: input.solverProfile,
  });
  return { scheduled: "inline" };
}

export async function schedulePersistSdBucketsJob(input: {
  buildingId: string;
  buildingSlug: string;
  profiles: ControlSdHourlyProfile[];
  bucketMinutes: 1 | 5;
  pipelineRunId: string | null;
}): Promise<void> {
  if (input.profiles.length === 0) return;

  if (isInngestEnabled()) {
    const latestHour = input.profiles.at(-1)?.hour ?? "unknown";
    await sendInngestEvent({
      name: INNGEST_EVENTS.MPC_PERSIST_SD_BUCKETS,
      data: {
        buildingId: input.buildingId,
        buildingSlug: input.buildingSlug,
        profiles: input.profiles,
        bucketMinutes: input.bucketMinutes,
        pipelineRunId: input.pipelineRunId,
      } satisfies MpcPersistSdBucketsEvent,
      id: `sd-buckets-${input.buildingId}-${input.bucketMinutes}-${latestHour}`,
    });
    return;
  }

  await runPersistSdObservedBucketsJob(input);
}
