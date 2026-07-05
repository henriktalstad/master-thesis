import "server-only";

import { prisma } from "@/lib/db";
import { MPC_SIMULATION_CHECKPOINT_BATCH } from "@/lib/sd-anlegg/control/control-constants";
import {
  markMpcSimulationFinished,
  updateMpcSimulationProgress,
} from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import type { MpcReplaySolverProfile } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import type { ResolvedMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import { persistMpcPipelineRun } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-run";
import { countPipelineReplaySteps } from "@/lib/sd-anlegg/control/pipeline-run-completeness";
import { revalidatePath, revalidateTag } from "next/cache";
import { loadEvalDatasetForMpc } from "./load-eval-dataset";
import { assessFromEvalDataset } from "./assess-mpc-simulation-readiness";
import { resolveMpcBuildingSource } from "./resolve-mpc-context";
import { loadBuildingComfortTargets } from "./load-building-comfort-band";
import { resolveGenericMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import {
  runMpcSimulationNextBatch,
  type MpcSimulationNextBatchResult,
} from "./run-mpc-simulation-batched";
import { ensureThesisMpcData } from "./ensure-thesis-mpc-data";

export type MpcSimulationPrepareResult =
  | { ok: true; totalSteps: number; batchCount: number }
  | { ok: false; reason: string };

export async function prepareMpcSimulationJobStep(input: {
  buildingSlug: string;
  buildingId: string;
  jobId: string;
  evalStart?: Date;
  evalEnd?: Date;
}): Promise<MpcSimulationPrepareResult> {
  const ensured = await ensureThesisMpcData({
    buildingSlug: input.buildingSlug,
    runSimulation: false,
    maxSyncIterations: 2,
    allowDirectInflux: true,
    directInfluxMaxPages: 24,
    autoClipEvalStart: true,
  });
  if (!ensured.ok) {
    return { ok: false, reason: ensured.message };
  }

  const dataset = await loadEvalDatasetForMpc({
    buildingSlug: input.buildingSlug,
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
  });
  if (!dataset) {
    return { ok: false, reason: "dataset_load_failed" };
  }

  const readiness = assessFromEvalDataset(dataset);
  if (!readiness.canSimulate) {
    return {
      ok: false,
      reason: readiness.blockers.join(" · ") || "insufficient_coverage",
    };
  }

  const totalSteps = dataset.steps.length;
  if (totalSteps < 96) {
    return { ok: false, reason: `for_faa_steg_${totalSteps}` };
  }

  await updateMpcSimulationProgress({
    buildingId: input.buildingId,
    jobId: input.jobId,
    stepIndex: 0,
    stepTotal: totalSteps,
    message: "Kalibrerer modell…",
  });

  const batchCount = Math.ceil(totalSteps / MPC_SIMULATION_CHECKPOINT_BATCH);
  return { ok: true, totalSteps, batchCount };
}

async function resolveBuildingPreferences(
  buildingId: string,
  buildingSlug: string,
): Promise<ResolvedMpcBuildingPreferences> {
  const comfortTargets = await loadBuildingComfortTargets(buildingId);
  return resolveGenericMpcBuildingPreferences({
    buildingSlug,
    comfortTargets,
  });
}

export async function runMpcSimulationReplayBatchStep(input: {
  buildingSlug: string;
  buildingId: string;
  jobId: string;
  batchIndex: number;
  evalStart?: Date;
  evalEnd?: Date;
  solverProfile?: MpcReplaySolverProfile;
}): Promise<MpcSimulationNextBatchResult> {
  const dataset = await loadEvalDatasetForMpc({
    buildingSlug: input.buildingSlug,
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
  });
  if (!dataset) {
    return { ok: false, reason: "dataset_load_failed", done: true };
  }

  const ctx = await resolveMpcBuildingSource({ buildingSlug: input.buildingSlug });
  const buildingPreferences = ctx
    ? await resolveBuildingPreferences(ctx.buildingId, ctx.buildingSlug)
    : undefined;

  return runMpcSimulationNextBatch({
    buildingId: input.buildingId,
    jobId: input.jobId,
    dataset,
    buildingPreferences,
    solverProfile: input.solverProfile ?? "thesis",
    batchIndex: input.batchIndex,
  });
}

export async function finalizeMpcSimulationJobStep(input: {
  buildingSlug: string;
  buildingId: string;
  jobId: string;
}): Promise<{ ok: boolean; pipelineRunId: string | null; reason?: string }> {
  const job = await prisma.sdAnleggMpcSimulationJob.findUnique({
    where: { id: input.jobId },
    select: { pipelineRunId: true, stepIndex: true, stepTotal: true },
  });
  if (!job?.pipelineRunId) {
    return { ok: false, pipelineRunId: null, reason: "missing_pipeline_run" };
  }

  const persistedCount = await countPipelineReplaySteps(job.pipelineRunId);
  if (job.stepTotal > 0 && persistedCount < job.stepTotal * 0.95) {
    return {
      ok: false,
      pipelineRunId: job.pipelineRunId,
      reason: `ufullstendig_replay_${persistedCount}_av_${job.stepTotal}`,
    };
  }

  const run = await prisma.sdAnleggMpcPipelineRun.findUnique({
    where: { id: job.pipelineRunId },
    select: { calibration: true, evalStart: true, evalEnd: true, stepCount: true },
  });
  if (!run?.calibration) {
    return { ok: false, pipelineRunId: job.pipelineRunId, reason: "missing_calibration" };
  }

  const dataset = await loadEvalDatasetForMpc({ buildingSlug: input.buildingSlug });
  if (!dataset) {
    return { ok: false, pipelineRunId: job.pipelineRunId, reason: "dataset_load_failed" };
  }

  const batchResult = await runMpcSimulationNextBatch({
    buildingId: input.buildingId,
    jobId: input.jobId,
    dataset,
    solverProfile: "thesis",
    finalizeOnly: true,
  });

  if (!batchResult.ok || !batchResult.result) {
    return {
      ok: false,
      pipelineRunId: job.pipelineRunId,
      reason: batchResult.ok === false ? batchResult.reason : "finalize_build_failed",
    };
  }

  const persisted = await persistMpcPipelineRun({
    buildingId: input.buildingId,
    result: batchResult.result,
    skipReplayReplace: true,
  });

  await markMpcSimulationFinished({
    buildingId: input.buildingId,
    jobId: input.jobId,
    status: "completed",
    pipelineRunId: persisted?.id ?? job.pipelineRunId,
    message: "Simulering fullført — artifacts lagret",
  });

  try {
    revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);
    revalidateTag(`mpc-coverage:${input.buildingSlug}`, { expire: 0 });
  } catch {
    // best effort
  }

  return { ok: true, pipelineRunId: persisted?.id ?? job.pipelineRunId };
}

export async function failMpcSimulationJobStep(input: {
  buildingId: string;
  jobId: string;
  message: string;
}): Promise<void> {
  await markMpcSimulationFinished({
    buildingId: input.buildingId,
    jobId: input.jobId,
    status: "failed",
    message: input.message,
  });
}
