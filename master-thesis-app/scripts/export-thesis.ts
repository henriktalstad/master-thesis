#!/usr/bin/env bun
/**
 * Eksporter thesis-artefakter fra persistert mpc-v1 replay (DB) til data/processed/.
 *
 * Usage:
 *   bun run export-thesis
 *   bun run export-thesis -- --run-id=<cuid>
 *   THESIS_STRICT=1 bun run export-thesis
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";

import { prisma } from "@/lib/db";
import { loadMpcPipelineRunByIdForExport } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { resolveCanonicalMpcPipelineRunId } from "@/lib/sd-anlegg/control/resolve-canonical-pipeline-run";
import { readMetricsSummarySnapshot } from "@/lib/thesis-export/assert-thesis-report-alignment";
import { orchestrateThesisPipelineExport } from "@/lib/thesis-export/orchestrate-thesis-export";

function parseRunId(): string | null {
  const idx = process.argv.indexOf("--run-id");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  const arg = process.argv.find((a) => a.startsWith("--run-id="));
  return arg?.slice("--run-id=".length).trim() || process.env.MPC_PIPELINE_RUN_ID?.trim() || null;
}

async function resolveBuildingId(): Promise<string | null> {
  const buildingId = process.env.BUILDING_ID?.trim();
  const buildingSlug = resolveBuildingSlug();
  const building = await prisma.building.findFirst({
    where: buildingId ? { id: buildingId } : buildingSlug ? { slug: buildingSlug } : undefined,
    select: { id: true, slug: true },
  });
  return building?.id ?? null;
}

async function main() {
  const strict = process.env.THESIS_STRICT === "1";
  const buildingId = await resolveBuildingId();
  if (!buildingId) {
    console.error(
      `[export-thesis] Fant ikke bygg «${resolveBuildingSlug()}» i DB (sjekk BUILDING_ID/BUILDING_SLUG)`,
    );
    process.exit(1);
  }

  const explicitRunId = parseRunId();
  const canonicalRunId = await resolveCanonicalMpcPipelineRunId(buildingId);
  const runId = explicitRunId ?? canonicalRunId;

  if (!runId) {
    console.error(
      "[export-thesis] ingen mpc-v1 kjøring i DB — kjør bun run thesis-mpc først",
    );
    process.exit(1);
  }

  if (!explicitRunId && canonicalRunId) {
    console.log(`[export-thesis] bruker canonical run ${canonicalRunId}`);
  }

  const run = await loadMpcPipelineRunByIdForExport(runId);
  if (!run) {
    console.error(`[export-thesis] fant ikke run ${runId}`);
    process.exit(1);
  }

  const metrics = await readMetricsSummarySnapshot();
  const expectedSteps = metrics?.replaySummary?.stepCount;
  if (typeof expectedSteps === "number" && run.stepCount !== expectedSteps) {
    const msg = `[export-thesis] run har ${run.stepCount} steg, metrics_summary forventer ${expectedSteps}`;
    if (strict) {
      console.error(`${msg} — kjør bun run thesis-mpc eller sett MPC_CANONICAL_PIPELINE_RUN_ID`);
      process.exit(1);
    }
    console.warn(`${msg} (THESIS_STRICT=1 for å feile)`);
  }

  if (
    metrics?.evalStart &&
    run.evalStart.slice(0, 10) !== metrics.evalStart.slice(0, 10)
  ) {
    console.warn(
      `[export-thesis] evalStart avvik: run=${run.evalStart} metrics=${metrics.evalStart}`,
    );
  }

  const result = await orchestrateThesisPipelineExport({
    buildingId,
    run,
    options: { pipelineRunId: run.id, includeEnergyComparison: true },
  });

  console.log(
    `[export-thesis] skrev ${result.outDir}/mpc_counterfactual.csv (${result.stepCount} steg)`,
  );
  console.log(`[export-thesis] skrev ${result.outDir}/metrics_summary.json`);
  console.log(`[export-thesis] replay Δ kost: ${result.deltaCostPct} %`);
  if (result.energyReconcileIncluded) {
    console.log(`[export-thesis] energy_reconcile_summary.json inkludert`);
  }
  if (result.energyComparisonIncluded) {
    console.log(`[export-thesis] energy_comparison.json inkludert`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
