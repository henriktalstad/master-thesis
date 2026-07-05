#!/usr/bin/env bun
/**
 * Backfill fallbackReason på persisterte replay-steg fra eval-datasett.
 * Unngår full 804-stegs replay når kun deploy-årsak mangler i DB.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { assessMpcStepValidity } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import { resolveCanonicalMpcPipelineRunId } from "@/lib/sd-anlegg/control/resolve-canonical-pipeline-run";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";
import { loadEvalDatasetForMpc } from "@/services/mpc/load-eval-dataset";
import { mpcStepKeyFromMs } from "@/lib/sd-anlegg/mpc/shared/time-grid";

async function main() {
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error("[backfill-fallback] fant ikke bygg");
    process.exit(1);
  }

  const runId = await resolveCanonicalMpcPipelineRunId(ctx.buildingId);
  if (!runId) {
    console.error("[backfill-fallback] ingen pipeline-run");
    process.exit(1);
  }

  const run = await prisma.sdAnleggMpcPipelineRun.findUnique({
    where: { id: runId },
    select: { evalStart: true, evalEnd: true },
  });
  if (!run) process.exit(1);

  const [dataset, rows] = await Promise.all([
    loadEvalDatasetForMpc({
      buildingSlug: ctx.buildingSlug,
      evalStart: run.evalStart,
      evalEnd: run.evalEnd,
    }),
    prisma.sdAnleggMpcPipelineReplayStep.findMany({
      where: { pipelineRunId: runId, usedFallback: true },
      select: { id: true, stepAt: true, fallbackReason: true },
    }),
  ]);

  if (!dataset?.steps.length) {
    console.error("[backfill-fallback] tomt dataset");
    process.exit(1);
  }

  const byTime = new Map(
    dataset.steps.map(
      (step) => [mpcStepKeyFromMs(new Date(step.t).getTime()), step] as const,
    ),
  );

  let updated = 0;
  for (const row of rows) {
    if (row.fallbackReason) continue;
    const step = byTime.get(mpcStepKeyFromMs(row.stepAt.getTime()));
    if (!step) continue;
    const reason = assessMpcStepValidity(step).fallbackReason;
    if (!reason) continue;
    await prisma.sdAnleggMpcPipelineReplayStep.update({
      where: { id: row.id },
      data: { fallbackReason: reason },
    });
    updated += 1;
  }

  console.log(
    `[backfill-fallback] oppdaterte ${updated}/${rows.length} fallback-steg på run ${runId}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
