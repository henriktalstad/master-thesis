#!/usr/bin/env bun
/**
 * Diagnose MPC fallback-steg — lister tidsstempler, årsak og rå BACnet-verdier.
 *
 * Usage:
 *   bun run scripts/diagnose-mpc-fallback.ts
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { prisma } from "@/lib/db";
import { loadLatestMpcPipelineRunForExport } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";
import { listMpcPointMeta } from "@/services/mpc/mpc-point-meta";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import { resolvePointForCatalogEntry } from "@/lib/sd-anlegg/control/resolve-control-signals";

async function main() {
  const buildingSlug = resolveBuildingSlug();
  const ctx = await resolveMpcBuildingSource({ buildingSlug });
  if (!ctx) {
    console.error("[diagnose-mpc-fallback] BUILDING_SLUG/BUILDING_ID mangler");
    process.exit(1);
  }

  const run = await loadLatestMpcPipelineRunForExport(ctx.buildingId);
  if (!run) {
    console.error("[diagnose-mpc-fallback] ingen mpc-v1 kjøring i DB");
    process.exit(1);
  }

  const steps = run.replaySteps as MpcReplayStep[];
  const fallback = steps.filter((step) => step.usedFallback);

  console.log(
    `[diagnose-mpc-fallback] ${fallback.length}/${steps.length} fallback-steg`,
  );
  console.log("[diagnose-mpc-fallback] replaySummary:", run.snapshot.replaySummary);

  const byReason = new Map<string, MpcReplayStep[]>();
  for (const step of fallback) {
    const reason = step.fallbackReason ?? "unknown";
    const bucket = byReason.get(reason) ?? [];
    bucket.push(step);
    byReason.set(reason, bucket);
  }

  for (const [reason, group] of byReason) {
    console.log(`\n=== ${reason} (${group.length}) ===`);
    for (const step of group.slice(0, 20)) {
      const u = step.uBmsMeas;
      console.log(
        [
          step.t,
          u
            ? `SP=${u.supplySetpointC} SAF=${u.supplyFanPct} heat=${u.heatingValvePct} cool=${u.coolingValvePct}`
            : "uMeas=null",
          step.outdoorTempC != null ? `Tout=${step.outdoorTempC}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );
    }
    if (group.length > 20) {
      console.log(`… +${group.length - 20} flere`);
    }
  }

  const hcSteps = byReason.get("simultaneous_heat_cool") ?? [];
  if (hcSteps.length > 0) {
    console.log(
      "\n[diagnose-mpc-fallback] HC-steg: sjekk mettet kjøle-pådrag (AO_5≥99 %) vs feedback (310.001SB501_C).",
    );
    const points = await listMpcPointMeta(ctx.sourceId);
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "cooling.valve.command",
    );
    const coolingPoint = entry
      ? resolvePointForCatalogEntry(points, entry)
      : null;
    if (coolingPoint) {
      const sample = await prisma.infraspawnBacnetSample.findFirst({
        where: {
          sourceId: ctx.sourceId,
          objectId: coolingPoint.objectId,
          sampledAt: new Date(hcSteps[0]!.t),
        },
        select: { valueNum: true, sampledAt: true },
      });
      console.log(
        "[diagnose-mpc-fallback] eksempel rå kjøleventil:",
        sample?.valueNum,
        "@",
        sample?.sampledAt.toISOString(),
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
