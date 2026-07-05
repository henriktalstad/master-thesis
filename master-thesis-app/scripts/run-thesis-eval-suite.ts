#!/usr/bin/env bun
/**
 * Kjører alle evalueringsmetoder for thesis og samler resultater.
 *
 * 1. Policy-sammenligning — fra siste thesis-mpc / policy_comparison_summary.json
 * 2. MPC tuning-presets (anlegg_pris_respons_v1, comfort_guarded, cost_focused)
 * 3. Sensitivitetsscenarioer (proxy + preset)
 *
 * Usage:
 *   bun run thesis-eval-suite
 *   TUNE_MPC_MAX_STEPS=200 bun run thesis-eval-suite   # rask dev-sweep
 *
 * Bruker samme trimmet eval-vindu som thesis-mpc (resolveEffectiveEvalWindowForMpc).
 * Ikke sett TUNE_MPC_MAX_STEPS fra metrics_summary — la sweep bruke fullt vindu.
 */

import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  buildControlMethodsSummary,
  formatControlMethodsSummaryLatex,
} from "@/lib/thesis-export/build-control-methods-summary";
import {
  assertEvalWindowMatch,
  assertReportStepCount,
  readMetricsSummarySnapshot,
} from "@/lib/thesis-export/assert-thesis-report-alignment";
import { resolveThesisProcessedDir } from "@/lib/thesis-export/thesis-export-paths";

const PROCESSED = resolveThesisProcessedDir();
const LATEX_TABLE = path.join(
  process.cwd(),
  "../latex/tables/generated/control_methods_summary.tex",
);

function runScript(label: string, script: string): Promise<number> {
  return new Promise((resolve) => {
    console.info(`[eval-suite] ${label}…`);
    const child = spawn("bun", ["run", script], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function main() {
  const metrics = await readMetricsSummarySnapshot(PROCESSED);
  const canonicalSteps = metrics?.replaySummary?.stepCount;
  if (typeof canonicalSteps === "number" && canonicalSteps > 0) {
    console.info(
      `[eval-suite] bruker ${canonicalSteps} steg fra metrics_summary.json`,
    );
  }
  if (process.env.TUNE_MPC_MAX_STEPS) {
    console.warn(
      `[eval-suite] ignorerer TUNE_MPC_MAX_STEPS=${process.env.TUNE_MPC_MAX_STEPS} — full thesis-sweep krever hele vinduet`,
    );
    delete process.env.TUNE_MPC_MAX_STEPS;
  }

  const tuningExit = await runScript("tuning-sweep", "tune-mpc-replay");
  if (tuningExit !== 0) {
    console.error(`[eval-suite] tune-mpc-replay feilet (exit ${tuningExit})`);
    process.exit(tuningExit);
  }

  const sensitivityExit = await runScript("sensitivitet", "run-mpc-sensitivity");
  if (sensitivityExit !== 0) {
    console.error(`[eval-suite] run-mpc-sensitivity feilet (exit ${sensitivityExit})`);
    process.exit(sensitivityExit);
  }

  const alignmentErrors: string[] = [];
  if (typeof canonicalSteps === "number" && canonicalSteps > 0) {
    const tuningReport = await readJsonIfExists<{
      stepCount?: number;
      thesisComplete?: boolean;
      evalStart?: string;
      evalEnd?: string;
    }>(path.join(PROCESSED, "mpc_tuning_report.json"));
    const sensitivityReport = await readJsonIfExists<{
      stepCount?: number;
      thesisComplete?: boolean;
      evalStart?: string;
      evalEnd?: string;
    }>(path.join(PROCESSED, "mpc_sensitivity_report.json"));

    for (const [label, report] of [
      ["mpc_tuning_report.json", tuningReport],
      ["mpc_sensitivity_report.json", sensitivityReport],
    ] as const) {
      const stepErr = assertReportStepCount(report, canonicalSteps, label);
      if (stepErr) alignmentErrors.push(stepErr);
      const windowErr = assertEvalWindowMatch(report, metrics ?? {}, label);
      if (windowErr) alignmentErrors.push(windowErr);
    }
  }

  const policyComparison = await readJsonIfExists<{
    evalStart?: string;
    evalEnd?: string;
    policies?: unknown[];
  }>(path.join(PROCESSED, "policy_comparison_summary.json"));

  if (metrics && policyComparison) {
    const policyWindowErr = assertEvalWindowMatch(
      policyComparison,
      metrics,
      "policy_comparison_summary.json",
    );
    if (policyWindowErr) alignmentErrors.push(policyWindowErr);
  }

  if (alignmentErrors.length > 0) {
    console.error("[eval-suite] alignment-feil:");
    for (const err of alignmentErrors) console.error(`  · ${err}`);
    process.exit(1);
  }

  const tuningReport = await readJsonIfExists<{
    evalStart?: string;
    evalEnd?: string;
    recommendedPresetId?: string;
    results?: unknown[];
  }>(path.join(PROCESSED, "mpc_tuning_report.json"));

  const sensitivityReport = await readJsonIfExists<{
    evalStart?: string;
    evalEnd?: string;
    scenarios?: unknown[];
  }>(path.join(PROCESSED, "mpc_sensitivity_report.json"));

  const summary = buildControlMethodsSummary({
    policyComparison: policyComparison as Parameters<
      typeof buildControlMethodsSummary
    >[0]["policyComparison"],
    tuningReport: tuningReport as Parameters<
      typeof buildControlMethodsSummary
    >[0]["tuningReport"],
    sensitivityReport: sensitivityReport as Parameters<
      typeof buildControlMethodsSummary
    >[0]["sensitivityReport"],
  });

  const summaryPath = path.join(PROCESSED, "control_methods_summary.json");
  await mkdir(PROCESSED, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  await mkdir(path.dirname(LATEX_TABLE), { recursive: true });
  await writeFile(LATEX_TABLE, formatControlMethodsSummaryLatex(summary), "utf8");

  console.info("\n[eval-suite] Oppsummering:");
  console.info(`  Policies:     ${summary.controlPolicies.length} rader`);
  console.info(`  Tuning:       ${summary.mpcTuningPresets.length} presets`);
  console.info(`  Sensitivitet: ${summary.sensitivityScenarios.length} scenarioer`);
  console.info(`\n[eval-suite] skrev ${summaryPath}`);
  console.info(`[eval-suite] skrev ${LATEX_TABLE}`);
  console.info(
    "\n[eval-suite] Kjør deretter: python3 scripts/generate_tables.py && make -C latex",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
