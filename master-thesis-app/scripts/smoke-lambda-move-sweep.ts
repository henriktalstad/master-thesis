#!/usr/bin/env bun
/** Smoke-sweep: λ_move vs målt (2 dager). Endrer ikke presets. */

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { MPC_TUNING_ANLEGG_PRIS_RESPONS_V1 } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import {
  analyzeReplayCostDelta,
  type ReplayCostDiagnosis,
} from "@/lib/sd-anlegg/mpc/pipeline/analyze-replay-cost-delta";
import { runAndPersistMpcSimulation } from "@/services/mpc/run-simulation";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "../data/processed/mpc_lambda_move_smoke_sweep.json",
);

const SWEEP_CASES = [
  {
    id: "aggressive",
    lambdaMove: 0.003,
    label: "Mer aggressive (0.003)",
  },
  {
    id: "canonical",
    lambdaMove: MPC_TUNING_ANLEGG_PRIS_RESPONS_V1.solver.lambdaMove,
    label: "Anlegg pris-respons v1 (0.008)",
  },
  {
    id: "cost_focused",
    lambdaMove: 0.02,
    label: "Cost focused-nivå (0.02)",
  },
  {
    id: "comfort_guarded",
    lambdaMove: 0.08,
    label: "Comfort guarded (0.08)",
  },
] as const;

function parseArg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=") ?? null;
}

function parseWindow(): { evalStart: Date; evalEnd: Date; label: string } {
  const days = Math.max(1, Math.min(7, Number(parseArg("days") ?? "2") || 2));
  const startRaw = parseArg("start") ?? process.env.MPC_SMOKE_EVAL_START?.trim();
  const thesis = getThesisEvalWindow();
  const evalStart = startRaw
    ? new Date(`${startRaw}T00:00:00.000Z`)
    : thesis.start
      ? new Date(thesis.start)
      : new Date(Date.now() - days * 86400000);
  const evalEnd = new Date(evalStart.getTime() + days * 86400000);
  return {
    evalStart,
    evalEnd,
    label: `${evalStart.toISOString().slice(0, 10)} → ${evalEnd.toISOString().slice(0, 10)} (${days} d)`,
  };
}

async function main() {
  const window = parseWindow();
  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error(`[lambda-sweep] Fant ikke bygg «${resolveBuildingSlug()}»`);
    process.exit(1);
  }

  console.log(
    `[lambda-sweep] bygg ${ctx.buildingSlug} · vindu ${window.label}`,
  );
  console.log(
    `[lambda-sweep] ${SWEEP_CASES.length} kjøringer · λ_move temporal=${MPC_TUNING_ANLEGG_PRIS_RESPONS_V1.solver.lambdaMoveTemporal} (uendret)`,
  );

  process.env.MPC_NO_CLIP_EVAL = "1";

  const results: Array<{
    id: string;
    label: string;
    lambdaMove: number;
    elapsedMs: number;
    pipelineRunId: string | null;
    summary: Record<string, unknown>;
    diagnosis: ReplayCostDiagnosis;
  }> = [];

  for (const sweepCase of SWEEP_CASES) {
    const t0 = Date.now();
    console.log(
      `\n[lambda-sweep] ▶ ${sweepCase.label} (MPC_LAMBDA_MOVE=${sweepCase.lambdaMove})`,
    );

    process.env.MPC_LAMBDA_MOVE = String(sweepCase.lambdaMove);
    delete process.env.MPC_LAMBDA_MOVE_TEMPORAL;

    const run = await runAndPersistMpcSimulation({
      buildingSlug: ctx.buildingSlug,
      skipEnsure: true,
      evalStart: window.evalStart,
      evalEnd: window.evalEnd,
    });

    if (!run.ok) {
      console.error("[lambda-sweep] feilet:", run.reason, run.detail ?? "");
      process.exit(1);
    }

    const summary = run.result.replay.summary;
    const diagnosis = analyzeReplayCostDelta({
      summary,
      steps: run.result.replay.steps,
    });

    const mpcPolicy = summary.policySummaries?.find(
      (p) => p.policyId === "mpc-v1",
    );

    console.log(
      `[lambda-sweep] ✓ Δ vs målt ${summary.deltaCostPct} % · MPC ${summary.totalCostMpcKr} kr / målt ${summary.totalCostBaselineKr} kr · meaningful δu ${summary.meaningfulDeltaPct} % · highMoveLowSave ${diagnosis.highMoveLowSaveSteps} · ${Date.now() - t0} ms`,
    );

    results.push({
      id: sweepCase.id,
      label: sweepCase.label,
      lambdaMove: sweepCase.lambdaMove,
      elapsedMs: Date.now() - t0,
      pipelineRunId: run.mpcRunId,
      summary: {
        stepCount: summary.stepCount,
        deltaCostPct: summary.deltaCostPct,
        deltaCostKr: summary.deltaCostKr,
        deltaCostVsObservedPct: mpcPolicy?.deltaCostVsObservedPct ?? summary.deltaCostPct,
        totalCostBaselineKr: summary.totalCostBaselineKr,
        totalCostMpcKr: summary.totalCostMpcKr,
        meaningfulDeltaPct: summary.meaningfulDeltaPct,
        fallbackPct: summary.fallbackPct,
        comfortViolationsMpc: summary.comfortViolationsMpc,
        peakElectricKwMpc: summary.peakElectricKwMpc,
        controllableElectricKwhMpc: summary.controllableElectricKwhMpc,
      },
      diagnosis,
    });
  }

  delete process.env.MPC_LAMBDA_MOVE;

  const canonical = results.find((r) => r.id === "canonical");
  const deltas = results.map((r) => Number(r.summary.deltaCostPct ?? 0));
  const spread =
    deltas.length > 0 ? Math.max(...deltas) - Math.min(...deltas) : 0;

  const conclusion =
    spread <= 0.5
      ? "λ_move er ikke flaskehals — behold anlegg_pris_respons_v1."
      : spread <= 1.5
        ? "Moderat λ_move-sensitivitet — diskuter i appendix."
        : "Merkbar λ_move-sensitivitet — vurder canonical etter full eval.";

  const report = {
    generatedAt: new Date().toISOString(),
    purpose: "Robusthetssjekk av canonical λ_move (0.008) mot målt baseline.",
    evalWindow: {
      start: window.evalStart.toISOString(),
      end: window.evalEnd.toISOString(),
      label: window.label,
    },
    fixedSolver: {
      presetId: "anlegg_pris_respons_v1",
      lambdaMoveTemporal:
        MPC_TUNING_ANLEGG_PRIS_RESPONS_V1.solver.lambdaMoveTemporal,
      lambdaComfort: MPC_TUNING_ANLEGG_PRIS_RESPONS_V1.solver.lambdaComfort,
      lambdaPeak: MPC_TUNING_ANLEGG_PRIS_RESPONS_V1.solver.lambdaPeak,
    },
    deltaCostPctSpread: Math.round(spread * 10) / 10,
    canonicalDeltaCostPct: canonical?.summary.deltaCostPct ?? null,
    conclusion,
    results,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("\n[lambda-sweep] Oppsummering (Δ vs målt):");
  for (const row of results) {
    console.log(
      `  λ=${row.lambdaMove} → ${row.summary.deltaCostPct} % (meaningful δu ${row.summary.meaningfulDeltaPct} %)`,
    );
  }
  console.log(`[lambda-sweep] Spredning: ${report.deltaCostPctSpread} pp`);
  console.log(`[lambda-sweep] ${conclusion}`);
  console.log(`[lambda-sweep] rapport → ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
