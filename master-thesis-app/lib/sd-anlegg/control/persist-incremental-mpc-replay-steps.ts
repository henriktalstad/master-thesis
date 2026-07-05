import "server-only";

import { Prisma } from "@/generated/client";
import { prisma, PRISMA_TX_TIMEOUT_MS } from "@/lib/db";
import {
  LIVE_MPC_REPLAY_RETENTION_DAYS,
  MPC_CONTROL_MODEL_VERSION,
} from "@/lib/sd-anlegg/control/control-constants";
import { compactMpcReplayStep } from "@/lib/sd-anlegg/control/compact-mpc-replay-step";
import type { MpcPipelineResult } from "@/lib/sd-anlegg/mpc/shared/types";

const UPSERT_CHUNK = 100;

export type PersistIncrementalMpcReplayResult = {
  stepsWritten: number;
  watermarkAt: string | null;
};

export async function persistIncrementalMpcReplaySteps(input: {
  buildingId: string;
  result: MpcPipelineResult;
  calibrationFingerprint: string;
}): Promise<PersistIncrementalMpcReplayResult> {
  const { buildingId, result, calibrationFingerprint } = input;
  const steps = result.replay.steps;
  if (steps.length === 0) {
    return { stepsWritten: 0, watermarkAt: null };
  }

  const modelVersion = result.calibration.modelVersion ?? MPC_CONTROL_MODEL_VERSION;
  let stepsWritten = 0;

  for (let i = 0; i < steps.length; i += UPSERT_CHUNK) {
    const chunk = steps.slice(i, i + UPSERT_CHUNK);
    const rows = chunk.map((step) => ({
      buildingId,
      stepAt: new Date(step.t),
      modelVersion,
      calibrationFingerprint,
      payload: compactMpcReplayStep(step) as Prisma.InputJsonValue,
    }));

    const created = await prisma.sdAnleggMpcReplayStep.createMany({
      data: rows,
      skipDuplicates: true,
    });
    stepsWritten += created.count;
  }

  const lastStep = steps[steps.length - 1]!;
  const watermarkAt = new Date(lastStep.t);
  const retentionCutoff = new Date(
    watermarkAt.getTime() - LIVE_MPC_REPLAY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.$transaction(
    [
      prisma.sdAnleggMpcReplayStep.deleteMany({
      where: {
        buildingId,
        modelVersion,
        stepAt: { lt: retentionCutoff },
      },
    }),
    prisma.sdAnleggLiveMpcState.upsert({
      where: { buildingId },
      create: {
        buildingId,
        modelVersion,
        calibrationFingerprint,
        calibration: result.calibration as Prisma.InputJsonValue,
        plantRmseC: result.plantValidation.rmseC,
        emulatorMaeSupplySetpointC:
          result.emulatorValidation.mae.supplySetpointC ?? null,
        evalStart: new Date(result.evalStart),
        evalEnd: new Date(result.evalEnd),
        replayWatermarkAt: watermarkAt,
      },
      update: {
        modelVersion,
        calibrationFingerprint,
        calibration: result.calibration as Prisma.InputJsonValue,
        plantRmseC: result.plantValidation.rmseC,
        emulatorMaeSupplySetpointC:
          result.emulatorValidation.mae.supplySetpointC ?? null,
        evalStart: new Date(result.evalStart),
        evalEnd: new Date(result.evalEnd),
        replayWatermarkAt: watermarkAt,
      },
    }),
    ],
    { timeout: PRISMA_TX_TIMEOUT_MS },
  );

  const { upsertControlSignalHoursFromSteps } = await import(
    "@/lib/sd-anlegg/control/persist-control-signal-hours"
  );
  await upsertControlSignalHoursFromSteps({
    buildingId,
    steps,
    calibrationFingerprint,
  });

  return {
    stepsWritten,
    watermarkAt: watermarkAt.toISOString(),
  };
}
