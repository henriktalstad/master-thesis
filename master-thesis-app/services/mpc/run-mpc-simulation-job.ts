import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { scheduleMpcSimulationJob } from "@/lib/inngest/schedule";
import { prisma } from "@/lib/db";
import { MpcSimulationStatus as PrismaMpcSimulationStatus } from "@/generated/client";
import { persistMpcPipelineRun } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-run";
import {
  markMpcSimulationFinished,
  markMpcSimulationRunning,
  recoverStaleMpcSimulationJob,
  cancelActiveMpcSimulationJob,
  findResumableMpcSimulationJob,
  resumeMpcSimulationJob,
} from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import type { ResolvedMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import type { MpcReplaySolverProfile } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { runMpcSimulationFromEvalDataset } from "./run-mpc-pipeline-core";
import { ensureThesisMpcData } from "./ensure-thesis-mpc-data";

export type EnqueueMpcSimulationResult =
  | { ok: true; jobId: string; alreadyRunning: boolean }
  | { ok: false; reason: string };

export async function getActiveRunningSimulationJobId(
  buildingId: string,
): Promise<string | null> {
  await recoverStaleMpcSimulationJob(buildingId);
  const live = await prisma.sdAnleggLiveMpcState.findUnique({
    where: { buildingId },
    select: {
      activeSimulationJob: {
        select: { id: true, status: true },
      },
    },
  });
  if (
    live?.activeSimulationJob?.status === PrismaMpcSimulationStatus.RUNNING
  ) {
    return live.activeSimulationJob.id;
  }
  return null;
}

export async function executeMpcSimulationJob(input: {
  buildingId: string;
  buildingSlug: string;
  jobId: string;
  evalStart?: Date;
  evalEnd?: Date;
  buildingPreferences?: ResolvedMpcBuildingPreferences;
  solverProfile?: MpcReplaySolverProfile;
}): Promise<void> {
  try {
    const ensured = await ensureThesisMpcData({
      buildingSlug: input.buildingSlug,
      runSimulation: false,
      maxSyncIterations: 2,
      allowDirectInflux: true,
      directInfluxMaxPages: 24,
      autoClipEvalStart: true,
    });
    if (!ensured.ok) {
      console.warn(
        "[mpc-simulation-job] dataset-dekning utilstrekkelig etter ensure:",
        ensured.message,
      );
    } else if (ensured.actions.length > 0) {
      console.log(
        "[mpc-simulation-job] ensure før sim:",
        ensured.actions.join(" · "),
      );
    }

    const simulation = await runMpcSimulationFromEvalDataset({
      buildingSlug: input.buildingSlug,
      buildingId: input.buildingId,
      evalStart: input.evalStart,
      evalEnd: input.evalEnd,
      buildingPreferences: input.buildingPreferences,
      solverProfile: input.solverProfile,
      jobId: input.jobId,
    });

    if (!simulation.ok) {
      await markMpcSimulationFinished({
        buildingId: input.buildingId,
        jobId: input.jobId,
        status: "failed",
        message: simulation.detail ?? simulation.reason,
      });
      return;
    }

    const persisted = await persistMpcPipelineRun({
      buildingId: input.buildingId,
      result: simulation.result,
      skipReplayReplace: true,
    });

    await markMpcSimulationFinished({
      buildingId: input.buildingId,
      jobId: input.jobId,
      status: "completed",
      pipelineRunId: persisted?.id ?? null,
      message: "Simulering fullført",
    });

    try {
      revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);
      revalidateTag(`mpc-coverage:${input.buildingSlug}`, { expire: 0 });
    } catch {
      // Cron/background — best effort
    }
  } catch (error) {
    await markMpcSimulationFinished({
      buildingId: input.buildingId,
      jobId: input.jobId,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function enqueueMpcSimulationJob(input: {
  buildingId: string;
  stepTotal?: number;
  message?: string;
  forceRestart?: boolean;
  /** Gjenoppta avbrutt jobb med checkpoint (default true). */
  allowResume?: boolean;
}): Promise<EnqueueMpcSimulationResult> {
  if (input.forceRestart) {
    await cancelActiveMpcSimulationJob({
      buildingId: input.buildingId,
      message: "Simulering avbrutt — starter på nytt",
    });
  } else {
    await recoverStaleMpcSimulationJob(input.buildingId);
  }

  const existingJobId = await getActiveRunningSimulationJobId(input.buildingId);
  if (existingJobId) {
    return { ok: true, jobId: existingJobId, alreadyRunning: true };
  }

  if (input.allowResume !== false) {
    const resumable = await findResumableMpcSimulationJob({
      buildingId: input.buildingId,
    });
    if (resumable) {
      await resumeMpcSimulationJob({
        buildingId: input.buildingId,
        jobId: resumable.jobId,
        stepTotal: input.stepTotal ?? resumable.stepTotal,
        message: `Gjenopptar fra steg ${resumable.checkpoint.replayIndex}…`,
      });
      return { ok: true, jobId: resumable.jobId, alreadyRunning: false };
    }
  }

  const jobId = await markMpcSimulationRunning({
    buildingId: input.buildingId,
    stepTotal: input.stepTotal ?? 0,
    message: input.message ?? "Kjører simulering…",
  });

  return { ok: true, jobId, alreadyRunning: false };
}

export async function enqueueAndScheduleMpcSimulationJob(input: {
  buildingId: string;
  buildingSlug: string;
  stepTotal?: number;
  evalStart?: Date;
  evalEnd?: Date;
  buildingPreferences?: ResolvedMpcBuildingPreferences;
  solverProfile?: MpcReplaySolverProfile;
  message?: string;
  forceRestart?: boolean;
}): Promise<EnqueueMpcSimulationResult> {
  const enqueued = await enqueueMpcSimulationJob({
    buildingId: input.buildingId,
    stepTotal: input.stepTotal,
    message: input.message,
    forceRestart: input.forceRestart,
  });
  if (!enqueued.ok || enqueued.alreadyRunning) {
    return enqueued;
  }

  await scheduleMpcSimulationJob({
    buildingId: input.buildingId,
    buildingSlug: input.buildingSlug,
    jobId: enqueued.jobId,
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
    solverProfile: input.solverProfile,
  });

  return enqueued;
}
