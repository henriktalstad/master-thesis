import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { getDefaultBuildingSlug } from "@/lib/config/env";
import { buildMpcForwardPlanForBuilding } from "@/lib/sd-anlegg/control/build-mpc-forward-plan-for-building";
import { loadLatestMpcPipelineRun } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { persistMpcForwardPlan } from "@/lib/sd-anlegg/control/persist-mpc-forward-plan";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import { analyzeMpcEvalCoverage } from "./analyze-eval-coverage";
import { assessFromCoverageReport } from "./assess-mpc-simulation-readiness";
import {
  ensureThesisMpcData,
  type EnsureThesisMpcDataResult,
} from "./ensure-thesis-mpc-data";

export type RunMpcWhenReadyMode = "backfill" | "replay";

export type RunMpcWhenReadyOptions = {
  buildingSlug?: string;
  forceRefresh?: boolean;
  forceRun?: boolean;
  mode?: RunMpcWhenReadyMode;
};

export type RunMpcWhenReadyResult = EnsureThesisMpcDataResult & {
  skipped?: boolean;
  forwardPlanPersisted?: boolean;
};

export { ensureThesisMpcData as ensureMpcDataForBuilding };

const BACKFILL_ENSURE = {
  runSimulation: false,
  skipFullSourceSync: true,
  maxSyncIterations: 2,
  allowDirectInflux: true,
  directInfluxMaxPages: 80,
} as const;

const REPLAY_ENSURE = {
  allowDirectInflux: true,
  directInfluxMaxPages: 32,
  maxSyncIterations: 4,
} as const;

import { isMpcAutoRunEnabled } from "@/lib/config/mpc-automation";

async function persistForwardPlanIfPossible(input: {
  buildingId: string;
  buildingSlug: string;
}): Promise<boolean> {
  const run = await loadLatestMpcPipelineRun(input.buildingId);
  if (!run?.calibration) return false;

  const forwardPlan = await buildMpcForwardPlanForBuilding({
    buildingId: input.buildingId,
    calibration: run.calibration,
    replaySteps: run.replaySteps.slice(-96),
  });
  if (!forwardPlan) return false;

  await persistMpcForwardPlan({
    buildingId: input.buildingId,
    forwardPlan,
    mpcRunId: run.id,
  });
  return true;
}

async function revalidateStyring(buildingSlug: string): Promise<void> {
  revalidatePath(`/sd-anlegg/${buildingSlug}/styring`);
  revalidateTag(`mpc-coverage:${buildingSlug}`, { expire: 0 });
}

/**
 * Ensures eval-dataset (`backfill`) or full replay (`replay`).
 * All cron/UI entry points should go through here.
 */
export async function runMpcWhenReady(
  options: RunMpcWhenReadyOptions = {},
): Promise<RunMpcWhenReadyResult> {
  const mode = options.mode ?? "replay";
  const buildingSlug = options.buildingSlug ?? getDefaultBuildingSlug();

  const shouldRun =
    options.forceRefresh === true ||
    options.forceRun === true ||
    isMpcAutoRunEnabled();

  if (!shouldRun) {
    const coverageBefore = await analyzeMpcEvalCoverage({ buildingSlug });
    const readiness = coverageBefore
      ? assessFromCoverageReport(coverageBefore)
      : null;
    return {
      ok: readiness?.canSimulate ?? false,
      actions: [],
      coverageBefore,
      coverageAfter: coverageBefore,
      message:
        "MPC auto-run er av (MPC_AUTO_RUN=0) — fjern flagget for automatisk replay etter sync",
      skipped: true,
    };
  }

  const coverageBefore = await analyzeMpcEvalCoverage({ buildingSlug });
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);

  if (mode === "backfill") {
    const ensureResult = await ensureThesisMpcData({
      buildingSlug,
      forceDataRefresh: options.forceRefresh ?? coverageBefore?.needsBackfill ?? false,
      ...BACKFILL_ENSURE,
    });
    if (access.ok && ensureResult.ok) {
      await revalidateStyring(buildingSlug);
    }
    return { ...ensureResult, forwardPlanPersisted: false };
  }

  const readiness = coverageBefore
    ? assessFromCoverageReport(coverageBefore)
    : null;
  const existingRun = access.ok
    ? await loadLatestMpcPipelineRun(access.building.id)
    : null;

  const needsSim =
    options.forceRefresh === true ||
    options.forceRun === true ||
    !existingRun?.snapshot ||
    (readiness?.canSimulate && coverageBefore?.needsBackfill);

  const ensureResult = await ensureThesisMpcData({
    buildingSlug,
    forceDataRefresh: options.forceRefresh ?? coverageBefore?.needsBackfill ?? false,
    runSimulation: needsSim && (readiness?.canSimulate ?? false),
    asyncSimulation: true,
    ...REPLAY_ENSURE,
  });

  let forwardPlanPersisted = false;
  if (access.ok && ensureResult.ok) {
    try {
      forwardPlanPersisted = await persistForwardPlanIfPossible({
        buildingId: access.building.id,
        buildingSlug,
      });
    } catch (error) {
      console.warn("[runMpcWhenReady] forward plan feilet:", error);
    }
    await revalidateStyring(buildingSlug);
  }

  return {
    ...ensureResult,
    forwardPlanPersisted,
  };
}
