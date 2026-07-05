#!/usr/bin/env bun
/**
 * Lokal jobb-orkestrator — kjører pipeline-jobs direkte (synkront).
 *
 * For planlagte jobber i dev: bruk `bun run dev:pipeline` (Inngest dev server).
 *
 * Usage:
 *   bun run jobs
 *   bun run jobs --only=sync-infraspawn
 */

import "dotenv/config";

import {
  PIPELINE_JOB_NAMES,
  runPipelineJob,
  type PipelineJobName,
} from "../lib/jobs/pipeline-jobs";

/** Manuell data-pipeline (kjøres via `--only=`). */
const MANUAL_JOBS = [
  "analyze-sd-coverage",
  "import-spotprices-csv",
  "validate-energy-prices",
  "backfill-infraspawn",
  "sync-building-hourly-costs",
  "export-energy-comparison",
] as const;

type JobName = PipelineJobName | (typeof MANUAL_JOBS)[number];

function parseOnlyFlag(): JobName | null {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const name = arg.slice("--only=".length) as JobName;
  if (
    !PIPELINE_JOB_NAMES.includes(name as PipelineJobName) &&
    !MANUAL_JOBS.includes(name as (typeof MANUAL_JOBS)[number])
  ) {
    console.error(
      `Ukjent jobb: ${name}. Gyldige: ${[...PIPELINE_JOB_NAMES, ...MANUAL_JOBS].join(", ")}`,
    );
    process.exit(1);
  }
  return name;
}

async function runManualJob(name: (typeof MANUAL_JOBS)[number]) {
  switch (name) {
    case "analyze-sd-coverage": {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const { analyzeSdCoverage } = await import(
        "../lib/thesis/analyze-sd-coverage"
      );
      const report = await analyzeSdCoverage();
      console.log(JSON.stringify(report, null, 2));
      if (process.argv.includes("--write")) {
        const outPath = resolve(
          process.cwd(),
          "data/processed/coverage_report.json",
        );
        await mkdir(resolve(process.cwd(), "data/processed"), {
          recursive: true,
        });
        await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        console.log(`\nSkrev ${outPath}`);
      }
      break;
    }
    case "import-spotprices-csv": {
      const { importNordPoolCsv } = await import(
        "../services/energy/import-nord-pool-csv"
      );
      const fileArg = process.argv.find((a) => a.startsWith("--file="));
      const result = await importNordPoolCsv({
        csvPath: fileArg?.slice("--file=".length),
        clipToEvalWindow: !process.argv.includes("--no-clip"),
      });
      console.log(JSON.stringify(result, null, 2));
      if (!result.success) process.exit(1);
      break;
    }
    case "validate-energy-prices": {
      const { validateEnergyPricesAgainstEntsoe } = await import(
        "../lib/energy-prices/validate-energy-prices"
      );
      const result = await validateEnergyPricesAgainstEntsoe();
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "backfill-infraspawn": {
      const { backfillInfraspawnHistorical } = await import(
        "../services/infraspawn/backfill-historical"
      );
      const result = await backfillInfraspawnHistorical();
      console.log(JSON.stringify(result, null, 2));
      if (!result.success) process.exit(1);
      break;
    }
    case "sync-building-hourly-costs": {
      const { syncBuildingHourlyCosts } = await import(
        "../services/energy/sync-building-hourly-costs"
      );
      const result = await syncBuildingHourlyCosts();
      console.log(JSON.stringify(result, null, 2));
      if (!result.success) process.exit(1);
      break;
    }
    case "export-energy-comparison": {
      const { exportEnergyComparison } = await import(
        "../lib/thesis/export-energy-comparison"
      );
      const result = await exportEnergyComparison();
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default: {
      const _exhaustive: never = name;
      console.log(`[jobs] ${_exhaustive} — ukjent manuell jobb`);
    }
  }
}

async function runJob(name: JobName) {
  if (PIPELINE_JOB_NAMES.includes(name as PipelineJobName)) {
    const result = await runPipelineJob(name as PipelineJobName);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  await runManualJob(name as (typeof MANUAL_JOBS)[number]);
}

async function main() {
  const only = parseOnlyFlag();
  const jobs = only ? [only] : [...PIPELINE_JOB_NAMES];

  console.log(`[jobs] starter ${jobs.length} jobb(er)…`);
  for (const job of jobs) {
    console.log(`[jobs] → ${job}`);
    await runJob(job);
  }
  console.log("[jobs] ferdig");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
