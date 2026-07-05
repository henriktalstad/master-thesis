import type { MpcExecutionMode, MpcSupervisoryStatus } from "@/generated/client";
import type { PolicyId } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcForwardPlan } from "@/lib/sd-anlegg/control/control-types";
import { replayStepObservedSignals } from "./build-replay-step-signal-matrix";
import {
  canPublishStatus,
  isMqttPublishEnabled,
  isWritebackArmed,
  mqttTopicPrefix,
} from "./writeback-gate";

export type ProposedCommandKind = "replay_step" | "forward_plan" | "control_tick";

/** Pådrag som skal persisteres i Postgres — pipelineRunId er påkrevd (FK). */
export type DbProposedCommand = {
  buildingId: string;
  pipelineRunId: string;
  policyId: PolicyId;
  stepAt: Date;
  kind: ProposedCommandKind;
  uProposed: MpcControlVector;
  uReference?: MpcControlVector;
  signals?: Record<string, number | null>;
  status?: MpcSupervisoryStatus;
  stepMinutes?: number;
  executionMode?: MpcExecutionMode;
  commandId?: string;
};

export type ProposedCommand = DbProposedCommand;

export interface CommandSink {
  writeProposed(commands: readonly DbProposedCommand[]): Promise<void>;
}

export function isMpcMqttWritebackEnabled(): boolean {
  return process.env.MPC_MQTT_WRITEBACK?.trim() === "1";
}

export class CompositeCommandSink implements CommandSink {
  constructor(private readonly sinks: readonly CommandSink[]) {}

  async writeProposed(commands: readonly DbProposedCommand[]): Promise<void> {
    for (const sink of this.sinks) {
      await sink.writeProposed(commands);
    }
  }
}

export function buildReplayProposedCommands(input: {
  buildingId: string;
  pipelineRunId: string;
  steps: readonly MpcReplayStep[];
}): DbProposedCommand[] {
  const commands: DbProposedCommand[] = [];
  for (const step of input.steps) {
    const stepAt = new Date(step.t);
    if (step.uBmsMeas) {
      commands.push({
        buildingId: input.buildingId,
        policyId: "observed",
        stepAt,
        kind: "replay_step",
        uProposed: step.uBmsMeas,
        signals: replayStepObservedSignals(step),
        pipelineRunId: input.pipelineRunId,
      });
    }
    if (step.uBmsSim) {
      commands.push({
        buildingId: input.buildingId,
        policyId: "emulated",
        stepAt,
        kind: "replay_step",
        uProposed: step.uBmsSim,
        uReference: step.uBmsMeas ?? undefined,
        signals: replayStepObservedSignals(step),
        pipelineRunId: input.pipelineRunId,
      });
    }
    if (step.uDemand) {
      commands.push({
        buildingId: input.buildingId,
        policyId: "demand-scoped",
        stepAt,
        kind: "replay_step",
        uProposed: step.uDemand,
        uReference: step.uBmsSim,
        signals: replayStepObservedSignals(step),
        pipelineRunId: input.pipelineRunId,
      });
    }
    commands.push({
      buildingId: input.buildingId,
      policyId: "mpc-v1",
      stepAt,
      kind: "replay_step",
      uProposed: step.uMpc,
      uReference: step.uBmsSim,
      signals: replayStepObservedSignals(step),
      pipelineRunId: input.pipelineRunId,
    });
  }
  return commands;
}

export function buildForwardPlanProposedCommands(input: {
  buildingId: string;
  pipelineRunId: string;
  plan: MpcForwardPlan;
}): DbProposedCommand[] {
  return input.plan.planSteps.map((planStep) => ({
    buildingId: input.buildingId,
    policyId: "mpc-v1" as const,
    stepAt: new Date(planStep.t),
    kind: "forward_plan" as const,
    uProposed: planStep.uMpc,
    uReference: planStep.uBmsSim,
    pipelineRunId: input.pipelineRunId,
  }));
}

/** Alle policies for ett live control-tick — matcher replay_step-mønsteret. */
export function buildLiveTickProposedCommands(input: {
  buildingId: string;
  pipelineRunId: string;
  tickAt: Date;
  step: MpcReplayStep;
}): DbProposedCommand[] {
  const commands: DbProposedCommand[] = [];
  const { step } = input;

  if (step.uBmsMeas) {
    commands.push({
      buildingId: input.buildingId,
      policyId: "observed",
      stepAt: input.tickAt,
      kind: "control_tick",
      uProposed: step.uBmsMeas,
      signals: replayStepObservedSignals(step),
      pipelineRunId: input.pipelineRunId,
    });
  }

  commands.push({
    buildingId: input.buildingId,
    policyId: "emulated",
    stepAt: input.tickAt,
    kind: "control_tick",
    uProposed: step.uBmsSim,
    uReference: step.uBmsMeas ?? undefined,
    signals: replayStepObservedSignals(step),
    pipelineRunId: input.pipelineRunId,
  });

  if (step.uDemand) {
    commands.push({
      buildingId: input.buildingId,
      policyId: "demand-scoped",
      stepAt: input.tickAt,
      kind: "control_tick",
      uProposed: step.uDemand,
      uReference: step.uBmsSim,
      signals: replayStepObservedSignals(step),
      pipelineRunId: input.pipelineRunId,
    });
  }

  commands.push({
    buildingId: input.buildingId,
    policyId: "mpc-v1",
    stepAt: input.tickAt,
    kind: "control_tick",
    uProposed: step.uMpc,
    uReference: step.uBmsSim,
    signals: replayStepObservedSignals(step),
    pipelineRunId: input.pipelineRunId,
  });

  return commands;
}

function controlVectorToMqttPayload(u: MpcControlVector): Record<string, number> {
  return {
    supplySetpointC: u.supplySetpointC,
    supplyFanPct: u.supplyFanPct,
    exhaustFanPct: u.exhaustFanPct,
    heatingValvePct: u.heatingValvePct,
    coolingValvePct: u.coolingValvePct,
    districtTr002ValvePct: u.districtTr002ValvePct,
    districtTr003ValvePct: u.districtTr003ValvePct,
  };
}

/**
 * MQTT writeback — dry-run unless MPC_MQTT_PUBLISH=1 and command is approved.
 */
export class MqttCommandSink implements CommandSink {
  async writeProposed(commands: readonly DbProposedCommand[]): Promise<void> {
    if (commands.length === 0) return;

    const publishable = commands.filter(
      (cmd) =>
        cmd.policyId === "mpc-v1" &&
        (cmd.kind === "control_tick" || cmd.kind === "forward_plan") &&
        canPublishStatus(cmd.status ?? "predicted"),
    );

    if (publishable.length === 0) return;

    const prefix = mqttTopicPrefix();
    for (const cmd of publishable) {
      const mqttCmd = cmd as ProposedCommand;
      const topic = `${prefix}/${cmd.kind}`;
      const payload = controlVectorToMqttPayload(cmd.uProposed);

      if (!isMqttPublishEnabled()) {
        console.info("[mqtt-writeback] dry-run", {
          commandId: mqttCmd.commandId,
          topic,
          buildingId: cmd.buildingId,
          stepAt: cmd.stepAt.toISOString(),
          payload,
          armed: isWritebackArmed(),
        });
        continue;
      }

      console.info("[mqtt-writeback] publish", {
        commandId: mqttCmd.commandId,
        topic,
        stepAt: cmd.stepAt.toISOString(),
      });
      // Broker client wired when MPC_MQTT_BROKER_URL is configured in production.
    }
  }
}
