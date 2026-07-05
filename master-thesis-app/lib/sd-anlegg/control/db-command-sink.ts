import "server-only";

import { prisma } from "@/lib/db";
import type { MpcExecutionMode, MpcSupervisoryStatus } from "@/generated/client";
import type { PolicyId } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import {
  MPC_CONTROL_KEYS,
  type MpcControlVector,
} from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CANONICAL_STEP_MINUTES } from "@/lib/sd-anlegg/control/mpc-execution-mode";
import { toPrismaJson, toPrismaJsonNullable } from "@/lib/sd-anlegg/control/prisma-json";
import {
  CompositeCommandSink,
  isMpcMqttWritebackEnabled,
  MqttCommandSink,
  type CommandSink,
} from "./command-sink";
import type { DbProposedCommand, ProposedCommand } from "./command-sink";
import { mqttTopicPrefix } from "./writeback-gate";

const BATCH_SIZE = 200;

export class DbCommandSink implements CommandSink {
  async writeProposed(commands: readonly DbProposedCommand[]): Promise<void> {
    if (commands.length === 0) return;

    for (let i = 0; i < commands.length; i += BATCH_SIZE) {
      const batch = commands.slice(i, i + BATCH_SIZE);
      await prisma.sdAnleggSupervisoryCommand.createMany({
        data: batch.map((cmd) => ({
          buildingId: cmd.buildingId,
          pipelineRunId: cmd.pipelineRunId,
          policyId: cmd.policyId,
          stepAt: cmd.stepAt,
          stepMinutes: cmd.stepMinutes ?? MPC_CANONICAL_STEP_MINUTES,
          kind: cmd.kind,
          executionMode: cmd.executionMode ?? "SUPERVISORY",
          uProposed: toPrismaJson(cmd.uProposed),
          uReference: cmd.uReference
            ? toPrismaJson(cmd.uReference)
            : toPrismaJsonNullable(null),
          signals: cmd.signals ? toPrismaJson(cmd.signals) : toPrismaJsonNullable(null),
          status: (cmd.status ?? "predicted") as MpcSupervisoryStatus,
          mqttTopic:
            cmd.policyId === "mpc-v1"
              ? `${mqttTopicPrefix()}/${cmd.kind}`
              : null,
        })),
        skipDuplicates: true,
      });
    }
  }
}

export function resolveCommandSink(input?: {
  db?: CommandSink;
  mqtt?: CommandSink;
}): CommandSink {
  const sinks: CommandSink[] = [input?.db ?? new DbCommandSink()];
  if (isMpcMqttWritebackEnabled()) {
    sinks.push(input?.mqtt ?? new MqttCommandSink());
  }
  return sinks.length === 1 ? sinks[0]! : new CompositeCommandSink(sinks);
}

export async function replaceReplayCommandsForPipelineRun(input: {
  buildingId: string;
  pipelineRunId: string;
  commands: readonly DbProposedCommand[];
  executionMode?: MpcExecutionMode;
}): Promise<void> {
  await prisma.sdAnleggSupervisoryCommand.deleteMany({
    where: {
      pipelineRunId: input.pipelineRunId,
      kind: "replay_step",
    },
  });
  const sink = resolveCommandSink();
  const executionMode = input.executionMode ?? "SHADOW";
  await sink.writeProposed(
    input.commands.map((cmd) => ({
      ...cmd,
      executionMode,
      stepMinutes: cmd.stepMinutes ?? MPC_CANONICAL_STEP_MINUTES,
    })),
  );
}

export async function replaceForwardPlanCommands(input: {
  buildingId: string;
  pipelineRunId: string;
  commands: readonly DbProposedCommand[];
  executionMode?: MpcExecutionMode;
}): Promise<void> {
  await prisma.sdAnleggSupervisoryCommand.deleteMany({
    where: {
      buildingId: input.buildingId,
      pipelineRunId: input.pipelineRunId,
      kind: "forward_plan",
    },
  });
  const sink = resolveCommandSink();
  const executionMode = input.executionMode ?? "SUPERVISORY";
  await sink.writeProposed(
    input.commands.map((cmd) => ({
      ...cmd,
      executionMode,
      stepMinutes: cmd.stepMinutes ?? MPC_CANONICAL_STEP_MINUTES,
    })),
  );
}

const REPLAY_POLICY_ORDER: readonly PolicyId[] = [
  "observed",
  "emulated",
  "demand-scoped",
  "mpc-v1",
];

export type PlannedSupervisoryCommandsSnapshot = {
  pipelineRunId: string;
  stepMinutes: number;
  policyCounts: Record<string, number>;
  sampleStepAt: string | null;
  vectorsByPolicy: Partial<Record<PolicyId, MpcControlVector>>;
  forwardPlanCount: number;
};

function parseControlVector(raw: unknown): MpcControlVector | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const values = MPC_CONTROL_KEYS.map((key) => o[key]);
  if (values.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    return null;
  }
  return o as MpcControlVector;
}

