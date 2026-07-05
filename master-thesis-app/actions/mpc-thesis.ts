"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";
import { isCurrentUserAdmin } from "@/actions/auth";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import {
  ensureThesisMpcData,
  type EnsureThesisMpcDataResult,
} from "@/services/mpc/ensure-thesis-mpc-data";
import { recoverStaleMpcSimulationJob, dismissMpcSimulationJobNotice } from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import { resolveCanonicalMpcPipelineRunId } from "@/lib/sd-anlegg/control/resolve-canonical-pipeline-run";
import { loadPipelineReplaySteps } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-replay-steps";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { runControlTick } from "@/services/mpc/run-control-tick";
import {
  loadStyringWorkspacePollData,
  type StyringWorkspacePollData,
} from "@/lib/sd-anlegg/control/load-styring-workspace-poll";
import {
  loadStyringAnalysisPayload,
  type StyringAnalysisPayload,
} from "@/lib/sd-anlegg/control/load-styring-analysis-payload";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";

export type EnsureMpcThesisDataActionInput = {
  buildingSlug: string;
  runSimulation?: boolean;
  forceDataRefresh?: boolean;
  /** Avbryt hengende jobb og start ny replay (typisk «Oppdater replay»). */
  forceSimulationRestart?: boolean;
};

export type EnsureMpcThesisDataActionResult = EnsureThesisMpcDataResult;

async function assertStyringAccess(buildingSlug: string): Promise<void> {
  const [readCtx, isAdmin] = await Promise.all([
    resolveInfraspawnBuildingForRead(buildingSlug),
    isCurrentUserAdmin(),
  ]);
  if (!readCtx.ok && !isAdmin) {
    throw new Error(readCtx.error ?? "Ingen tilgang");
  }
}

export async function ensureMpcThesisDataAction(
  input: EnsureMpcThesisDataActionInput,
): Promise<EnsureMpcThesisDataActionResult> {
  noStore();
  await assertStyringAccess(input.buildingSlug);

  const result = await ensureThesisMpcData({
    buildingSlug: input.buildingSlug,
    runSimulation: input.runSimulation ?? false,
    forceDataRefresh: input.forceDataRefresh ?? false,
    forceSimulationRestart: input.forceSimulationRestart ?? false,
    maxSyncIterations: input.runSimulation ? 6 : 4,
    allowDirectInflux: true,
    directInfluxMaxPages: 32,
  });

  revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);
  revalidateTag(`mpc-coverage:${input.buildingSlug}`, { expire: 0 });

  return result;
}

export async function loadMpcReplayTraceAction(input: {
  buildingSlug: string;
  pipelineRunId?: string;
  maxSteps?: number;
}): Promise<MpcReplayStep[]> {
  noStore();
  await assertStyringAccess(input.buildingSlug);
  const readCtx = await resolveInfraspawnBuildingForRead(input.buildingSlug);
  if (!readCtx.ok) return [];

  const runId =
    input.pipelineRunId ??
    (await resolveCanonicalMpcPipelineRunId(readCtx.building.id));
  if (!runId) return [];

  return loadPipelineReplaySteps({
    pipelineRunId: runId,
    maxSteps: input.maxSteps,
  });
}

export async function getStyringWorkspacePollAction(
  buildingSlug: string,
): Promise<StyringWorkspacePollData> {
  noStore();
  await assertStyringAccess(buildingSlug);
  const readCtx = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!readCtx.ok) {
    return {
      contentRevision: "no-access",
      revision: "no-access",
      canonicalRunId: null,
      latestRunId: null,
      latestRunCreatedAt: null,
      lastControlTickAt: null,
      replayWatermarkAt: null,
      simulationProgress: null,
      liveControl: {
        revision: "no-access",
        forwardPlanStep0: null,
        activeCommand: null,
        replayStepsTail: [],
        lastControlTickAt: null,
        forwardPlanComputedAt: null,
      },
      pipelineReplayMeta: null,
    };
  }
  return loadStyringWorkspacePollData(readCtx.building.id);
}

export async function getStyringAnalysisPayloadAction(input: {
  buildingSlug: string;
  view: StyringAnalysisViewId;
}): Promise<StyringAnalysisPayload | null> {
  noStore();
  await assertStyringAccess(input.buildingSlug);
  return loadStyringAnalysisPayload(input.buildingSlug, input.view);
}

export async function recoverMpcSimulationJobAction(
  buildingSlug: string,
): Promise<{ recovered: boolean; reason: string | null }> {
  noStore();
  await assertStyringAccess(buildingSlug);
  const readCtx = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!readCtx.ok) {
    return { recovered: false, reason: readCtx.error ?? "Ingen tilgang" };
  }

  const result = await recoverStaleMpcSimulationJob(readCtx.building.id);
  await dismissMpcSimulationJobNotice(readCtx.building.id);
  revalidatePath(`/sd-anlegg/${buildingSlug}/styring`);
  revalidateTag(`mpc-coverage:${buildingSlug}`, { expire: 0 });
  return {
    recovered: result.recovered,
    reason: result.reason ?? "Varsel skjult",
  };
}

export async function runControlTickAction(input: {
  buildingSlug: string;
  force?: boolean;
  /** Unngå full RSC-refresh når klienten invaliderer live-poll selv. */
  skipPageRevalidate?: boolean;
}): Promise<Awaited<ReturnType<typeof runControlTick>>> {
  noStore();
  await assertStyringAccess(input.buildingSlug);

  const result = await runControlTick({
    buildingSlug: input.buildingSlug,
    triggerSource: "manual",
    force: input.force ?? true,
  });

  if (result.ok && !result.skipped && input.skipPageRevalidate !== true) {
    revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);
    revalidateTag(`mpc-coverage:${input.buildingSlug}`, { expire: 0 });
  }

  return result;
}
