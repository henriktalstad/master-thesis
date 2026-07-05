#!/usr/bin/env bun
/** @see package.json script `backfill-control-signal-buckets` */
export {};

/**
 * Materialiser styringssignaler i 5/15/60-min buckets fra pipeline-replay.
 *
 * Usage:
 *   bun run backfill-control-signal-buckets
 *   bun run backfill-control-signal-buckets -- sorgenfriveien-32ab
 */
async function main() {
  await import("dotenv/config");
  const { prisma } = await import("@/lib/db");
  const { resolveBuildingSlug } = await import("@/lib/config/thesis-case");
  const { loadPipelineReplaySteps } = await import(
    "@/lib/sd-anlegg/control/persist-mpc-pipeline-replay-steps"
  );
  const { upsertControlSignalBucketsFromSteps } = await import(
    "@/lib/sd-anlegg/control/persist-control-signal-buckets"
  );
  const { upsertControlSignalHoursFromSteps } = await import(
    "@/lib/sd-anlegg/control/persist-control-signal-hours"
  );
  const { resolveCanonicalMpcPipelineRunId } = await import(
    "@/lib/sd-anlegg/control/resolve-canonical-pipeline-run"
  );

  const buildingSlug = resolveBuildingSlug(process.argv[2]);
  const building = await prisma.building.findFirst({
    where: { slug: buildingSlug },
    select: { id: true, name: true },
  });
  if (!building) {
    console.error(`Fant ikke bygg: ${buildingSlug}`);
    process.exit(1);
  }

  const runId = await resolveCanonicalMpcPipelineRunId(building.id);
  if (!runId) {
    console.error("Ingen fullstendig pipeline-run funnet");
    process.exit(1);
  }

  const steps = await loadPipelineReplaySteps({ pipelineRunId: runId });
  console.info(`Laster ${steps.length} replay-steg for ${building.name} …`);

  const [{ hoursWritten }, { bucketsWritten }] = await Promise.all([
    upsertControlSignalHoursFromSteps({
      buildingId: building.id,
      steps,
      pipelineRunId: runId,
    }),
    upsertControlSignalBucketsFromSteps({
      buildingId: building.id,
      steps,
      pipelineRunId: runId,
    }),
  ]);

  console.info(
    `Ferdig — ${hoursWritten} time-rader (legacy) + ${bucketsWritten} bucket-rader (5/15/60 min).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.$disconnect();
  });
