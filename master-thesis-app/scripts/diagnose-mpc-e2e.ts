#!/usr/bin/env bun
/**
 * End-to-end MPC diagnose — input-dekning, fallback, replay-KPI, helse.
 *
 * Usage:
 *   bun run diagnose-mpc-e2e
 *   bun run diagnose-mpc-e2e -- --from-dataset
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMpcPipelineRunByIdForExport } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { resolveCanonicalMpcPipelineRunId } from "@/lib/sd-anlegg/control/resolve-canonical-pipeline-run";
import { buildMpcE2eDiagnosis } from "@/lib/sd-anlegg/mpc/pipeline/analyze-e2e";
import type { MpcReplayStep, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import { loadEvalDatasetForMpc } from "@/services/mpc/load-eval-dataset";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "../data/processed/mpc_e2e_report.json",
);

function parseEvalRange(): { evalStart: Date; evalEnd: Date } {
  const startRaw = process.env.THESIS_EVAL_START?.trim();
  const endRaw = process.env.THESIS_EVAL_END?.trim();
  if (startRaw && endRaw) {
    return {
      evalStart: new Date(`${startRaw}T00:00:00.000Z`),
      evalEnd: new Date(`${endRaw}T23:59:59.999Z`),
    };
  }
  const evalEnd = new Date();
  const evalStart = new Date(Date.now() - 14 * 86400000);
  return { evalStart, evalEnd };
}

function printReport(report: ReturnType<typeof buildMpcE2eDiagnosis>) {
  console.log(`\n[mpc-e2e] helse: ${report.health.toUpperCase()}`);
  console.log(`[mpc-e2e] kilde: ${report.source} · ${report.stepCount} steg`);
  if (report.evalStart && report.evalEnd) {
    console.log(`[mpc-e2e] eval: ${report.evalStart} → ${report.evalEnd}`);
  }
  console.log("[mpc-e2e] uMeas-dekning:", report.uMeasCoveragePct);
  console.log(
    `[mpc-e2e] optimiserbar ${report.optimizablePct} % · fallback ${report.fallbackPct} % · δu ${report.meaningfulDeltaPct} %`,
  );
  if (report.priceLoadShift) {
    console.log(
      `[mpc-e2e] høypris: ${report.priceLoadShift.highPriceHours} timer · ΔE_hp ${report.priceLoadShift.deltaE_hp_pct ?? report.priceLoadShift.deltaE_hp_kwh} ${report.priceLoadShift.deltaE_hp_pct != null ? "%" : "kWh"}`,
    );
  }
  if (report.plantPrediction) {
    console.log(
      `[mpc-e2e] kuvert-RMSE ${report.plantPrediction.rmseC} °C (${Math.round(report.plantPrediction.rmseShareOfBand * 100)} % av komfortband) · bounded=${report.plantPrediction.bounded}`,
    );
  }
  if (report.replaySummary) {
    console.log("[mpc-e2e] replay:", report.replaySummary);
  }
  if (report.blockers.length > 0) {
    console.log("[mpc-e2e] blockers:");
    for (const b of report.blockers) console.log(`  - ${b}`);
  }
}

async function main() {
  const fromDataset = process.argv.includes("--from-dataset");
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error("[mpc-e2e] BUILDING_SLUG/BUILDING_ID mangler");
    process.exit(1);
  }

  let report: ReturnType<typeof buildMpcE2eDiagnosis> | null = null;

  if (!fromDataset) {
    const runId = await resolveCanonicalMpcPipelineRunId(ctx.buildingId);
    const run = runId
      ? await loadMpcPipelineRunByIdForExport(runId)
      : null;
    if (run) {
      const replaySteps = run.replaySteps as MpcReplayStep[];
      report = buildMpcE2eDiagnosis({
        source: "db",
        evalStart: run.snapshot.evalStart,
        evalEnd: run.snapshot.evalEnd,
        plantRmseC: run.snapshot.plantValidation?.rmseC ?? null,
        comfortBandC:
          run.calibration?.solver.comfortBandC ?? { min: 18, max: 24 },
        timesteps: replaySteps.map((step) => ({
          t: step.t,
          tMs: Date.parse(step.t),
          dowUtc: 0,
          hourUtc: 0,
          quarterUtc: 0,
          hourLocal: 0,
          uMeas: step.uBmsMeas,
          supplySetpointOperatorC: null,
          supplySetpointCalcC: null,
          extractTempC: step.extractTempMeasC,
          outdoorTempC: step.outdoorTempC,
          spotKrPerKwh: step.marginalKrPerKwh,
          effectiveMarginalKrPerKwh: step.marginalKrPerKwh,
          heatKrPerKwh: null,
          buildingElectricityKwh: 0,
          buildingDistrictHeatingKwh: 0,
          heatingActive: (step.uBmsMeas?.heatingValvePct ?? 0) > 8,
          coolingActive: (step.uBmsMeas?.coolingValvePct ?? 0) > 8,
        })) as MpcTimestep[],
        replaySteps,
        replaySummary: run.snapshot.replaySummary as Record<string, unknown>,
      });
    } else {
      console.warn("[mpc-e2e] ingen DB-run — faller tilbake til dataset");
    }
  }

  if (!report) {
    const { evalStart, evalEnd } = parseEvalRange();
    const dataset = await loadEvalDatasetForMpc({
      buildingSlug: ctx.buildingSlug,
      evalStart,
      evalEnd,
    });
    if (!dataset || dataset.steps.length === 0) {
      console.error("[mpc-e2e] ingen eval-dataset — kjør sync-infraspawn + thesis-mpc");
      process.exit(1);
    }
    report = buildMpcE2eDiagnosis({
      source: "dataset",
      evalStart: dataset.evalStart,
      evalEnd: dataset.evalEnd,
      timesteps: dataset.steps,
      replaySummary: null,
    });
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printReport(report);
  console.log(`\n[mpc-e2e] skrev ${OUTPUT_PATH}`);
  process.exit(report.health === "red" ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
