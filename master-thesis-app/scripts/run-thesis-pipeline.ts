#!/usr/bin/env bun
/**
 * Thesis data pipeline — backfill, energi, MPC-plan og eksport.
 *
 * Krever kjørende Next.js (`bun run dev`) for cron-jobber via HTTP.
 *
 * Usage:
 *   bun run thesis-pipeline
 *   bun run thesis-pipeline --skip-backfill
 *   bun run thesis-pipeline --only=export-energy-comparison
 */

import "dotenv/config";

import { waitForCronHttpBase } from "../lib/cron/http-client";
import { invokeCronJobHttp } from "../lib/cron/http-client";
import { exportEnergyComparison } from "../lib/thesis/export-energy-comparison";
import { analyzeSdCoverage } from "../lib/thesis/analyze-sd-coverage";
import { backfillInfraspawnHistorical } from "../services/infraspawn/backfill-historical";

const STEPS = [
  "backfill-infraspawn",
  "sync-weather",
  "sync-energy-prices",
  "sync-grid-tariffs",
  "sync-building-metering-daily",
  "compact-infraspawn",
  "sync-infraspawn",
  "analyze-sd-coverage",
  "run-mpc-v1",
  "export-energy-comparison",
] as const;

type Step = (typeof STEPS)[number];

function parseOnly(): Step | null {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const name = arg.slice("--only=".length) as Step;
  if (!STEPS.includes(name)) {
    console.error(`Ukjent steg: ${name}. Gyldige: ${STEPS.join(", ")}`);
    process.exit(1);
  }
  return name;
}

function shouldSkipBackfill(): boolean {
  return process.argv.includes("--skip-backfill");
}

async function runCron(job: Parameters<typeof invokeCronJobHttp>[0]) {
  const result = await invokeCronJobHttp(job);
  console.log(JSON.stringify(result.body, null, 2));
  if (!result.ok) {
    throw new Error(`${job} feilet: ${result.error ?? result.status}`);
  }
}

async function runStep(step: Step) {
  console.log(`\n[thesis-pipeline] → ${step}`);

  switch (step) {
    case "backfill-infraspawn": {
      const result = await backfillInfraspawnHistorical();
      console.log(JSON.stringify(result, null, 2));
      if (!result.success) process.exit(1);
      break;
    }
    case "sync-building-metering-daily":
    case "sync-infraspawn":
    case "sync-weather":
    case "sync-energy-prices":
    case "sync-grid-tariffs":
    case "compact-infraspawn":
      await runCron(step);
      break;
    case "run-mpc-v1": {
      const { runMpcWhenReady } = await import("../services/mpc/run-mpc-when-ready");
      const result = await runMpcWhenReady({ forceRun: true });
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok && !result.skipped) process.exit(1);
      break;
    }
    case "analyze-sd-coverage": {
      const report = await analyzeSdCoverage();
      console.log(JSON.stringify(report, null, 2));
      if (process.argv.includes("--write")) {
        const { mkdir, writeFile } = await import("node:fs/promises");
        const { resolve } = await import("node:path");
        const outPath = resolve(process.cwd(), "../data/processed/coverage_report.json");
        await mkdir(resolve(process.cwd(), "../data/processed"), { recursive: true });
        await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        console.log(`Skrev ${outPath}`);
      }
      break;
    }
    case "export-energy-comparison": {
      const result = await exportEnergyComparison();
      console.log(JSON.stringify(result, null, 2));
      break;
    }
  }
}

async function main() {
  const only = parseOnly();
  const base = await waitForCronHttpBase();
  console.log(`[thesis-pipeline] koblet til ${base}`);

  let steps: Step[] = only ? [only] : [...STEPS];
  if (shouldSkipBackfill() && !only) {
    steps = steps.filter((s) => s !== "backfill-infraspawn");
  }

  for (const step of steps) {
    await runStep(step);
  }

  console.log("\n[thesis-pipeline] ferdig");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
