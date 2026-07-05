import "server-only";

import { prisma } from "@/lib/db";
import { buildMpcSignalComparison } from "./build-mpc-signal-comparison";
import { persistMpcEnergyReconcileFromSteps } from "./persist-mpc-energy-reconcile";
import {
  loadPipelineReplaySteps,
  replacePipelineReplaySteps,
} from "./persist-mpc-pipeline-replay-steps";
import { buildReplayProposedCommands } from "./command-sink";
import { replaceReplayCommandsForPipelineRun } from "./db-command-sink";
import { persistRelationalPipelineArtifacts } from "./persist-mpc-pipeline-relational-artifacts";
import {
  parsePersistedCalibrationPayload,
} from "./build-mpc-pipeline-run-scalars";
import { summarizeMpcReplaySteps } from "./summarize-mpc-replay-steps";
import type {
  MpcCalibrationBundle,
  MpcPipelineResult,
} from "@/lib/sd-anlegg/mpc/shared/types";

export type BackfillMpcPipelineArtifactsResult = {
  pipelineRunId: string;
  replayStepsWritten: number;
  supervisoryCommandsWritten: number;
  energyReconcileHours: number;
  deltaMpcVsEmulatedCostKr: number;
  chartPointCount: number;
  policyKpiCount: number;
};

function syntheticPipelineResult(input: {
  evalStart: Date;
  evalEnd: Date;
  stepCount: number;
  calibration: MpcCalibrationBundle;
  steps: ReturnType<typeof loadPipelineReplaySteps> extends Promise<infer S>
    ? S
    : never;
}): MpcPipelineResult {
  const summary = summarizeMpcReplaySteps(input.steps);
  if (!summary) {
    throw new Error("Kan ikke backfille uten gyldig replay-summary");
  }
  const { emulatorValidation, plantValidation } = parsePersistedCalibrationPayload(
    input.calibration,
  );

  return {
    evalStart: input.evalStart.toISOString(),
    evalEnd: input.evalEnd.toISOString(),
    stepCount: input.stepCount,
    calibration: input.calibration,
    emulatorValidation: emulatorValidation ?? {
      comparedSteps: 0,
      mae: {},
      heatingModeAccuracy: 0,
      coolingModeAccuracy: 0,
    },
    plantValidation: plantValidation ?? {
      comparedSteps: 0,
      maeC: 0,
      rmseC: 0,
    },
    replay: {
      steps: input.steps,
      summary,
    },
    hourlyEnergy: [],
  };
}

export async function backfillMpcPipelineArtifacts(input: {
  pipelineRunId: string;
}): Promise<BackfillMpcPipelineArtifactsResult | null> {
  const row = await prisma.sdAnleggMpcPipelineRun.findUnique({
    where: { id: input.pipelineRunId },
    select: {
      id: true,
      buildingId: true,
      evalStart: true,
      evalEnd: true,
      calibration: true,
      stepCount: true,
    },
  });

  if (!row?.calibration) return null;

  const steps = await loadPipelineReplaySteps({ pipelineRunId: row.id });
  if (steps.length === 0) return null;

  const { calibration } = parsePersistedCalibrationPayload(row.calibration);
  if (!calibration) return null;

  const { stepsWritten: replayStepsWritten } = await replacePipelineReplaySteps({
    pipelineRunId: row.id,
    buildingId: row.buildingId,
    steps,
  });

  const proposedCommands = buildReplayProposedCommands({
    buildingId: row.buildingId,
    pipelineRunId: row.id,
    steps,
  });
  const supervisoryCommandsWritten = proposedCommands.length;
  await replaceReplayCommandsForPipelineRun({
    buildingId: row.buildingId,
    pipelineRunId: row.id,
    commands: proposedCommands,
  });

  const { summary, hoursWritten } = await persistMpcEnergyReconcileFromSteps({
    pipelineRunId: row.id,
    buildingId: row.buildingId,
    evalStart: row.evalStart.toISOString(),
    evalEnd: row.evalEnd.toISOString(),
    steps,
    calibration,
  });

  const result = syntheticPipelineResult({
    evalStart: row.evalStart,
    evalEnd: row.evalEnd,
    stepCount: row.stepCount,
    calibration,
    steps,
  });

  const relational = await persistRelationalPipelineArtifacts({
    pipelineRunId: row.id,
    result,
    steps,
  });

  void buildMpcSignalComparison(steps, { resolution: "step" });

  return {
    pipelineRunId: row.id,
    replayStepsWritten,
    supervisoryCommandsWritten,
    energyReconcileHours: hoursWritten,
    deltaMpcVsEmulatedCostKr: summary.deltaMpcVsEmulated.costKr,
    chartPointCount: relational.chartPointCount,
    policyKpiCount: relational.policyKpiCount,
  };
}

export async function backfillLatestMpcPipelineForBuilding(
  buildingId: string,
): Promise<BackfillMpcPipelineArtifactsResult | null> {
  const latest = await prisma.sdAnleggMpcPipelineRun.findFirst({
    where: { buildingId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latest) return null;
  return backfillMpcPipelineArtifacts({ pipelineRunId: latest.id });
}
