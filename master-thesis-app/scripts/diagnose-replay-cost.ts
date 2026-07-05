#!/usr/bin/env bun
/**
 * Forklarer hvorfor replay Δ kost er liten — proxy-dekomponering, prisspredning, δu vs besparelse.
 *
 * Usage:
 *   bun run diagnose-replay-cost
 *   bun run diagnose-replay-cost -- --run-id cmr2dsdge00006elw9c8jo6ok
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { analyzeReplayCostDelta } from "@/lib/sd-anlegg/mpc/pipeline/analyze-replay-cost-delta";
import {
  loadLatestMpcPipelineRunForExport,
  loadMpcPipelineRunByIdForExport,
} from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";

function parseRunId(): string | null {
  const idx = process.argv.indexOf("--run-id");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return null;
}

async function main() {
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error(`[replay-cost] Fant ikke bygg «${resolveBuildingSlug()}» i DB`);
    process.exit(1);
  }

  const runId = parseRunId();
  const run = runId
    ? await loadMpcPipelineRunByIdForExport(runId)
    : await loadLatestMpcPipelineRunForExport(ctx.buildingId);

  if (!run) {
    console.error("[replay-cost] fant ingen pipeline-run");
    process.exit(1);
  }

  const replaySteps = run.replaySteps as MpcReplayStep[];
  const summary = run.snapshot.replaySummary;
  if (!summary) {
    console.error("[replay-cost] mangler replaySummary på run");
    process.exit(1);
  }

  const thesis = getThesisEvalWindow();
  const diagnosis = analyzeReplayCostDelta({ steps: replaySteps, summary });

  console.log(`\n[replay-cost] run ${run.id}`);
  console.log(
    `[replay-cost] eval ${run.snapshot.evalStart ?? "?"} → ${run.snapshot.evalEnd ?? "?"}`,
  );
  if (thesis.start) {
    console.log(
      `[replay-cost] THESIS_EVAL ${thesis.start.toISOString().slice(0, 10)} → ${thesis.end?.toISOString().slice(0, 10) ?? "?"}`,
    );
  }
  console.log(JSON.stringify(diagnosis, null, 2));
  if (diagnosis.explanations.length > 0) {
    console.log("\n[replay-cost] forklaringer:");
    for (const line of diagnosis.explanations) console.log(`  · ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
