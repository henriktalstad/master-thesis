#!/usr/bin/env bun
/**
 * Merker utdaterte eller feilkoblede pipeline-runs (f.eks. 1249-stegs juni-run).
 *
 * Usage:
 *   bun run reconcile-pipeline-runs
 *   bun run reconcile-pipeline-runs -- --apply
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { prisma } from "@/lib/db";
import { MpcReplayQuality } from "@/generated/client";
import { isReplayFanSignalPlausible } from "@/lib/sd-anlegg/control/assess-replay-quality";

const apply = process.argv.includes("--apply");

async function main() {
  const buildingSlug = resolveBuildingSlug();
  const building = await prisma.building.findFirst({
    where: buildingSlug ? { slug: buildingSlug } : undefined,
    select: { id: true, slug: true },
  });
  if (!building) {
    console.error("[reconcile] Fant ikke bygg.");
    process.exit(1);
  }

  const runs = await prisma.sdAnleggMpcPipelineRun.findMany({
    where: { buildingId: building.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stepCount: true,
      replayQuality: true,
      deltaCostVsEmulatedPct: true,
      deltaCostPct: true,
      evalStart: true,
      evalEnd: true,
      createdAt: true,
    },
  });

  const actions: Array<{ id: string; reason: string; quality: MpcReplayQuality }> = [];

  for (const run of runs) {
    if (run.replayQuality === MpcReplayQuality.VALID) continue;

    if (run.stepCount > 900) {
      actions.push({
        id: run.id,
        reason: `stepCount=${run.stepCount} (>900, utenfor thesis-eval)`,
        quality: MpcReplayQuality.INSUFFICIENT_DATA,
      });
      continue;
    }

    if (run.deltaCostVsEmulatedPct == null && run.stepCount > 400) {
      actions.push({
        id: run.id,
        reason: "mangler deltaCostVsEmulatedPct på lang run",
        quality: MpcReplayQuality.INSUFFICIENT_DATA,
      });
    }

    const fanRows = await prisma.sdAnleggMpcPipelineReplayStep.findMany({
      where: { pipelineRunId: run.id },
      select: {
        controlTracks: {
          where: { track: "OBSERVED" },
          select: { supplyFanPct: true },
          take: 1,
        },
      },
      take: 120,
      orderBy: { stepAt: "asc" },
    });
    const samples = fanRows
      .map((r) => r.controlTracks[0]?.supplyFanPct)
      .filter((v): v is number => typeof v === "number");
    if (samples.length > 0 && !isReplayFanSignalPlausible(samples)) {
      actions.push({
        id: run.id,
        reason: "implausible fan signal",
        quality: MpcReplayQuality.INVALID_FAN,
      });
    }
  }

  if (actions.length === 0) {
    console.info("[reconcile] Ingen runs trenger oppdatering.");
    return;
  }

  console.info(`[reconcile] ${actions.length} run(s) foreslått merket:`);
  for (const action of actions) {
    console.info(`  ${action.id} → ${action.quality} (${action.reason})`);
  }

  if (!apply) {
    console.info("\n[reconcile] Kjør med --apply for å persistere.");
    return;
  }

  for (const action of actions) {
    await prisma.sdAnleggMpcPipelineRun.update({
      where: { id: action.id },
      data: { replayQuality: action.quality },
    });
  }
  console.info("[reconcile] Oppdatert.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
