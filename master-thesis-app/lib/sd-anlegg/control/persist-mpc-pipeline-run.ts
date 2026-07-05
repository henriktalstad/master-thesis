import { Prisma } from "@/generated/client";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { prisma, withPrismaRetry, ensurePrismaConnection } from "@/lib/db";
import { MPC_CONTROL_MODEL_VERSION } from "@/lib/sd-anlegg/control/control-constants";
import { buildMpcInputFingerprint } from "@/lib/sd-anlegg/control/build-mpc-input-fingerprint";
import { buildMpcSignalComparison } from "@/lib/sd-anlegg/control/build-mpc-signal-comparison";
import { persistDerivedPipelineArtifacts } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-artifacts";
import type { PipelineArtifactIssue } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-artifacts";
import {
  buildReplaySummaryFromScalars,
  buildRunScalarCreateData,
  buildRunScalarUpdateData,
} from "@/lib/sd-anlegg/control/build-mpc-pipeline-run-scalars";
import type {
  MpcPipelineRunRecord,
  MpcPipelineSnapshot,
} from "@/lib/sd-anlegg/control/control-types";
import type { MpcPipelineResult } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcEnergyReconcileSummary } from "@/lib/sd-anlegg/control/build-mpc-energy-reconcile";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function buildMpcPipelineRunRecordFromResult(
  result: MpcPipelineResult,
  options?: {
    id?: string;
    energyReconcileSummary?: MpcEnergyReconcileSummary | null;
  },
): MpcPipelineRunRecord {
  const snapshot = buildMpcPipelineSnapshot(result);
  return {
    id: options?.id ?? "local-replay",
    modelVersion: result.calibration.modelVersion,
    evalStart: result.evalStart,
    evalEnd: result.evalEnd,
    stepCount: result.stepCount,
    trainStepCount: result.calibration.trainStepCount,
    holdoutStepCount: result.calibration.holdoutStepCount,
    createdAt: new Date().toISOString(),
    snapshot,
    signalComparison: buildMpcSignalComparison(result.replay.steps),
    stepComparison: buildMpcSignalComparison(result.replay.steps, {
      resolution: "step",
    }),
    calibration: result.calibration,
    replaySteps: result.replay.steps,
    energyReconcileSummary: options?.energyReconcileSummary ?? null,
  };
}

export function buildMpcPipelineSnapshot(
  result: MpcPipelineResult,
): MpcPipelineSnapshot {
  const mae = result.emulatorValidation.mae;
  return {
    modelVersion: result.calibration.modelVersion,
    evalStart: result.evalStart,
    evalEnd: result.evalEnd,
    stepCount: result.stepCount,
    trainStepCount: result.calibration.trainStepCount,
    holdoutStepCount: result.calibration.holdoutStepCount,
    emulatorValidation: {
      comparedSteps: result.emulatorValidation.comparedSteps,
      mae: {
        supplySetpointC: mae.supplySetpointC ?? 0,
        supplyFanPct: mae.supplyFanPct ?? 0,
        exhaustFanPct: mae.exhaustFanPct ?? 0,
        heatingValvePct: mae.heatingValvePct ?? 0,
        coolingValvePct: mae.coolingValvePct ?? 0,
      },
      heatingModeAccuracy: result.emulatorValidation.heatingModeAccuracy ?? 0,
      coolingModeAccuracy: result.emulatorValidation.coolingModeAccuracy ?? 0,
    },
    plantValidation: result.plantValidation,
    replaySummary: buildReplaySummaryFromScalars({
      stepCount: result.stepCount,
      trainStepCount: result.calibration.trainStepCount,
      holdoutStepCount: result.calibration.holdoutStepCount,
      summary: result.replay.summary,
    }),
  };
}

export async function persistMpcPipelineRun(input: {
  buildingId: string;
  result: MpcPipelineResult;
  /** Replay-rader allerede upsertet under batched sim — hopp over delete+recreate. */
  skipReplayReplace?: boolean;
  executionMode?: import("@/generated/client").MpcExecutionMode;
  stepMinutes?: number;
}): Promise<{ id: string; artifactIssues: PipelineArtifactIssue[] } | null> {
  const { result, buildingId } = input;
  const inputFingerprint = buildMpcInputFingerprint({
    buildingId,
    evalStart: result.evalStart,
    evalEnd: result.evalEnd,
    stepCount: result.stepCount,
    modelVersion: result.calibration.modelVersion,
    horizonSteps: result.calibration.solver.horizonSteps,
    maxIterations: result.calibration.solver.maxIterations,
  });

  const createData = buildRunScalarCreateData({
    buildingId,
    inputFingerprint,
    result,
    executionMode: input.executionMode,
    stepMinutes: input.stepMinutes,
  });
  const updateData = buildRunScalarUpdateData(result);

  const uniqueWhere = {
    buildingId_inputFingerprint_modelVersion: {
      buildingId,
      inputFingerprint,
      modelVersion: result.calibration.modelVersion,
    },
  } as const;

  try {
    await ensurePrismaConnection();

    const persisted = await withPrismaRetry(
      () =>
        prisma.sdAnleggMpcPipelineRun.upsert({
          where: uniqueWhere,
          create: createData,
          update: {
            evalStart: new Date(result.evalStart),
            evalEnd: new Date(result.evalEnd),
            persistStatus: "PENDING",
            persistedStepCount: 0,
            persistError: null,
            ...updateData,
          },
          select: { id: true },
        }),
      { retries: 4, delayMs: 750 },
    );

    const { issues: artifactIssues } = await persistDerivedPipelineArtifacts({
      pipelineRunId: persisted.id,
      buildingId,
      result,
      inputFingerprint,
      skipReplayReplace: input.skipReplayReplace,
      executionMode: input.executionMode,
    }).catch((error: unknown) => {
      console.warn("[persistMpcPipelineRun] derived artifacts feilet:", error);
      return {
        issues: [
          {
            step: "derived artifacts",
            critical: false,
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        supervisoryCommandCount: 0,
      };
    });

    return { id: persisted.id, artifactIssues };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      console.error("[persistMpcPipelineRun]", error);
      return null;
    }
    const existing = await withPrismaRetry(
      () =>
        prisma.sdAnleggMpcPipelineRun.findUnique({
          where: uniqueWhere,
          select: { id: true },
        }),
      { retries: 3, delayMs: 500 },
    );
    return existing ? { id: existing.id, artifactIssues: [] } : null;
  }
}

export async function resolveBuildingIdForMpcPersist(): Promise<string | null> {
  const buildingId = process.env.BUILDING_ID?.trim();
  const buildingSlug = resolveBuildingSlug();
  const building = await prisma.building.findFirst({
    where: buildingId ? { id: buildingId } : buildingSlug ? { slug: buildingSlug } : undefined,
    select: { id: true },
  });
  return building?.id ?? null;
}

export { MPC_CONTROL_MODEL_VERSION };
