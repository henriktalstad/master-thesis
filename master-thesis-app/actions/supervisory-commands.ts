"use server";

import { revalidatePath } from "next/cache";
import {
  buildReplayStepSignalMatrix,
  groupReplaySignalRowsByKind,
  type ReplayStepSignalRow,
} from "@/lib/sd-anlegg/control/build-replay-step-signal-matrix";
import {
  approveSupervisoryCommand,
  loadPendingWritebackCommands,
  loadPlannedSupervisoryCommandsSnapshot,
  rejectSupervisoryCommand,
} from "@/lib/sd-anlegg/control/db-command-sink";
import { prisma } from "@/lib/db";
import { loadLatestMpcPipelineRun } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";

export type PlannedCommandsView = {
  pipelineRunId: string;
  evalStart: string;
  evalEnd: string;
  stepCount: number;
  stepMinutes: 15;
  policyCounts: Record<string, number>;
  forwardPlanStepCount: number;
  sampleStepAt: string | null;
  signalGroups: Record<
    "control" | "measured_state" | "derived_state" | "disturbance" | "constraint",
    ReplayStepSignalRow[]
  >;
};

function lastReplayStep(steps: readonly MpcReplayStep[]): MpcReplayStep | null {
  if (steps.length === 0) return null;
  return steps[steps.length - 1] ?? null;
}

export async function loadPlannedSupervisoryCommandsAction(buildingSlug: string) {
  const ctx = await resolveMpcBuildingSource({ buildingSlug });
  if (!ctx) {
    return { ok: false as const, view: null, pendingMqtt: [] };
  }

  const pipelineRun = await loadLatestMpcPipelineRun(ctx.buildingId);
  const replaySteps = pipelineRun?.replaySteps ?? [];
  const sampleStep = lastReplayStep(replaySteps);

  const [snapshot, pendingRows, forwardPlanCount] = await Promise.all([
    loadPlannedSupervisoryCommandsSnapshot(
      ctx.buildingId,
      pipelineRun?.id ?? null,
    ),
    loadPendingWritebackCommands(ctx.buildingId),
    ctx.buildingId && pipelineRun?.id
      ? prisma.sdAnleggSupervisoryCommand.count({
          where: {
            buildingId: ctx.buildingId,
            pipelineRunId: pipelineRun.id,
            kind: "forward_plan",
          },
        })
      : Promise.resolve(0),
  ]);

  const matrix = sampleStep ? buildReplayStepSignalMatrix(sampleStep) : [];
  const policyCounts =
    snapshot?.policyCounts ??
    Object.fromEntries(
      ["observed", "emulated", "demand-scoped", "mpc-v1"].map((id) => [id, 0]),
    );

  let view: PlannedCommandsView | null = null;
  if (pipelineRun) {
    view = {
      pipelineRunId: pipelineRun.id,
      evalStart: pipelineRun.evalStart,
      evalEnd: pipelineRun.evalEnd,
      stepCount: pipelineRun.stepCount ?? replaySteps.length,
      stepMinutes: 15,
      policyCounts,
      forwardPlanStepCount: forwardPlanCount,
      sampleStepAt: sampleStep?.t ?? snapshot?.sampleStepAt ?? null,
      signalGroups: groupReplaySignalRowsByKind(matrix),
    };
  } else if (snapshot) {
    view = {
      pipelineRunId: snapshot.pipelineRunId,
      evalStart: "",
      evalEnd: "",
      stepCount: snapshot.policyCounts["mpc-v1"] ?? 0,
      stepMinutes: 15,
      policyCounts: snapshot.policyCounts,
      forwardPlanStepCount: forwardPlanCount,
      sampleStepAt: snapshot.sampleStepAt,
      signalGroups: groupReplaySignalRowsByKind(matrix),
    };
  }

  return {
    ok: true as const,
    view,
    pendingMqtt: pendingRows.map((c) => ({
      id: c.id,
      stepAt: c.stepAt.toISOString(),
      policyId: c.policyId,
      kind: c.kind,
      uProposed: c.uProposed,
    })),
  };
}

export async function approveWritebackCommandAction(input: {
  buildingSlug: string;
  commandId: string;
}) {
  await approveSupervisoryCommand(input.commandId);
  revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);
  return { ok: true as const };
}

export async function rejectWritebackCommandAction(input: {
  buildingSlug: string;
  commandId: string;
}) {
  await rejectSupervisoryCommand(input.commandId);
  revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);
  return { ok: true as const };
}