export async function loadPlannedSupervisoryCommandsSnapshot(
  buildingId: string,
  pipelineRunIdHint?: string | null,
): Promise<PlannedSupervisoryCommandsSnapshot | null> {
  const pipelineRunId =
    pipelineRunIdHint ??
    (
      await prisma.sdAnleggSupervisoryCommand.findFirst({
        where: {
          buildingId,
          kind: { in: ["replay_step", "forward_plan"] },
        },
        orderBy: { createdAt: "desc" },
        select: { pipelineRunId: true },
      })
    )?.pipelineRunId;
  if (!pipelineRunId) return null;

  const grouped = await prisma.sdAnleggSupervisoryCommand.groupBy({
    by: ["policyId"],
    where: { buildingId, pipelineRunId, kind: "replay_step" },
    _count: { _all: true },
  });
  const policyCounts = Object.fromEntries(
    grouped.map((row) => [row.policyId, row._count._all]),
  );

  const forwardPlanCount = await prisma.sdAnleggSupervisoryCommand.count({
    where: { buildingId, pipelineRunId, kind: "forward_plan", policyId: "mpc-v1" },
  });

  const anchor = await prisma.sdAnleggSupervisoryCommand.findFirst({
    where: { buildingId, pipelineRunId, kind: "replay_step", policyId: "mpc-v1" },
    orderBy: { stepAt: "desc" },
    select: { stepAt: true, stepMinutes: true },
  });
  if (!anchor) {
    return {
      pipelineRunId,
      stepMinutes: MPC_CANONICAL_STEP_MINUTES,
      policyCounts,
      sampleStepAt: null,
      vectorsByPolicy: {},
      forwardPlanCount,
    };
  }

  const rows = await prisma.sdAnleggSupervisoryCommand.findMany({
    where: {
      buildingId,
      pipelineRunId,
      kind: "replay_step",
      stepAt: anchor.stepAt,
      policyId: { in: [...REPLAY_POLICY_ORDER] },
    },
  });

  const vectorsByPolicy: Partial<Record<PolicyId, MpcControlVector>> = {};
  for (const row of rows) {
    const u = parseControlVector(row.uProposed);
    if (u) {
      vectorsByPolicy[row.policyId as PolicyId] = u;
    }
  }

  return {
    pipelineRunId,
    stepMinutes: anchor.stepMinutes,
    policyCounts,
    sampleStepAt: anchor.stepAt.toISOString(),
    vectorsByPolicy,
    forwardPlanCount,
  };
}

export async function loadPendingWritebackCommands(buildingId: string, limit = 20) {
  return prisma.sdAnleggSupervisoryCommand.findMany({
    where: {
      buildingId,
      policyId: "mpc-v1",
      status: "predicted",
      kind: { in: ["control_tick", "forward_plan"] },
    },
    orderBy: { stepAt: "desc" },
    take: limit,
  });
}

export async function approveSupervisoryCommand(commandId: string): Promise<void> {
  const now = new Date();
  const row = await prisma.sdAnleggSupervisoryCommand.update({
    where: { id: commandId },
    data: { status: "approved", approvedAt: now },
  });

  if (isMpcMqttWritebackEnabled()) {
    const mqtt = new MqttCommandSink();
    await mqtt.writeProposed([
      {
        buildingId: row.buildingId,
        policyId: row.policyId as ProposedCommand["policyId"],
        stepAt: row.stepAt,
        kind: row.kind as ProposedCommand["kind"],
        uProposed: row.uProposed as ProposedCommand["uProposed"],
        uReference: (row.uReference as ProposedCommand["uReference"]) ?? undefined,
        pipelineRunId: row.pipelineRunId,
        commandId: row.id,
        status: "approved",
      },
    ]);
    await prisma.sdAnleggSupervisoryCommand.update({
      where: { id: commandId },
      data: { status: "published", publishedAt: now },
    });
  }
}

export async function rejectSupervisoryCommand(commandId: string): Promise<void> {
  await prisma.sdAnleggSupervisoryCommand.update({
    where: { id: commandId },
    data: { status: "rejected" },
  });
}

export async function markSupervisoryCommandAcknowledged(
  commandId: string,
  bmsResponse?: Record<string, unknown>,
): Promise<void> {
  await prisma.sdAnleggSupervisoryCommand.update({
    where: { id: commandId },
    data: {
      status: "acknowledged",
      acknowledgedAt: new Date(),
      bmsResponse: bmsResponse ? toPrismaJson(bmsResponse) : undefined,
    },
  });
}

export async function markSupervisoryCommandApplied(
  commandId: string,
  bmsResponse?: Record<string, unknown>,
): Promise<void> {
  await prisma.sdAnleggSupervisoryCommand.update({
    where: { id: commandId },
    data: {
      status: "applied",
      appliedAt: new Date(),
      bmsResponse: bmsResponse ? toPrismaJson(bmsResponse) : undefined,
    },
  });
}
