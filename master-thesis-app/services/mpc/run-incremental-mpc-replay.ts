import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { getDefaultBuildingSlug } from "@/lib/config/env";
import { isMpcAutoRunEnabled } from "@/lib/config/mpc-automation";
import {
  getMpcIncrementalReplayMaxBatches,
  LIVE_MPC_INCREMENTAL_REPLAY_BATCH,
  MPC_BACKGROUND_ENSURE_COOLDOWN_MS,
} from "@/lib/sd-anlegg/control/control-constants";
import type { MpcSimulationProgress } from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import { loadLatestMpcPipelineRun } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { persistIncrementalMpcReplaySteps } from "@/lib/sd-anlegg/control/persist-incremental-mpc-replay-steps";
import { buildRunScalarUpdateData } from "@/lib/sd-anlegg/control/build-mpc-pipeline-run-scalars";
import {
  loadPipelineReplaySteps,
  upsertPipelineReplaySteps,
} from "@/lib/sd-anlegg/control/persist-mpc-pipeline-replay-steps";
import { summarizeMpcReplaySteps } from "@/lib/sd-anlegg/control/summarize-mpc-replay-steps";
import {
  buildMpcPipelineResult,
  runHistoricalMpcReplay,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/replay-loop";
import { fitMpcCalibrationFromSteps } from "@/lib/sd-anlegg/mpc/pipeline/run-mpc-pipeline";
import { resolveMpcReplaySolverConfig } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { resolveGenericMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import type {
  EmulatorValidationMetrics,
  MpcTimestep,
  PlantValidationMetrics,
} from "@/lib/sd-anlegg/mpc/shared/types";
import { parsePersistedCalibrationPayload } from "@/lib/sd-anlegg/control/build-mpc-pipeline-run-scalars";
import { prisma } from "@/lib/db";
import { loadEvalDatasetForMpc } from "./load-eval-dataset";
import { resolveMpcBuildingSource } from "./resolve-mpc-context";
import { loadBuildingComfortTargets } from "./load-building-comfort-band";
import { getActiveRunningSimulationJobId } from "./run-mpc-simulation-job";

function revalidateStyringAfterReplay(buildingSlug: string): void {
  revalidatePath(`/sd-anlegg/${buildingSlug}/styring`);
  revalidateTag(`mpc-coverage:${buildingSlug}`, { expire: 0 });
}

function findReplayStartIndex(
  steps: readonly MpcTimestep[],
  watermarkAt: Date | null,
): number {
  if (!watermarkAt) return 0;
  const wmMs = watermarkAt.getTime();
  for (let i = 0; i < steps.length; i++) {
    if (new Date(steps[i]!.t).getTime() > wmMs) return i;
  }
  return steps.length;
}

function initialExtractFromSteps(
  steps: readonly MpcTimestep[],
  index: number,
): number {
  for (let i = Math.min(index, steps.length - 1); i >= 0; i--) {
    const value = steps[i]?.extractTempC;
    if (value != null) return value;
  }
  return 20;
}

export type IncrementalMpcReplayResult =
  | { ok: true; skipped: true; reason: string }
  | {
      ok: true;
      skipped: false;
      startIndex: number;
      endIndex: number;
      stepsWritten: number;
      watermarkAt: string;
    }
  | { ok: false; reason: string };

export async function runIncrementalMpcReplayBatch(input?: {
  buildingSlug?: string;
}): Promise<IncrementalMpcReplayResult> {
  const buildingSlug = input?.buildingSlug ?? getDefaultBuildingSlug();
  const ctx = await resolveMpcBuildingSource({ buildingSlug });
  if (!ctx) {
    return { ok: false, reason: "building_unresolved" };
  }

  if (await getActiveRunningSimulationJobId(ctx.buildingId)) {
    return { ok: true, skipped: true, reason: "full_simulation_running" };
  }

  const [pipelineRun, liveState, dataset] = await Promise.all([
    loadLatestMpcPipelineRun(ctx.buildingId),
    prisma.sdAnleggLiveMpcState.findUnique({
      where: { buildingId: ctx.buildingId },
      select: { replayWatermarkAt: true, calibration: true },
    }),
    loadEvalDatasetForMpc({ buildingSlug: ctx.buildingSlug }),
  ]);

  if (!pipelineRun?.calibration || !dataset || dataset.steps.length < 96) {
    return { ok: true, skipped: true, reason: "no_pipeline_or_dataset" };
  }

  const watermarkAt = liveState?.replayWatermarkAt ?? null;
  const startIndex = findReplayStartIndex(dataset.steps, watermarkAt);
  if (startIndex >= dataset.steps.length) {
    return { ok: true, skipped: true, reason: "already_caught_up" };
  }

  const endIndex = Math.min(
    dataset.steps.length,
    startIndex + LIVE_MPC_INCREMENTAL_REPLAY_BATCH,
  );
  if (endIndex <= startIndex) {
    return { ok: true, skipped: true, reason: "empty_batch" };
  }

  const calibration =
    pipelineRun.calibration ??
    fitMpcCalibrationFromSteps(dataset.steps) ??
    null;
  if (!calibration) {
    return { ok: false, reason: "calibration_failed" };
  }

  const comfortTargets = await loadBuildingComfortTargets(ctx.buildingId);
  const buildingPreferences = resolveGenericMpcBuildingPreferences({
    buildingSlug: ctx.buildingSlug,
    comfortTargets,
  });

  const replaySolver = resolveMpcReplaySolverConfig(
    calibration.solver,
    "interactive",
  );

  const replay = runHistoricalMpcReplay({
    steps: dataset.steps,
    calibration,
    replayStartIndex: startIndex,
    replayEndIndex: endIndex,
    initialTExt: initialExtractFromSteps(dataset.steps, startIndex - 1),
    solverConfig: replaySolver,
    buildingPreferences,
  });

  await upsertPipelineReplaySteps({
    pipelineRunId: pipelineRun.id,
    buildingId: ctx.buildingId,
    steps: replay.steps,
  });

  const allSteps = await loadPipelineReplaySteps({
    pipelineRunId: pipelineRun.id,
  });
  const summary = summarizeMpcReplaySteps(allSteps);
  const batchSummary = summarizeMpcReplaySteps(replay.steps);
  if (summary && batchSummary && pipelineRun.snapshot) {
    const parsed = parsePersistedCalibrationPayload(pipelineRun.calibration);
    const emulatorValidation: EmulatorValidationMetrics =
      parsed.emulatorValidation ??
      (pipelineRun.snapshot.emulatorValidation as EmulatorValidationMetrics);
    const plantValidation: PlantValidationMetrics =
      parsed.plantValidation ??
      (pipelineRun.snapshot.plantValidation as PlantValidationMetrics);
    const partialResult = buildMpcPipelineResult({
      evalStart: dataset.evalStart,
      evalEnd: dataset.evalEnd,
      steps: dataset.steps,
      calibration,
      emulatorValidation,
      plantValidation,
      replay: { steps: allSteps, summary },
    });

    await prisma.sdAnleggMpcPipelineRun.update({
      where: { id: pipelineRun.id },
      data: buildRunScalarUpdateData(partialResult),
    });

    await persistIncrementalMpcReplaySteps({
      buildingId: ctx.buildingId,
      result: {
        ...partialResult,
        replay: {
          steps: replay.steps,
          summary: batchSummary,
        },
      },
      calibrationFingerprint: pipelineRun.id,
    });
  }

  const batchWatermark = replay.steps[replay.steps.length - 1]?.t ?? null;
  if (batchWatermark) {
    await prisma.sdAnleggLiveMpcState.updateMany({
      where: { buildingId: ctx.buildingId },
      data: { replayWatermarkAt: new Date(batchWatermark) },
    });
  }

  try {
    revalidatePath(`/sd-anlegg/${buildingSlug}/styring`);
    revalidateTag(`mpc-coverage:${buildingSlug}`, { expire: 0 });
  } catch {
    // Cron — best effort
  }

  return {
    ok: true,
    skipped: false,
    startIndex,
    endIndex,
    stepsWritten: replay.steps.length,
    watermarkAt: batchWatermark ?? dataset.evalEnd,
  };
}

export type IncrementalMpcReplayCatchUpResult = {
  batches: IncrementalMpcReplayResult[];
  totalStepsWritten: number;
  caughtUp: boolean;
};

/** Kjør flere inkrementelle batcher i én cron/UI-oppdatering (catch-up). */
export async function runIncrementalMpcReplayCatchUp(input?: {
  buildingSlug?: string;
  maxBatches?: number;
}): Promise<IncrementalMpcReplayCatchUpResult> {
  const maxBatches =
    input?.maxBatches ?? getMpcIncrementalReplayMaxBatches();
  const batches: IncrementalMpcReplayResult[] = [];
  let totalStepsWritten = 0;

  for (let i = 0; i < maxBatches; i++) {
    const batch = await runIncrementalMpcReplayBatch({
      buildingSlug: input?.buildingSlug,
    });
    batches.push(batch);
    if (!batch.ok) break;
    if (batch.skipped) break;
    totalStepsWritten += batch.stepsWritten;
  }

  const last = batches[batches.length - 1];
  const caughtUp =
    last?.ok === true &&
    last.skipped === true &&
    last.reason === "already_caught_up";

  return { batches, totalStepsWritten, caughtUp };
}

const incrementalCatchUpInFlight = new Set<string>();
const incrementalCatchUpLastAttempt = new Map<string, number>();

/** Page-load catch-up når eval SD ligger foran lagret replay (default auto-run). */
export function scheduleIncrementalMpcReplayCatchUpWhenBehind(input: {
  buildingSlug: string;
  replayBehindEval: boolean;
  simulationProgress?: MpcSimulationProgress | null;
}): boolean {
  if (!isMpcAutoRunEnabled()) return false;
  if (!input.replayBehindEval) return false;
  if (input.simulationProgress?.status === "running") return false;

  const { buildingSlug } = input;

  if (incrementalCatchUpInFlight.has(buildingSlug)) {
    return false;
  }

  const lastAttempt = incrementalCatchUpLastAttempt.get(buildingSlug) ?? 0;
  if (Date.now() - lastAttempt < MPC_BACKGROUND_ENSURE_COOLDOWN_MS) {
    return false;
  }

  incrementalCatchUpInFlight.add(buildingSlug);
  incrementalCatchUpLastAttempt.set(buildingSlug, Date.now());

  void runIncrementalMpcReplayCatchUp({ buildingSlug })
    .then((result) => {
      if (result.totalStepsWritten > 0 || result.caughtUp) {
        revalidateStyringAfterReplay(buildingSlug);
      }
    })
    .finally(() => {
      incrementalCatchUpInFlight.delete(buildingSlug);
    });

  return true;
}
