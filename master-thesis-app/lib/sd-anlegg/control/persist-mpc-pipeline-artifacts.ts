import "server-only";

import { buildReplayProposedCommands } from "@/lib/sd-anlegg/control/command-sink";
import { replaceReplayCommandsForPipelineRun } from "@/lib/sd-anlegg/control/db-command-sink";
import { ensurePrismaConnection } from "@/lib/db";
import type { MpcPipelineResult } from "@/lib/sd-anlegg/mpc/shared/types";
import { persistIncrementalMpcReplaySteps } from "./persist-incremental-mpc-replay-steps";
import { persistMpcEnergyReconcile } from "./persist-mpc-energy-reconcile";
import {
  markPipelinePersistFailed,
  updatePipelinePersistProgress,
} from "./persist-mpc-pipeline-progress";
import { replacePipelineReplaySteps } from "./persist-mpc-pipeline-replay-steps";
import { persistRelationalPipelineArtifacts } from "./persist-mpc-pipeline-relational-artifacts";

export type PipelineArtifactIssue = {
  step: string;
  critical: boolean;
  message: string;
};

export type PersistPipelineArtifactsResult = {
  issues: PipelineArtifactIssue[];
  supervisoryCommandCount: number;
};

function issueMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runArtifactStep(
  step: string,
  critical: boolean,
  fn: () => Promise<void>,
  issues: PipelineArtifactIssue[],
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const entry: PipelineArtifactIssue = {
      step,
      critical,
      message: issueMessage(error),
    };
    issues.push(entry);
    if (critical) {
      throw new Error(`${step}: ${entry.message}`);
    }
  }
}

export async function persistDerivedPipelineArtifacts(input: {
  pipelineRunId: string;
  buildingId: string;
  result: MpcPipelineResult;
  inputFingerprint: string;
  skipReplayReplace?: boolean;
  executionMode?: import("@/generated/client").MpcExecutionMode;
}): Promise<PersistPipelineArtifactsResult> {
  const { pipelineRunId, buildingId, result, inputFingerprint, skipReplayReplace } =
    input;
  const issues: PipelineArtifactIssue[] = [];
  let persistedStepCount = skipReplayReplace
    ? result.replay.steps.length
    : 0;

  await ensurePrismaConnection();

  await updatePipelinePersistProgress({
    pipelineRunId,
    persistStatus: "PENDING",
    persistedStepCount: 0,
    persistError: null,
  });

  try {
    await runArtifactStep(
      "inkrementell replay",
      false,
      () =>
        persistIncrementalMpcReplaySteps({
          buildingId,
          result,
          calibrationFingerprint: inputFingerprint,
        }).then(() => undefined),
      issues,
    );

    if (!skipReplayReplace) {
      await updatePipelinePersistProgress({
        pipelineRunId,
        persistStatus: "REPLAY_STEPS",
        persistedStepCount: 0,
        persistError: null,
      });

      const { stepsWritten } = await replacePipelineReplaySteps({
        pipelineRunId,
        buildingId,
        steps: result.replay.steps,
      });
      persistedStepCount = stepsWritten;

      await updatePipelinePersistProgress({
        pipelineRunId,
        persistStatus: "REPLAY_STEPS",
        persistedStepCount: stepsWritten,
      });
    }

    const proposedCommands = buildReplayProposedCommands({
      buildingId,
      pipelineRunId,
      steps: result.replay.steps,
    });

    await updatePipelinePersistProgress({
      pipelineRunId,
      persistStatus: "ARTIFACTS",
    });

    await runArtifactStep(
      "supervisory commands",
      true,
      () =>
        replaceReplayCommandsForPipelineRun({
          buildingId,
          pipelineRunId,
          commands: proposedCommands,
          executionMode: input.executionMode ?? "SHADOW",
        }),
      issues,
    );

    await runArtifactStep(
      "energy reconcile",
      false,
      () =>
        persistMpcEnergyReconcile({
          pipelineRunId,
          buildingId,
          result,
        }).then(() => undefined),
      issues,
    );

    await runArtifactStep(
      "relational artifacts",
      false,
      () =>
        persistRelationalPipelineArtifacts({
          pipelineRunId,
          result,
          steps: result.replay.steps,
        }).then(() => undefined),
      issues,
    );

    await updatePipelinePersistProgress({
      pipelineRunId,
      persistStatus: "COMPLETE",
      persistedStepCount: result.replay.steps.length,
      persistError: null,
    });

    return { issues, supervisoryCommandCount: proposedCommands.length };
  } catch (error) {
    await markPipelinePersistFailed({
      pipelineRunId,
      error,
      persistedStepCount,
    });
    throw error;
  }
}
