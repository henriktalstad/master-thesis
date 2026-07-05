#!/usr/bin/env bun
/**
 * Kjører sensitivitetsscenarioer (tuning + power-proxy) på eval-datasett.
 * Skriver data/processed/mpc_sensitivity_report.json
 *
 * Usage:
 *   bun run run-mpc-sensitivity
 *   TUNE_MPC_MAX_STEPS=200 bun run run-mpc-sensitivity
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { countMpcVsObservedDeltaSteps } from "@/lib/sd-anlegg/mpc/pipeline/count-meaningful-delta-steps";
import { scalePowerProxyParams } from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import {
  applyTuningPreset,
  presetById,
  type MpcTuningPresetId,
} from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import { resolveMpcSolverConfig } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { resolveGenericMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import { fitMpcCalibrationFromSteps } from "@/lib/sd-anlegg/mpc/pipeline/run-mpc-pipeline";
import { runHistoricalMpcReplay } from "@/lib/sd-anlegg/mpc/controller/optimizer/replay-loop";
import type { MpcCalibrationBundle } from "@/lib/sd-anlegg/mpc/shared/types";
import { readMetricsSummarySnapshot } from "@/lib/thesis-export/assert-thesis-report-alignment";
import { loadThesisEvalStepsForSweep } from "@/services/mpc/load-thesis-eval-steps-for-sweep";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "../data/processed/mpc_sensitivity_report.json",
);

type PowerScale = { elShare: number; heatShare: number; beta: number };

type SensitivityScenario = {
  id: string;
  label: string;
  presetId: MpcTuningPresetId;
  powerScale: PowerScale;
  description: string;
};

const SCENARIOS: readonly SensitivityScenario[] = [
  {
    id: "conservative",
    label: "Conservative",
    presetId: "anlegg_pris_respons_v1",
    powerScale: { elShare: 0.8, heatShare: 0.8, beta: 0.8 },
    description: "Lower controllable shares (×0.8), nominal thesis MPC preset.",
  },
  {
    id: "nominal",
    label: "Nominal",
    presetId: "anlegg_pris_respons_v1",
    powerScale: { elShare: 1, heatShare: 1, beta: 1 },
    description: "Main thesis scenario (anlegg_pris_respons_v1, fitted shares).",
  },
  {
    id: "optimistic",
    label: "Optimistic",
    presetId: "anlegg_pris_respons_v1",
    powerScale: { elShare: 1.2, heatShare: 1.2, beta: 1.2 },
    description: "Higher controllable shares (×1.2), nominal thesis MPC preset.",
  },
  {
    id: "high_comfort_penalty",
    label: "High comfort penalty",
    presetId: "comfort_guarded",
    powerScale: { elShare: 1, heatShare: 1, beta: 1 },
    description: "λ_comfort=4 (comfort_guarded preset), nominal power proxy.",
  },
  {
    id: "high_movement_penalty",
    label: "High movement penalty",
    presetId: "baseline_v1",
    powerScale: { elShare: 1, heatShare: 1, beta: 1 },
    description: "λ_move=0.08, λ_comfort=2 (baseline_v1) — movement robustness contrast.",
  },
  {
    id: "cost_focused",
    label: "Cost focused",
    presetId: "cost_focused",
    powerScale: { elShare: 1, heatShare: 1, beta: 1 },
    description: "λ_comfort=0.8, λ_peak=0.2 — prioritizes cost over comfort proxy.",
  },
];

function runScenario(
  scenario: SensitivityScenario,
  steps: readonly import("@/lib/sd-anlegg/mpc/shared/types").MpcTimestep[],
  baseCalibration: MpcCalibrationBundle,
  buildingPreferences: ReturnType<typeof resolveGenericMpcBuildingPreferences>,
) {
  const calibration: MpcCalibrationBundle = {
    ...baseCalibration,
    power: scalePowerProxyParams(baseCalibration.power, scenario.powerScale),
  };
  const solverConfig = applyTuningPreset(
    resolveMpcSolverConfig(),
    presetById(scenario.presetId),
  );
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
          `[sensitivity]   ${scenario.id}: ${stepIndex + 1}/${totalSteps} (${pct} %) · ${Math.round(elapsedMs / 1000)} s`,
        );
      }
    },
  });
  const mpcVsObserved = countMpcVsObservedDeltaSteps(replay.steps);
  const s = replay.summary;
  const elBase = s.controllableElectricKwhBaseline;
  const elMpc = s.controllableElectricKwhMpc;
  const electricDeltaPct =
    elBase > 0 ? Math.round(((elMpc - elBase) / elBase) * 1000) / 10 : 0;

  return {
    id: scenario.id,
    label: scenario.label,
    description: scenario.description,
    presetId: scenario.presetId,
    powerScale: scenario.powerScale,
    elapsedMs: Date.now() - started,
    deltaCostPct: s.deltaCostPct,
    deltaCostVsEmulatedPct: s.deltaCostVsEmulatedPct,
    electricDeltaPct,
    heatDeltaPct:
      s.controllableHeatKwhBaseline > 0
        ? Math.round(
            ((s.controllableHeatKwhMpc - s.controllableHeatKwhBaseline) /
              s.controllableHeatKwhBaseline) *
              1000,
          ) / 10
        : 0,
    comfortViolationsMpc: s.comfortViolationsMpc,
    comfortViolationsBaseline: s.comfortViolationsBaseline,
    meaningfulDeltaPct: mpcVsObserved.deltaPct,
    fallbackPct: Math.round(s.fallbackPct * 1000) / 10,
    peakDeltaPct:
      s.peakElectricKwBaseline > 0
        ? Math.round(
            ((s.peakElectricKwMpc - s.peakElectricKwBaseline) /
              s.peakElectricKwBaseline) *
              1000,
          ) / 10
        : 0,
    totalCostBaselineKr: s.totalCostBaselineKr,
    totalCostMpcKr: s.totalCostMpcKr,
    controllableElectricShare: calibration.power.controllableElectricShare,
    controllableHeatShare: calibration.power.controllableHeatShare,
  };
}

async function main() {
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error(`[sensitivity] Fant ikke bygg «${resolveBuildingSlug()}» i DB`);
    process.exit(1);
  }

  const sweep = await loadThesisEvalStepsForSweep({
    buildingSlug: ctx.buildingSlug,
  });
  if (!sweep) {
    console.error("[sensitivity] utilstrekkelig dataset");
    process.exit(1);
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
      `[sensitivity] ADVARSEL: ${steps.length}/${fullDatasetSteps} steg — sensitivitetsmakroer hoppes over i LaTeX uten THESIS_TUNING_PARTIAL_OK=1.`,
    );
  }
  if (sweep.windowActions.length > 0) {
    console.info(`[sensitivity] eval-vindu: ${sweep.windowActions.join("; ")}`);
  }

  const calibration = fitMpcCalibrationFromSteps(steps);
  if (!calibration) {
    console.error("[sensitivity] kalibrering feilet");
    process.exit(1);
  }

  const buildingPreferences = resolveGenericMpcBuildingPreferences({
    buildingSlug: ctx.buildingSlug,
    replaySteps: steps,
  });

  console.info(
    `[sensitivity] ${steps.length} steg · ${SCENARIOS.length} scenarioer`,
  );

  const results = SCENARIOS.map((scenario) => {
    console.info(`[sensitivity] kjører ${scenario.id}…`);
    return runScenario(scenario, steps, calibration, buildingPreferences);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    evalStart: sweep.evalStart.toISOString(),
    evalEnd: sweep.evalEnd.toISOString(),
    stepCount: steps.length,
    fullDatasetSteps,
    thesisComplete,
    nominalPowerProxy: calibration.power,
    scenarios: results,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.info("\n[sensitivity] Δ kost vs observert · δu % · komfort MPC:");
  for (const r of results) {
    console.info(
      `  ${r.id.padEnd(22)} ${String(r.deltaCostPct).padStart(6)} % · δu ${String(r.meaningfulDeltaPct).padStart(5)} % · comfort ${r.comfortViolationsMpc} · ${r.elapsedMs} ms`,
    );
  }
  console.info(`\n[sensitivity] skrev ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
