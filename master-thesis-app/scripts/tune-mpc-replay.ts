#!/usr/bin/env bun
/**
 * Sammenligner MPC tuning-presets på eval-datasett.
 * Skriver data/processed/mpc_tuning_report.json
 *
 * Usage:
 *   bun run tune-mpc-replay
 *   TUNE_MPC_MAX_STEPS=200 bun run tune-mpc-replay   # rask sweep
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import { analyzeMpcReplaySteps } from "@/lib/sd-anlegg/mpc/pipeline/analyze-e2e";
import { countMpcVsObservedDeltaSteps, countEconomicDeltaSteps } from "@/lib/sd-anlegg/mpc/pipeline/count-meaningful-delta-steps";
import {
  applyTuningPreset,
  MPC_THESIS_TUNING_PRESETS,
  MPC_TUNING_PRESETS_ALL,
  mpcTuningScore,
  type MpcTuningPreset,
} from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import { resolveMpcSolverConfig } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { fitMpcCalibrationFromSteps } from "@/lib/sd-anlegg/mpc/pipeline/run-mpc-pipeline";
import { runHistoricalMpcReplay } from "@/lib/sd-anlegg/mpc/controller/optimizer/replay-loop";
import { resolveGenericMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import { readMetricsSummarySnapshot } from "@/lib/thesis-export/assert-thesis-report-alignment";
import { loadThesisEvalStepsForSweep } from "@/services/mpc/load-thesis-eval-steps-for-sweep";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "../data/processed/mpc_tuning_report.json",
);

function runPreset(
  preset: MpcTuningPreset,
  steps: readonly import("@/lib/sd-anlegg/mpc/shared/types").MpcTimestep[],
  calibration: NonNullable<ReturnType<typeof fitMpcCalibrationFromSteps>>,
  buildingPreferences: ReturnType<typeof resolveGenericMpcBuildingPreferences>,
) {
  const base = resolveMpcSolverConfig();
  const solverConfig = applyTuningPreset(base, preset);
  const started = Date.now();
  let lastLoggedPct = -1;
  const replay = runHistoricalMpcReplay({
    steps,
    calibration,
    replayStartIndex: 0,
    solverConfig,
    buildingPreferences,
    onProgress: ({ stepIndex, totalSteps, elapsedMs }) => {
      const pct = Math.floor(((stepIndex + 1) / totalSteps) * 100);
      if (pct >= lastLoggedPct + 10 || stepIndex + 1 === totalSteps) {
        lastLoggedPct = pct;
        console.info(
          `[tune-mpc]   ${preset.id}: ${stepIndex + 1}/${totalSteps} (${pct} %) · ${Math.round(elapsedMs / 1000)} s`,
        );
      }
    },
  });
  const elapsedMs = Date.now() - started;
  const mpcVsObserved = countMpcVsObservedDeltaSteps(replay.steps);
  const economic = countEconomicDeltaSteps(replay.steps);
  const fallback = analyzeMpcReplaySteps(replay.steps);
  const loadShift = buildPriceLoadShiftAnalysis(replay.steps);
  const comfortIncrease =
    replay.summary.comfortViolationsMpc -
    (replay.summary.comfortViolationsEmulated ??
      replay.summary.comfortViolationsBaseline);

  return {
    presetId: preset.id,
    label: preset.label,
    description: preset.description,
    solver: preset.solver,
    elapsedMs,
    summary: replay.summary,
    meaningfulDeltaSteps: mpcVsObserved.deltaSteps,
    meaningfulDeltaPct: mpcVsObserved.deltaPct,
    economicDeltaSteps: economic.economicSteps,
    economicDeltaPct: economic.economicPct,
    fallbackPct: fallback.fallbackPct,
    highPriceShiftPct: loadShift?.deltaE_hp_pct ?? null,
    tuningScore: mpcTuningScore({
      deltaCostVsEmulatedPct: replay.summary.deltaCostVsEmulatedPct,
      highPriceShiftPct: loadShift?.deltaE_hp_pct ?? null,
      comfortIncrease,
      fallbackPct: fallback.fallbackPct,
    }),
  };
}

async function main() {
  console.info("[tune-mpc] laster eval-datasett…");
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error(`[tune-mpc] Fant ikke bygg «${resolveBuildingSlug()}» i DB`);
    process.exit(1);
  }

  const sweep = await loadThesisEvalStepsForSweep({
    buildingSlug: ctx.buildingSlug,
  });
  if (!sweep) {
    console.error("[tune-mpc] utilstrekkelig dataset");
    process.exit(1);
  }
  if (sweep.windowActions.length > 0) {
    console.info(`[tune-mpc] eval-vindu: ${sweep.windowActions.join("; ")}`);
  }

  const metrics = await readMetricsSummarySnapshot();
  const canonicalSteps =
    metrics?.replaySummary?.stepCount ?? sweep.stepCount;
  const fullDatasetSteps = canonicalSteps;
  const maxSteps = Number(process.env.TUNE_MPC_MAX_STEPS ?? fullDatasetSteps);
  const steps =
    maxSteps < fullDatasetSteps
      ? sweep.steps.slice(-maxSteps)
      : sweep.steps;
  const thesisComplete =
    steps.length === fullDatasetSteps &&
    sweep.stepCount === fullDatasetSteps &&
    maxSteps >= fullDatasetSteps &&
    process.env.TUNE_MPC_MAX_STEPS == null;
  if (!thesisComplete && process.env.THESIS_TUNING_PARTIAL_OK !== "1") {
    console.warn(
      `[tune-mpc] ADVARSEL: ${steps.length}/${fullDatasetSteps} steg — tuning makroer hoppes over i LaTeX. Sett THESIS_TUNING_PARTIAL_OK=1 for dev, eller fjern TUNE_MPC_MAX_STEPS for full thesis-sweep.`,
    );
  }

  const calibration = fitMpcCalibrationFromSteps(steps);
  if (!calibration) {
    console.error("[tune-mpc] kalibrering feilet");
    process.exit(1);
  }

  const buildingPreferences = resolveGenericMpcBuildingPreferences({
    buildingSlug: ctx.buildingSlug,
    replaySteps: steps,
  });

  const presets: readonly MpcTuningPreset[] =
    process.env.TUNE_MPC_FULL_SWEEP === "1"
      ? MPC_TUNING_PRESETS_ALL
      : MPC_THESIS_TUNING_PRESETS;

  console.info(`[tune-mpc] ${steps.length} steg · ${presets.length} presets`);

  const results = presets.map((preset) => {
    console.info(`[tune-mpc] kjører ${preset.id}…`);
    return runPreset(preset, steps, calibration, buildingPreferences);
  });

  const ranked = [...results].sort((a, b) => {
    const costDiff = Math.abs(
      a.summary.deltaCostVsEmulatedPct - b.summary.deltaCostVsEmulatedPct,
    );
    if (costDiff < 0.05) {
      if (a.presetId === "anlegg_pris_respons_v1") return -1;
      if (b.presetId === "anlegg_pris_respons_v1") return 1;
    }
    const scoreA = a.tuningScore;
    const scoreB = b.tuningScore;
    return scoreB - scoreA;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    evalStart: sweep.evalStart.toISOString(),
    evalEnd: sweep.evalEnd.toISOString(),
    stepCount: steps.length,
    fullDatasetSteps,
    thesisComplete,
    recommendedPresetId: ranked[0]?.presetId ?? "anlegg_pris_respons_v1",
    results,
    ranking: ranked.map((r) => r.presetId),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.info(
    "\n[tune-mpc] Resultater (Δkr · Δ% · δu · δu_kost · comfort):",
  );
  for (const r of results) {
    const s = r.summary;
    console.info(
      `  ${r.presetId.padEnd(12)} ${String(s.deltaCostVsEmulatedKr).padStart(7)} kr (${String(s.deltaCostVsEmulatedPct).padStart(5)} %) · δu ${String(r.meaningfulDeltaPct).padStart(5)} % · δu_kost ${String(r.economicDeltaPct).padStart(5)} % · comfort ${s.comfortViolationsMpc} · ${r.elapsedMs} ms`,
    );
  }
  console.info(`\n[tune-mpc] anbefalt: ${report.recommendedPresetId}`);
  console.info(`[tune-mpc] skrev ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
