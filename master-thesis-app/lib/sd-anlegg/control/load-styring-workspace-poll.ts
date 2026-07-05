import "server-only";

import { prisma } from "@/lib/db";
import { loadPipelineReplaySteps } from "./persist-mpc-pipeline-replay-steps";
import {
  loadLiveMpcStateRow,
  type LiveMpcStateRow,
} from "./load-live-mpc-state-row";
import {
  buildMpcWorkspaceRevisionFromParts,
  type MpcWorkspaceRevision,
} from "./load-mpc-workspace-revision";
import {
  buildStyringLiveControlPollFromParts,
  type StyringLiveControlPoll,
} from "./load-styring-live-poll";
import {
  loadStyringPipelineReplayPollMeta,
  type StyringPipelineReplayPollMeta,
} from "./load-styring-pipeline-replay-poll-meta";
import { loadMpcSimulationProgress } from "./mpc-simulation-progress";
import { resolveUiMpcPipelineRunId } from "./resolve-ui-pipeline-run";

export type StyringWorkspacePollData = MpcWorkspaceRevision & {
  liveControl: StyringLiveControlPoll;
  pipelineReplayMeta: StyringPipelineReplayPollMeta | null;
};

const REPLAY_TAIL_STEPS = 8;

export async function loadStyringWorkspacePollData(
  buildingId: string,
): Promise<StyringWorkspacePollData> {
  const simulationProgress = await loadMpcSimulationProgress(buildingId);
  const uiPipelineRun = await resolveUiMpcPipelineRunId(
    buildingId,
    simulationProgress,
  );

  const [liveMpcStateRow, latestRun, replayStepsTail, pipelineReplayMeta] =
    await Promise.all([
    loadLiveMpcStateRow(buildingId),
    prisma.sdAnleggMpcPipelineRun.findFirst({
      where: { buildingId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
    uiPipelineRun.runId
      ? loadPipelineReplaySteps({
          pipelineRunId: uiPipelineRun.runId,
          maxSteps: REPLAY_TAIL_STEPS,
        })
      : Promise.resolve([]),
    loadStyringPipelineReplayPollMeta(uiPipelineRun.runId),
  ]);

  const revision = buildMpcWorkspaceRevisionFromParts({
    simulationProgress,
    uiPipelineRun,
    liveMpcStateRow,
    latestRun,
  });

  const liveControl = buildStyringLiveControlPollFromParts({
    liveMpcStateRow,
    replayStepsTail,
  });

  return { ...revision, liveControl, pipelineReplayMeta };
}

export type { LiveMpcStateRow };
