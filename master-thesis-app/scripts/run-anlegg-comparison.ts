#!/usr/bin/env bun
/**
 * Bygger utvidet anleggstyring-sammenligning fra siste pipeline-run eller eksisterende export.
 *
 * Usage:
 *   bun run anlegg-comparison
 *   bun run anlegg-comparison -- --run-id=cmr...
 */

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { prisma } from "@/lib/db";
import { buildAnleggControlComparison } from "@/lib/sd-anlegg/control/build-anlegg-control-comparison";
import { normalizeReplaySummary } from "@/lib/sd-anlegg/control/build-control-strategy-comparison";
import { buildPriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import {
  loadLatestMpcPipelineRunForExport,
  loadMpcPipelineRunByIdForExport,
} from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { resolveCanonicalMpcPipelineRunId } from "@/lib/sd-anlegg/control/resolve-canonical-pipeline-run";
import { buildPolicySummaries } from "@/lib/sd-anlegg/mpc/pipeline/build-policy-summaries";
import { inferTuningPresetFromSolver } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import { resolveThesisProcessedDir } from "@/lib/thesis-export/export-thesis-artifacts";
import {
  buildAnleggControlComparisonJson,
  buildPolicyComparisonSummaryJson,
} from "@/lib/thesis-export/write-mpc-artifacts";

function parseRunId(): string | null {
  const idx = process.argv.indexOf("--run-id");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  const arg = process.argv.find((a) => a.startsWith("--run-id="));
  return arg?.slice("--run-id=".length).trim() || null;
}

async function resolveBuildingId(): Promise<string | null> {
  const buildingId = process.env.BUILDING_ID?.trim();
  const buildingSlug = resolveBuildingSlug();
  const building = await prisma.building.findFirst({
    where: buildingId ? { id: buildingId } : buildingSlug ? { slug: buildingSlug } : undefined,
    select: { id: true },
  });
  return building?.id ?? null;
}

async function main() {
  const explicitRunId = parseRunId();
  const buildingId = await resolveBuildingId();
  if (!buildingId && !explicitRunId) {
    console.error("[anlegg-comparison] Mangler bygg eller --run-id.");
    process.exit(1);
  }

  const runId =
    explicitRunId ?? (buildingId ? await resolveCanonicalMpcPipelineRunId(buildingId) : null);
  const run = runId
    ? await loadMpcPipelineRunByIdForExport(runId)
    : buildingId
      ? await loadLatestMpcPipelineRunForExport(buildingId)
      : null;

  if (!run) {
    console.error("[anlegg-comparison] Fant ingen pipeline-run.");
    process.exit(1);
  }

  const { snapshot, replaySteps, calibration } = run;
  const energyReconcile = run.energyReconcileSummary ?? null;
  const priceLoadShift = buildPriceLoadShiftAnalysis(replaySteps);
  const replaySummary = normalizeReplaySummary(snapshot.replaySummary);
  const policySummaries =
    snapshot.replaySummary.policySummaries ?? buildPolicySummaries(replaySummary);
  const tuningPreset = calibration?.solver
    ? inferTuningPresetFromSolver(calibration.solver)
    : null;
  const buildingSlug = resolveBuildingSlug() ?? "sorgenfriveien-32ab";

  const comparison = buildAnleggControlComparison({
    evalStart: snapshot.evalStart,
    evalEnd: snapshot.evalEnd,
    buildingSlug,
    replaySummary,
    policySummaries,
    tuningPresetId: tuningPreset?.id ?? null,
    energyReconcile,
    highPriceShiftPct: priceLoadShift?.highPriceCostDeltaPct ?? null,
  });

  if (!comparison) {
    console.error("[anlegg-comparison] Kunne ikke bygge sammenligning (ukjent bygg).");
    process.exit(1);
  }

  const outDir = resolveThesisProcessedDir();
  await mkdir(outDir, { recursive: true });

  await writeFile(
    path.join(outDir, "policy_comparison_summary.json"),
    buildPolicyComparisonSummaryJson({
      evalStart: snapshot.evalStart,
      evalEnd: snapshot.evalEnd,
      policyComparison: policySummaries,
      tuningPresetId: tuningPreset?.id ?? null,
      buildingSlug,
    }),
    "utf8",
  );
  await writeFile(
    path.join(outDir, "anlegg_control_comparison.json"),
    buildAnleggControlComparisonJson(comparison),
    "utf8",
  );

  console.info("[anlegg-comparison] Run:", run.id);
  console.info("[anlegg-comparison] Preset:", comparison.tuningPresetLabel ?? "ukjent");
  console.info("[anlegg-comparison] MPC vs emulert:", `${comparison.mpcVsEmulatedDeltaPct} %`);
  console.info("[anlegg-comparison] Aktuatorer i scope:", comparison.plantScope.actuatorCount);
  console.info("[anlegg-comparison] Skrev policy_comparison_summary.json");
  console.info("[anlegg-comparison] Skrev anlegg_control_comparison.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
