#!/usr/bin/env bun
/**
 * Backfill stepComparison + energyReconcile for eksisterende MPC pipeline-run.
 *
 * Usage:
 *   bun run backfill-mpc-artifacts
 *   bun run backfill-mpc-artifacts --run-id=<uuid>
 */

import "dotenv/config";

import { prisma } from "@/lib/db";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import {
  backfillLatestMpcPipelineForBuilding,
  backfillMpcPipelineArtifacts,
} from "@/lib/sd-anlegg/control/backfill-mpc-pipeline-artifacts";

function parseRunId(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--run-id="));
  return arg?.slice("--run-id=".length).trim() || null;
}

async function main() {
  const slug = resolveBuildingSlug();

  const building = await prisma.building.findFirst({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!building) {
    console.error(`Fant ikke bygg ${slug}`);
    process.exit(1);
  }

  const runId = parseRunId();
  const result = runId
    ? await backfillMpcPipelineArtifacts({ pipelineRunId: runId })
    : await backfillLatestMpcPipelineForBuilding(building.id);

  if (!result) {
    console.error(
      runId
        ? `Fant ikke run ${runId} med replaySteps + calibration`
        : "Ingen pipeline-run å backfille",
    );
    process.exit(1);
  }

  console.log(
    `[backfill-mpc] run ${result.pipelineRunId}: replayRows=${result.replayStepsWritten}, ` +
      `supervisory=${result.supervisoryCommandsWritten}, chartPoints=${result.chartPointCount}, ` +
      `policyKpis=${result.policyKpiCount}, energyHours=${result.energyReconcileHours}, ` +
      `Δ kost MPC vs emulert ${result.deltaMpcVsEmulatedCostKr} kr`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
