import "server-only";

import { prisma, withPrismaRetry, PRISMA_TX_TIMEOUT_MS } from "@/lib/db";
import { compactMpcReplayStep } from "@/lib/sd-anlegg/control/compact-mpc-replay-step";
import { MPC_CANONICAL_STEP_MINUTES } from "@/lib/sd-anlegg/control/mpc-execution-mode";
import { MPC_CONTROL_MODEL_VERSION } from "@/lib/sd-anlegg/control/control-constants";
import { toPrismaJson, toPrismaJsonNullable } from "@/lib/sd-anlegg/control/prisma-json";
import type { ControlPlanDiff, LiveForwardPlans, MpcForwardPlan } from "../control-types-live";
import { buildLiveTickProposedCommands, buildForwardPlanProposedCommands } from "@/lib/sd-anlegg/control/command-sink";
import { resolveCommandSink, replaceForwardPlanCommands } from "@/lib/sd-anlegg/control/db-command-sink";
import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

async function resolveLatestPipelineRunId(buildingId: string): Promise<string | null> {
  const run = await prisma.sdAnleggMpcPipelineRun.findFirst({
    where: { buildingId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return run?.id ?? null;
}

export async function persistLiveControlLoopStep(input: {
  buildingId: string;
  calibrationFingerprint: string;
  step: MpcReplayStep;
}): Promise<void> {
  await prisma.sdAnleggMpcReplayStep.upsert({
    where: {
      buildingId_stepAt_stepMinutes_modelVersion: {
        buildingId: input.buildingId,
        stepAt: new Date(input.step.t),
        stepMinutes: MPC_CANONICAL_STEP_MINUTES,
        modelVersion: MPC_CONTROL_MODEL_VERSION,
      },
    },
    create: {
      buildingId: input.buildingId,
      stepAt: new Date(input.step.t),
      stepMinutes: MPC_CANONICAL_STEP_MINUTES,
      modelVersion: MPC_CONTROL_MODEL_VERSION,
      calibrationFingerprint: input.calibrationFingerprint,
      payload: toPrismaJson(compactMpcReplayStep(input.step)),
    },
    update: {
      calibrationFingerprint: input.calibrationFingerprint,
      payload: toPrismaJson(compactMpcReplayStep(input.step)),
    },
  });
}

export async function persistControlTickResult(input: {
  buildingId: string;
  tickAt: Date;
  triggerSource: string;
  calibrationFingerprint: string;
  pipelineRunId?: string | null;
  forwardPlan: MpcForwardPlan;
  forwardPlans?: LiveForwardPlans;
  planDiff: ControlPlanDiff;
  activeCommand: MpcControlVector;
  uReference: MpcControlVector;
  liveStep: MpcReplayStep;
  stateSnapshot?: Record<string, unknown>;
}): Promise<{ tickId: string }> {
  const tickId = crypto.randomUUID();

  await withPrismaRetry(
    () =>
      prisma.$transaction(
        [
          prisma.sdAnleggLiveMpcState.upsert({
            where: { buildingId: input.buildingId },
            create: {
              buildingId: input.buildingId,
              modelVersion: MPC_CONTROL_MODEL_VERSION,
              calibrationFingerprint: input.calibrationFingerprint,
              forwardPlan: toPrismaJson(input.forwardPlan),
              forwardPlans: toPrismaJsonNullable(input.forwardPlans),
              lastControlTickAt: input.tickAt,
              lastPlanDiff: toPrismaJson(input.planDiff),
              activeCommand: toPrismaJson(input.activeCommand),
            },
            update: {
              forwardPlan: toPrismaJson(input.forwardPlan),
              forwardPlans: toPrismaJsonNullable(input.forwardPlans),
              lastControlTickAt: input.tickAt,
              lastPlanDiff: toPrismaJson(input.planDiff),
              activeCommand: toPrismaJson(input.activeCommand),
              calibrationFingerprint: input.calibrationFingerprint,
            },
          }),
          prisma.sdAnleggControlTick.create({
            data: {
              id: tickId,
              buildingId: input.buildingId,
              tickAt: input.tickAt,
              triggerSource: input.triggerSource,
              modelVersion: MPC_CONTROL_MODEL_VERSION,
              calibrationFingerprint: input.calibrationFingerprint,
              planDiff: toPrismaJson(input.planDiff),
              activeCommand: toPrismaJson(input.activeCommand),
              forwardPlanEffect: toPrismaJson(input.forwardPlan.effect),
              stateSnapshot: toPrismaJsonNullable(input.stateSnapshot),
            },
          }),
        ],
        { timeout: PRISMA_TX_TIMEOUT_MS },
      ),
    { retries: 2, delayMs: 500 },
  );

  await persistLiveControlLoopStep({
    buildingId: input.buildingId,
    calibrationFingerprint: input.calibrationFingerprint,
    step: input.liveStep,
  });

  const { upsertControlSignalHoursFromSteps } = await import(
    "@/lib/sd-anlegg/control/persist-control-signal-hours"
  );
  await upsertControlSignalHoursFromSteps({
    buildingId: input.buildingId,
    steps: [input.liveStep],
    calibrationFingerprint: input.calibrationFingerprint,
    pipelineRunId: input.pipelineRunId ?? null,
  });

  const pipelineRunId =
    input.pipelineRunId ?? (await resolveLatestPipelineRunId(input.buildingId));
  if (pipelineRunId) {
    const sink = resolveCommandSink();
    await sink.writeProposed(
      buildLiveTickProposedCommands({
        buildingId: input.buildingId,
        pipelineRunId,
        tickAt: input.tickAt,
        step: input.liveStep,
      }),
    );

    await replaceForwardPlanCommands({
      buildingId: input.buildingId,
      pipelineRunId,
      commands: buildForwardPlanProposedCommands({
        buildingId: input.buildingId,
        pipelineRunId,
        plan: input.forwardPlan,
      }),
    });
  }

  return { tickId };
}
