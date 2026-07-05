"use server";

import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";
import { isCurrentUserAdmin } from "@/actions/auth";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import { buildControlPlantModel } from "@/lib/sd-anlegg/control/build-control-plant-model";
import { loadMpcReplayStepsTail } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import type { MpcBuildingPreferencesOverrides } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import type { ResolvedMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import { resolveGenericMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import {
  loadMpcBuildingPreferencesOverrides,
  saveMpcBuildingPreferencesOverrides,
} from "@/services/mpc/mpc-building-preferences-store";
import { loadBuildingComfortTargets } from "@/services/mpc/load-building-comfort-band";
import { listInfraspawnPointsForBuilding } from "@/lib/infraspawn/read-points";
import { prisma } from "@/lib/db";

async function assertStyringAccess(buildingSlug: string): Promise<{
  buildingId: string;
  buildingName: string;
}> {
  const [readCtx, isAdmin] = await Promise.all([
    resolveInfraspawnBuildingForRead(buildingSlug),
    isCurrentUserAdmin(),
  ]);
  if (!readCtx.ok && !isAdmin) {
    throw new Error(readCtx.error ?? "Ingen tilgang");
  }
  if (!readCtx.ok) {
    const building = await prisma.building.findFirst({
      where: { slug: buildingSlug },
      select: { id: true, name: true },
    });
    if (!building) throw new Error("Fant ikke bygg");
    return { buildingId: building.id, buildingName: building.name };
  }
  return {
    buildingId: readCtx.building.id,
    buildingName: readCtx.building.name,
  };
}

async function resolvePreferencesForBuilding(
  buildingSlug: string,
  buildingId: string,
  buildingName: string,
  overrides?: MpcBuildingPreferencesOverrides | null,
): Promise<ResolvedMpcBuildingPreferences> {
  const readCtx = await resolveInfraspawnBuildingForRead(buildingSlug);
  const [points, replaySteps, savedOverrides, comfortTargets] = await Promise.all([
    readCtx.ok
      ? listInfraspawnPointsForBuilding(
          readCtx.integration.id,
          readCtx.building.id,
        )
      : Promise.resolve([]),
    loadMpcReplayStepsTail(buildingId, 500),
    overrides === undefined
      ? loadMpcBuildingPreferencesOverrides(buildingSlug, buildingId)
      : Promise.resolve(overrides),
    loadBuildingComfortTargets(buildingId),
  ]);

  const plantModel = buildControlPlantModel({
    buildingId,
    buildingName,
    points,
    dataQuality: {
      energyHourCount: 0,
      weatherHourCount: 0,
      priceHourCount: 0,
      historyDays: 7,
      warnings: [],
    },
  });

  return resolveGenericMpcBuildingPreferences({
    buildingSlug,
    plantModel,
    replaySteps,
    overrides: savedOverrides,
    comfortTargets,
  });
}

export type LoadMpcPreferencesResult = {
  preferences: ResolvedMpcBuildingPreferences;
  hasSavedOverrides: boolean;
};

export async function loadMpcBuildingPreferencesAction(
  buildingSlug: string,
): Promise<LoadMpcPreferencesResult> {
  noStore();
  const access = await assertStyringAccess(buildingSlug);
  const saved = await loadMpcBuildingPreferencesOverrides(buildingSlug);
  const preferences = await resolvePreferencesForBuilding(
    buildingSlug,
    access.buildingId,
    access.buildingName,
    saved,
  );

  return {
    preferences,
    hasSavedOverrides: saved != null,
  };
}

export async function saveMpcBuildingPreferencesAction(input: {
  buildingSlug: string;
  overrides: MpcBuildingPreferencesOverrides;
}): Promise<{ ok: true; updatedAt: string }> {
  noStore();
  const access = await assertStyringAccess(input.buildingSlug);
  const preferences = await resolvePreferencesForBuilding(
    input.buildingSlug,
    access.buildingId,
    access.buildingName,
    input.overrides,
  );

  const saved = await saveMpcBuildingPreferencesOverrides({
    buildingSlug: input.buildingSlug,
    buildingId: access.buildingId,
    unitKey: preferences.unitKey,
    overrides: input.overrides,
  });

  revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);

  return { ok: true, updatedAt: saved.updatedAt };
}

export type SimulateMpcPreferencesResult =
  | {
      ok: true;
      queued: true;
      jobId: string;
      alreadyRunning: boolean;
      message: string;
    }
  | {
      ok: true;
      queued: false;
      deltaCostPct: number;
      deltaCostKr: number;
      comfortViolationsMpc: number;
      meaningfulDeltaPct: number;
      fallbackPct: number;
    }
  | { ok: false; message: string };

export async function simulateMpcWithPreferencesAction(input: {
  buildingSlug: string;
  overrides: MpcBuildingPreferencesOverrides;
}): Promise<SimulateMpcPreferencesResult> {
  noStore();
  const access = await assertStyringAccess(input.buildingSlug);

  const preferences = await resolvePreferencesForBuilding(
    input.buildingSlug,
    access.buildingId,
    access.buildingName,
    input.overrides,
  );

  const { enqueueAndScheduleMpcSimulationJob } = await import(
    "@/services/mpc/run-mpc-simulation-job"
  );
  const { loadEvalDatasetForMpc } = await import(
    "@/services/mpc/load-eval-dataset"
  );

  const dataset = await loadEvalDatasetForMpc({
    buildingSlug: input.buildingSlug,
  });
  if (!dataset || dataset.steps.length < 96) {
    return {
      ok: false,
      message: "Utilstrekkelig eval-datasett for simulering",
    };
  }

  const queued = await enqueueAndScheduleMpcSimulationJob({
    buildingId: access.buildingId,
    buildingSlug: input.buildingSlug,
    stepTotal: dataset.steps.length,
    buildingPreferences: preferences,
    solverProfile: "interactive",
    message: "Simulerer preferanser…",
  });

  if (!queued.ok) {
    return { ok: false, message: queued.reason };
  }

  revalidatePath(`/sd-anlegg/${input.buildingSlug}/styring`);

  return {
    ok: true,
    queued: true,
    jobId: queued.jobId,
    alreadyRunning: queued.alreadyRunning,
    message: queued.alreadyRunning
      ? "Simulering pågår allerede"
      : "Simulering startet — resultater lagres til analyse når ferdig",
  };
}
