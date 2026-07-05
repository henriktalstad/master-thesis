import "server-only";

import { prisma } from "@/lib/db";
import { buildMpcInputFingerprint } from "@/lib/sd-anlegg/control/build-mpc-input-fingerprint";
import {
  buildRunScalarCreateData,
  buildRunScalarUpdateData,
  parsePersistedCalibrationPayload,
} from "@/lib/sd-anlegg/control/build-mpc-pipeline-run-scalars";
import { MPC_SIMULATION_CHECKPOINT_BATCH } from "@/lib/sd-anlegg/control/control-constants";
import {
  parseMpcSimulationCheckpoint,
  type MpcSimulationCheckpoint,
} from "@/lib/sd-anlegg/control/mpc-simulation-checkpoint";
import {
  loadPipelineReplaySteps,
  upsertPipelineReplaySteps,
} from "@/lib/sd-anlegg/control/persist-mpc-pipeline-replay-steps";
import { summarizeMpcReplaySteps } from "@/lib/sd-anlegg/control/summarize-mpc-replay-steps";
import { saveMpcSimulationCheckpoint } from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import {
  buildMpcPipelineResult,
  runHistoricalMpcReplay,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/replay-loop";
import {
  fitMpcPipelineCalibration,
  type MpcPipelineResult,
} from "@/lib/sd-anlegg/mpc/pipeline/run-mpc-pipeline";
import { resolveMpcReplaySolverConfig } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import type { MpcReplaySolverProfile } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import type { ResolvedMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import { serializeMpcPreferencesSnapshot } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import type { EvalDataset } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  logMpcReplayProgress,
  resetMpcReplayProgressLog,
} from "@/lib/sd-anlegg/control/mpc-replay-progress-log";

function buildInputFingerprint(
  buildingId: string,
  dataset: EvalDataset,
  calibration: MpcPipelineResult["calibration"],
): string {
  return buildMpcInputFingerprint({
    buildingId,
    evalStart: dataset.evalStart,
    evalEnd: dataset.evalEnd,
    stepCount: dataset.steps.length,
    modelVersion: calibration.modelVersion,
    horizonSteps: calibration.solver.horizonSteps,
    maxIterations: calibration.solver.maxIterations,
  });
}

async function ensurePipelineRunShell(input: {
  buildingId: string;
  pipelineRunId?: string;
  inputFingerprint: string;
  partialResult: MpcPipelineResult;
}): Promise<string> {
  const createData = buildRunScalarCreateData({
    buildingId: input.buildingId,
    inputFingerprint: input.inputFingerprint,
    result: input.partialResult,
  });
  const updateData = buildRunScalarUpdateData(input.partialResult);

  if (input.pipelineRunId) {
    await prisma.sdAnleggMpcPipelineRun.update({
      where: { id: input.pipelineRunId },
      data: {
        evalStart: new Date(input.partialResult.evalStart),
        evalEnd: new Date(input.partialResult.evalEnd),
        ...updateData,
      },
    });
    return input.pipelineRunId;
  }

  const uniqueWhere = {
    buildingId_inputFingerprint_modelVersion: {
      buildingId: input.buildingId,
      inputFingerprint: input.inputFingerprint,
      modelVersion: input.partialResult.calibration.modelVersion,
    },
  } as const;

  const persisted = await prisma.sdAnleggMpcPipelineRun.upsert({
    where: uniqueWhere,
    create: createData,
    update: {
      evalStart: new Date(input.partialResult.evalStart),
      evalEnd: new Date(input.partialResult.evalEnd),
      ...updateData,
    },
    select: { id: true },
  });

  return persisted.id;
}

function emptyReplaySummary(): MpcPipelineResult["replay"]["summary"] {
  return {
    stepCount: 0,
    fallbackSteps: 0,
    optimizedSteps: 0,
    optimizableSteps: 0,
    optimizablePct: 0,
    fallbackPct: 0,
    fallbackByReason: {
      missing_u_meas: 0,
      simultaneous_heat_cool: 0,
      alarm: 0,
      pump_fault: 0,
    },
    skippedSteps: 0,
    comfortViolationsMpc: 0,
    comfortViolationsBaseline: 0,
    comfortViolationsEmulated: 0,
    comfortViolationsDemand: 0,
    totalCostBaselineKr: 0,
    totalCostEmulatedKr: 0,
    totalCostMpcKr: 0,
    totalCostDemandKr: 0,
    deltaCostDemandKr: 0,
    deltaCostDemandPct: 0,
    deltaCostKr: 0,
    deltaCostPct: 0,
    deltaCostVsEmulatedKr: 0,
    deltaCostVsEmulatedPct: 0,
    peakElectricKwBaseline: 0,
    peakElectricKwEmulated: 0,
    peakElectricKwMpc: 0,
    peakElectricKwDemand: 0,
    controllableElectricKwhBaseline: 0,
    controllableElectricKwhEmulated: 0,
    controllableElectricKwhMpc: 0,
    controllableElectricKwhDemand: 0,
    controllableHeatKwhBaseline: 0,
    controllableHeatKwhEmulated: 0,
    controllableHeatKwhMpc: 0,
    controllableHeatKwhDemand: 0,
  };
}

function partialPipelineResult(input: {
  dataset: EvalDataset;
  calibration: MpcPipelineResult["calibration"];
  emulatorValidation: MpcPipelineResult["emulatorValidation"];
  plantValidation: MpcPipelineResult["plantValidation"];
  buildingPreferences?: ResolvedMpcBuildingPreferences;
  replaySteps?: MpcPipelineResult["replay"]["steps"];
  replaySummary?: MpcPipelineResult["replay"]["summary"];
}): MpcPipelineResult {
  return buildMpcPipelineResult({
    evalStart: input.dataset.evalStart,
    evalEnd: input.dataset.evalEnd,
    steps: input.dataset.steps,
    calibration: input.calibration,
    emulatorValidation: input.emulatorValidation,
    plantValidation: input.plantValidation,
    replay: {
      steps: input.replaySteps ?? [],
      summary: input.replaySummary ?? emptyReplaySummary(),
    },
    preferencesSnapshot: input.buildingPreferences
      ? serializeMpcPreferencesSnapshot(input.buildingPreferences, {
          occupancyCalibration: input.calibration.occupancy ?? null,
        })
      : null,
  });
}

export type MpcSimulationNextBatchResult =
  | {
      ok: true;
      done: boolean;
      replayIndex: number;
      totalSteps: number;
      pipelineRunId: string;
      result?: MpcPipelineResult;
      skipped?: boolean;
    }
  | { ok: false; done: true; reason: string };

export async function runMpcSimulationNextBatch(input: {
  buildingId: string;
  jobId: string;
  dataset: EvalDataset;
  buildingPreferences?: ResolvedMpcBuildingPreferences;
  solverProfile?: MpcReplaySolverProfile;
  batchIndex?: number;
  /** Bygg result + oppdater scalars uten ny replay (etter siste batch). */
  finalizeOnly?: boolean;
  onProgress?: (progress: {
    stepIndex: number;
    totalSteps: number;
    elapsedMs: number;
    fallbackSteps: number;
  }) => void;
}): Promise<MpcSimulationNextBatchResult> {
  const { dataset, buildingId, jobId } = input;
  const totalSteps = dataset.steps.length;
  if (totalSteps < 96) {
    return { ok: false, done: true, reason: "insufficient_steps" };
  }

  const jobRow = await prisma.sdAnleggMpcSimulationJob.findUnique({
    where: { id: jobId },
    select: { checkpoint: true, pipelineRunId: true },
  });
  const storedCheckpoint =
    parseMpcSimulationCheckpoint(jobRow?.checkpoint) ?? null;

  let calibrationBundle: ReturnType<typeof fitMpcPipelineCalibration> | null =
    null;
  let startIndex = storedCheckpoint?.replayIndex ?? 0;
  let loopState = storedCheckpoint?.loopState;
  let pipelineRunId =
    storedCheckpoint?.pipelineRunId ?? jobRow?.pipelineRunId ?? undefined;

  if (input.finalizeOnly) {
    if (!pipelineRunId) {
      return { ok: false, done: true, reason: "missing_pipeline_run" };
    }
    const allSteps = await loadPipelineReplaySteps({ pipelineRunId });
    const summary = summarizeMpcReplaySteps(allSteps);
    if (!summary) {
      return { ok: false, done: true, reason: "empty_replay_summary" };
    }
    const run = await prisma.sdAnleggMpcPipelineRun.findUnique({
      where: { id: pipelineRunId },
      select: { calibration: true },
    });
    const parsed = parsePersistedCalibrationPayload(run?.calibration);
    if (
      !parsed.calibration ||
      !parsed.emulatorValidation ||
      !parsed.plantValidation
    ) {
      return { ok: false, done: true, reason: "missing_calibration" };
    }
    const result = partialPipelineResult({
      dataset,
      calibration: parsed.calibration,
      emulatorValidation: parsed.emulatorValidation,
      plantValidation: parsed.plantValidation,
      buildingPreferences: input.buildingPreferences,
      replaySteps: allSteps,
      replaySummary: summary,
    });
    await prisma.sdAnleggMpcPipelineRun.update({
      where: { id: pipelineRunId },
      data: buildRunScalarUpdateData(result),
    });
    return {
      ok: true,
      done: true,
      replayIndex: totalSteps,
      totalSteps,
      pipelineRunId,
      result,
    };
  }

  const batchSize = MPC_SIMULATION_CHECKPOINT_BATCH;
  const expectedBatchStart =
    input.batchIndex != null ? input.batchIndex * batchSize : startIndex;

  if (startIndex >= totalSteps) {
    return {
      ok: true,
      done: true,
      skipped: true,
      replayIndex: startIndex,
      totalSteps,
      pipelineRunId: pipelineRunId ?? "",
    };
  }

  if (
    input.batchIndex != null &&
    expectedBatchStart < startIndex &&
    startIndex >= expectedBatchStart + batchSize
  ) {
    return {
      ok: true,
      done: startIndex >= totalSteps,
      skipped: true,
      replayIndex: startIndex,
      totalSteps,
      pipelineRunId: pipelineRunId ?? "",
    };
  }

  if (
    storedCheckpoint &&
    storedCheckpoint.replayIndex > 0 &&
    storedCheckpoint.replayIndex < totalSteps
  ) {
    startIndex = storedCheckpoint.replayIndex;
    const run = pipelineRunId
      ? await prisma.sdAnleggMpcPipelineRun.findUnique({
          where: { id: pipelineRunId },
          select: { calibration: true },
        })
      : null;
    const parsed = parsePersistedCalibrationPayload(run?.calibration);
    if (
      parsed.calibration &&
      parsed.emulatorValidation &&
      parsed.plantValidation
    ) {
      calibrationBundle = {
        calibration: parsed.calibration,
        emulatorValidation: parsed.emulatorValidation,
        plantValidation: parsed.plantValidation,
      };
    } else {
      startIndex = 0;
      loopState = undefined;
      pipelineRunId = undefined;
    }
  }

  if (!calibrationBundle) {
    calibrationBundle = fitMpcPipelineCalibration(dataset, {
      buildingPreferences: input.buildingPreferences,
    });
    if (!calibrationBundle) {
      return { ok: false, done: true, reason: "plant_model_fit_failed" };
    }
    startIndex = 0;
    loopState = undefined;
  }

  const { calibration, emulatorValidation, plantValidation } =
    calibrationBundle;
  const inputFingerprint = buildInputFingerprint(
    buildingId,
    dataset,
    calibration,
  );

  if (
    storedCheckpoint &&
    storedCheckpoint.inputFingerprint !== inputFingerprint &&
    startIndex > 0
  ) {
    startIndex = 0;
    loopState = undefined;
    pipelineRunId = undefined;
  }

  const replaySolver = resolveMpcReplaySolverConfig(
    calibration.solver,
    input.solverProfile ?? "interactive",
  );

  pipelineRunId = await ensurePipelineRunShell({
    buildingId,
    pipelineRunId,
    inputFingerprint,
    partialResult: partialPipelineResult({
      dataset,
      calibration,
      emulatorValidation,
      plantValidation,
      buildingPreferences: input.buildingPreferences,
    }),
  });

  await prisma.sdAnleggMpcSimulationJob.updateMany({
    where: { id: jobId },
    data: { pipelineRunId },
  });

  const batchStart = startIndex;
  const batchEnd = Math.min(totalSteps, batchStart + batchSize);
  if (batchStart >= batchEnd) {
    return {
      ok: true,
      done: true,
      replayIndex: batchStart,
      totalSteps,
      pipelineRunId,
    };
  }

  resetMpcReplayProgressLog();
  let fallbackStepsTotal = 0;
  const replayStartedAt = Date.now();

  const replay = runHistoricalMpcReplay({
    steps: dataset.steps,
    calibration,
    replayStartIndex: batchStart,
    replayEndIndex: batchEnd,
    initialState: loopState,
    solverConfig: replaySolver,
    buildingPreferences: input.buildingPreferences,
    onProgress: (progress) => {
      const globalIndex = batchStart + progress.stepIndex;
      fallbackStepsTotal = progress.fallbackSteps;
      logMpcReplayProgress({
        stepIndex: globalIndex,
        totalSteps,
        elapsedMs: Date.now() - replayStartedAt,
        fallbackSteps: fallbackStepsTotal,
      });
      input.onProgress?.({
        stepIndex: globalIndex,
        totalSteps,
        elapsedMs: Date.now() - replayStartedAt,
        fallbackSteps: fallbackStepsTotal,
      });
    },
  });

  await upsertPipelineReplaySteps({
    pipelineRunId,
    buildingId,
    steps: replay.steps,
  });

  const persistedSteps = await loadPipelineReplaySteps({ pipelineRunId });
  const batchSummary = summarizeMpcReplaySteps(persistedSteps);
  if (batchSummary) {
    await prisma.sdAnleggMpcPipelineRun.update({
      where: { id: pipelineRunId },
      data: {
        ...buildRunScalarUpdateData(
          partialPipelineResult({
            dataset,
            calibration,
            emulatorValidation,
            plantValidation,
            buildingPreferences: input.buildingPreferences,
            replaySteps: persistedSteps,
            replaySummary: batchSummary,
          }),
        ),
        persistedStepCount: persistedSteps.length,
      },
    });
  }

  loopState = replay.endState;
  const checkpoint: MpcSimulationCheckpoint = {
    version: 1,
    replayIndex: batchEnd,
    inputFingerprint,
    pipelineRunId,
    loopState: loopState ?? {
      tExtObserved: 20,
      tExtMpc: 20,
      tExtEmulated: 20,
      tExtDemand: 20,
      tRecMpc: null,
      tRecEmulated: null,
    },
  };

  await saveMpcSimulationCheckpoint({
    jobId,
    buildingId,
    pipelineRunId,
    checkpoint,
    stepIndex: batchEnd,
    stepTotal: totalSteps,
    message:
      batchEnd >= totalSteps
        ? "Simulering fullført — lagrer resultater…"
        : `Kjører simulering… ${batchEnd}/${totalSteps}`,
  });

  const done = batchEnd >= totalSteps;
  let result: MpcPipelineResult | undefined;
  if (done && batchSummary) {
    result = partialPipelineResult({
      dataset,
      calibration,
      emulatorValidation,
      plantValidation,
      buildingPreferences: input.buildingPreferences,
      replaySteps: persistedSteps,
      replaySummary: batchSummary,
    });
    await prisma.sdAnleggMpcPipelineRun.update({
      where: { id: pipelineRunId },
      data: buildRunScalarUpdateData(result),
    });
  }

  console.log("[mpc-simulation] batch ferdig:", {
    batchStart,
    batchEnd,
    totalSteps,
    done,
    persistedSteps: persistedSteps.length,
  });

  return {
    ok: true,
    done,
    replayIndex: batchEnd,
    totalSteps,
    pipelineRunId,
    result,
  };
}

export async function runMpcSimulationBatched(input: {
  buildingId: string;
  jobId: string;
  dataset: EvalDataset;
  buildingPreferences?: ResolvedMpcBuildingPreferences;
  solverProfile?: MpcReplaySolverProfile;
  resumeCheckpoint?: MpcSimulationCheckpoint | null;
  onProgress?: (progress: {
    stepIndex: number;
    totalSteps: number;
    elapsedMs: number;
    fallbackSteps: number;
  }) => void;
}): Promise<MpcPipelineResult | null> {
  const { dataset, buildingId, jobId } = input;
  const totalSteps = dataset.steps.length;
  if (totalSteps < 96) return null;

  const batchSize = MPC_SIMULATION_CHECKPOINT_BATCH;
  const batchCount = Math.ceil(totalSteps / batchSize);
  let lastResult: MpcPipelineResult | undefined;

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
    const batch = await runMpcSimulationNextBatch({
      buildingId,
      jobId,
      dataset,
      buildingPreferences: input.buildingPreferences,
      solverProfile: input.solverProfile,
      batchIndex,
      onProgress: input.onProgress,
    });
    if (!batch.ok) return null;
    if (batch.result) lastResult = batch.result;
    if (batch.done) break;
  }

  if (lastResult) {
    console.log("[mpc-simulation] batched replay ferdig:", {
      replaySteps: lastResult.replay.summary.stepCount,
      deltaCostPct: lastResult.replay.summary.deltaCostPct,
      fallbackSteps: lastResult.replay.summary.fallbackSteps,
    });
    return lastResult;
  }

  const finalize = await runMpcSimulationNextBatch({
    buildingId,
    jobId,
    dataset,
    buildingPreferences: input.buildingPreferences,
    solverProfile: input.solverProfile,
    finalizeOnly: true,
  });
  return finalize.ok ? finalize.result ?? null : null;
}
