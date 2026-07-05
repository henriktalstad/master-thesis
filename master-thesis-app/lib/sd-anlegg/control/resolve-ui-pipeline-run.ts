import "server-only";

import { prisma } from "@/lib/db";
import type { MpcSimulationProgress } from "./mpc-simulation-progress";
import { parseMpcSimulationCheckpoint } from "./mpc-simulation-checkpoint";
import {
  isPipelineRunPersistentlyComplete,
  loadPipelineRunPersistedStepCount,
} from "./pipeline-run-completeness";
import { resolveCanonicalMpcPipelineRunId } from "./resolve-canonical-pipeline-run";

export type UiPipelineRunResolution = {
  runId: string | null;
  canonicalRunId: string | null;
  incomplete: boolean;
  persistedStepCount: number;
  expectedStepCount: number;
};

async function replayStepCount(
  pipelineRunId: string,
  meta?: {
    persistedStepCount: number | null;
    persistStatus: string | null;
  },
): Promise<number> {
  return loadPipelineRunPersistedStepCount(pipelineRunId, meta);
}

/**
 * Velger hvilken pipeline-run UI skal vise — prioriterer aktiv/feilet sim
 * med flest persisterte steg fremfor eldre canonical run.
 */
export async function resolveUiMpcPipelineRunId(
  buildingId: string,
  simulationProgress: MpcSimulationProgress | null,
  options?: { forceCanonical?: boolean },
): Promise<UiPipelineRunResolution> {
  const canonicalRunId = await resolveCanonicalMpcPipelineRunId(buildingId);

  if (options?.forceCanonical && canonicalRunId) {
    const canonical = await prisma.sdAnleggMpcPipelineRun.findUnique({
      where: { id: canonicalRunId },
      select: {
        id: true,
        stepCount: true,
        persistedStepCount: true,
        persistStatus: true,
      },
    });
    if (canonical) {
      const persisted = await replayStepCount(canonicalRunId, canonical);
      const expectedStepCount = canonical.stepCount;
      const incomplete =
        persisted > 0 &&
        expectedStepCount > 0 &&
        persisted < expectedStepCount;
      return {
        runId: canonicalRunId,
        canonicalRunId,
        incomplete,
        persistedStepCount: persisted,
        expectedStepCount,
      };
    }
  }

  const [latestRun, activeRun] = await Promise.all([
    prisma.sdAnleggMpcPipelineRun.findFirst({
      where: { buildingId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        stepCount: true,
        persistedStepCount: true,
        persistStatus: true,
      },
    }),
    simulationProgress?.activePipelineRunId
      ? prisma.sdAnleggMpcPipelineRun.findUnique({
          where: { id: simulationProgress.activePipelineRunId },
          select: {
            id: true,
            stepCount: true,
            persistedStepCount: true,
            persistStatus: true,
          },
        })
      : Promise.resolve(null),
  ]);

  type RunMeta = {
    stepCount: number;
    persistedStepCount: number | null;
    persistStatus: string | null;
  };

  const candidates = new Map<string, RunMeta>();
  if (activeRun?.id) {
    candidates.set(activeRun.id, {
      stepCount: activeRun.stepCount,
      persistedStepCount: activeRun.persistedStepCount,
      persistStatus: activeRun.persistStatus,
    });
  }
  if (latestRun?.id) {
    candidates.set(latestRun.id, {
      stepCount: latestRun.stepCount,
      persistedStepCount: latestRun.persistedStepCount,
      persistStatus: latestRun.persistStatus,
    });
  }
  if (canonicalRunId && !candidates.has(canonicalRunId)) {
    const canonical = await prisma.sdAnleggMpcPipelineRun.findUnique({
      where: { id: canonicalRunId },
      select: {
        stepCount: true,
        persistedStepCount: true,
        persistStatus: true,
      },
    });
    if (canonical) {
      candidates.set(canonicalRunId, {
        stepCount: canonical.stepCount,
        persistedStepCount: canonical.persistedStepCount,
        persistStatus: canonical.persistStatus,
      });
    }
  }

  let bestRunId: string | null = canonicalRunId;
  let bestPersisted = 0;
  let expectedStepCount = 0;

  let canonicalPersisted = 0;
  if (canonicalRunId) {
    const meta = candidates.get(canonicalRunId);
    canonicalPersisted = await replayStepCount(
      canonicalRunId,
      meta ?? {
        persistedStepCount: null,
        persistStatus: null,
      },
    );
  }

  for (const [runId, meta] of candidates) {
    const persisted = await replayStepCount(runId, meta);
    const complete = isPipelineRunPersistentlyComplete({
      expectedStepCount: meta.stepCount,
      persistedStepCount: persisted,
    });
    const preferActive =
      simulationProgress?.activePipelineRunId === runId &&
      (simulationProgress.status === "running" ||
        simulationProgress.status === "failed") &&
      simulationProgress.stale !== true;
    const activeIncomplete =
      preferActive &&
      !complete &&
      canonicalPersisted > persisted;
    const score =
      persisted +
      (preferActive && !activeIncomplete ? 1_000_000 : 0) +
      (complete ? 10_000 : 0);
    if (score > bestPersisted || (score === bestPersisted && runId === latestRun?.id)) {
      bestRunId = runId;
      bestPersisted = persisted;
      expectedStepCount = meta.stepCount;
    }
  }

  if (
    canonicalRunId &&
    canonicalPersisted > 0 &&
    bestRunId &&
    bestRunId !== canonicalRunId
  ) {
    const bestMeta = candidates.get(bestRunId);
    const bestComplete =
      bestMeta != null &&
      isPipelineRunPersistentlyComplete({
        expectedStepCount: bestMeta.stepCount,
        persistedStepCount: bestPersisted,
      });
    if (!bestComplete && canonicalPersisted > bestPersisted) {
      const canonicalMeta = candidates.get(canonicalRunId);
      if (canonicalMeta) {
        bestRunId = canonicalRunId;
        bestPersisted = canonicalPersisted;
        expectedStepCount = canonicalMeta.stepCount;
      }
    }
  }

  if (!bestRunId) {
    return {
      runId: null,
      canonicalRunId,
      incomplete: false,
      persistedStepCount: 0,
      expectedStepCount: 0,
    };
  }

  const incomplete =
    bestPersisted > 0 &&
    expectedStepCount > 0 &&
    bestPersisted < expectedStepCount;

  return {
    runId: bestRunId,
    canonicalRunId,
    incomplete,
    persistedStepCount: bestPersisted,
    expectedStepCount,
  };
}

/** Vis avbrutt sim i progress selv etter kort «recent job»-vindu. */
export function shouldKeepFailedSimulationVisible(input: {
  status: string;
  checkpoint: unknown;
  stepIndex: number;
  stepTotal: number;
}): boolean {
  if (input.status !== "FAILED") return false;
  const cp = parseMpcSimulationCheckpoint(input.checkpoint);
  if (!cp) return false;
  if (input.stepTotal <= 0) return cp.replayIndex > 0;
  return cp.replayIndex > 0 && cp.replayIndex < input.stepTotal;
}
