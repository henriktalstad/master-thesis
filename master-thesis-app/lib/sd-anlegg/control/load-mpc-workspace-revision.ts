import "server-only";

import { prisma } from "@/lib/db";
import type { LiveMpcStateRow } from "./load-live-mpc-state-row";
import {
  loadMpcSimulationProgress,
  type MpcSimulationProgress,
} from "./mpc-simulation-progress";
import { buildMpcWorkspaceContentRevision } from "./mpc-workspace-revision-utils";
import {
  resolveUiMpcPipelineRunId,
  type UiPipelineRunResolution,
} from "./resolve-ui-pipeline-run";

export type MpcWorkspaceRevision = {
  contentRevision: string;
  revision: string;
  canonicalRunId: string | null;
  latestRunId: string | null;
  latestRunCreatedAt: string | null;
  lastControlTickAt: string | null;
  replayWatermarkAt: string | null;
  simulationProgress: MpcSimulationProgress | null;
};

export function buildMpcWorkspaceRevisionFromParts(input: {
  simulationProgress: MpcSimulationProgress | null;
  uiPipelineRun: UiPipelineRunResolution;
  liveMpcStateRow: LiveMpcStateRow | null;
  latestRun: { id: string; createdAt: Date } | null;
}): MpcWorkspaceRevision {
  const canonicalRunId = input.uiPipelineRun.canonicalRunId;
  const latestRunCreatedAt = input.latestRun?.createdAt.toISOString() ?? null;
  const lastControlTickAt =
    input.liveMpcStateRow?.lastControlTickAt?.toISOString() ?? null;
  const replayWatermarkAt =
    input.liveMpcStateRow?.replayWatermarkAt?.toISOString() ?? null;

  const simulationStatus = input.simulationProgress?.status ?? "idle";
  const simulationTerminalAt =
    simulationStatus === "completed" || simulationStatus === "failed"
      ? (input.simulationProgress?.updatedAt ?? null)
      : null;

  const contentRevision = buildMpcWorkspaceContentRevision({
    canonicalRunId,
    latestRunId: input.latestRun?.id ?? null,
    displayRunId: input.uiPipelineRun.runId,
    lastControlTickAt,
    replayWatermarkAt,
    simulationStatus,
    simulationTerminalAt,
    simulationStepIndex:
      input.simulationProgress?.status === "running"
        ? input.simulationProgress.stepIndex
        : null,
  });

  return {
    contentRevision,
    revision: contentRevision,
    canonicalRunId,
    latestRunId: input.latestRun?.id ?? null,
    latestRunCreatedAt,
    lastControlTickAt,
    replayWatermarkAt,
    simulationProgress: input.simulationProgress,
  };
}

export async function loadMpcWorkspaceRevision(
  buildingId: string,
  options?: {
    simulationProgress?: MpcSimulationProgress | null;
    uiPipelineRun?: UiPipelineRunResolution;
    liveMpcStateRow?: LiveMpcStateRow | null;
  },
): Promise<MpcWorkspaceRevision> {
  const simulationProgress =
    options?.simulationProgress !== undefined
      ? options.simulationProgress
      : await loadMpcSimulationProgress(buildingId);

  const uiPipelineRun =
    options?.uiPipelineRun ??
    (await resolveUiMpcPipelineRunId(buildingId, simulationProgress));

  const liveMpcStateRowPromise =
    options?.liveMpcStateRow !== undefined
      ? Promise.resolve(options.liveMpcStateRow)
      : prisma.sdAnleggLiveMpcState.findUnique({
          where: { buildingId },
          select: {
            lastControlTickAt: true,
            replayWatermarkAt: true,
            lastPlanDiff: true,
            activeCommand: true,
            forwardPlan: true,
            forwardPlans: true,
          },
        });

  const [liveMpcStateRow, latestRun] = await Promise.all([
    liveMpcStateRowPromise,
    prisma.sdAnleggMpcPipelineRun.findFirst({
      where: { buildingId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
  ]);

  return buildMpcWorkspaceRevisionFromParts({
    simulationProgress,
    uiPipelineRun,
    liveMpcStateRow,
    latestRun,
  });
}
