import "server-only";

import { loadPipelineReplaySteps } from "./persist-mpc-pipeline-replay-steps";
import {
  loadLiveMpcStateRow,
  type LiveMpcStateRow,
} from "./load-live-mpc-state-row";
import { resolveCanonicalMpcPipelineRunId } from "./resolve-canonical-pipeline-run";
import type { MpcForwardPlan, LiveForwardPlans } from "./control-types";
import type { MpcForwardPlanStep } from "./control-types-live";
import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export type StyringLiveControlPoll = {
  /** Endrer seg når tick, forward plan eller replay-hale oppdateres. */
  revision: string;
  forwardPlanStep0: MpcForwardPlanStep | null;
  activeCommand: MpcControlVector | null;
  replayStepsTail: MpcReplayStep[];
  lastControlTickAt: string | null;
  forwardPlanComputedAt: string | null;
};

const REPLAY_TAIL_STEPS = 8;

function resolveForwardPlanFromRow(row: {
  forwardPlans: unknown;
  forwardPlan: unknown;
}): MpcForwardPlan | null {
  if (row.forwardPlans) {
    const plans = row.forwardPlans as LiveForwardPlans;
    return plans["mpc-v1"] ?? null;
  }
  if (row.forwardPlan) {
    return row.forwardPlan as MpcForwardPlan;
  }
  return null;
}

export function buildStyringLiveControlPollFromParts(input: {
  liveMpcStateRow: LiveMpcStateRow | null;
  replayStepsTail: readonly MpcReplayStep[];
}): StyringLiveControlPoll {
  const forwardPlan = input.liveMpcStateRow
    ? resolveForwardPlanFromRow(input.liveMpcStateRow)
    : null;
  const forwardPlanStep0 = forwardPlan?.planSteps[0] ?? null;
  const lastControlTickAt =
    input.liveMpcStateRow?.lastControlTickAt?.toISOString() ?? null;
  const forwardPlanComputedAt = forwardPlan?.computedAt ?? null;
  const latestReplayAt = input.replayStepsTail.at(-1)?.t ?? null;

  const revision = [
    lastControlTickAt ?? "no-tick",
    forwardPlanComputedAt ?? "no-plan",
    latestReplayAt ?? "no-replay",
  ].join("|");

  return {
    revision,
    forwardPlanStep0,
    activeCommand:
      (input.liveMpcStateRow?.activeCommand as MpcControlVector | null) ?? null,
    replayStepsTail: [...input.replayStepsTail],
    lastControlTickAt,
    forwardPlanComputedAt,
  };
}

export async function loadStyringLiveControlPoll(
  buildingId: string,
): Promise<StyringLiveControlPoll> {
  const [liveMpcStateRow, pipelineRunId] = await Promise.all([
    loadLiveMpcStateRow(buildingId),
    resolveCanonicalMpcPipelineRunId(buildingId),
  ]);

  const replayStepsTail =
    pipelineRunId != null
      ? await loadPipelineReplaySteps({
          pipelineRunId,
          maxSteps: REPLAY_TAIL_STEPS,
        })
      : [];

  return buildStyringLiveControlPollFromParts({
    liveMpcStateRow,
    replayStepsTail,
  });
}
