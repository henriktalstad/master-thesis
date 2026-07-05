#!/usr/bin/env bun
/**
 * Smalt replay-vindu + verifikasjon (iterativ utvikling).
 *
 * Usage:
 *   bun run mpc-replay-smoke              # verifiser siste DB-run
 *   bun run mpc-replay-smoke -- --run       # kjør replay (default 2 dager)
 *   bun run mpc-replay-smoke -- --run --days=3
 *   bun run mpc-replay-smoke -- --run --start=2026-06-24 --days=2
 *   bun run mpc-replay-audit                # kun DB-audit av siste run
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  auditLatestMpcPipelineRun,
  auditMpcPipelineRun,
  type MpcPipelineDbAudit,
} from "@/lib/sd-anlegg/control/audit-mpc-pipeline-run";
import {
  buildMpcReplayVerification,
  type MpcReplaySummaryVerificationSlice,
} from "@/lib/sd-anlegg/control/build-mpc-replay-verification";
import { loadMpcEvalArtifacts } from "@/lib/sd-anlegg/control/load-mpc-eval-artifacts";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { runAndPersistMpcSimulation } from "@/services/mpc/run-simulation";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "../data/processed/mpc_replay_smoke_report.json",
);

function parseArg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=") ?? null;
}

function parseSmokeWindow(): { evalStart: Date; evalEnd: Date; label: string } {
  const days = Math.max(1, Math.min(14, Number(parseArg("days") ?? "2") || 2));
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

function printVerification(
  report: ReturnType<typeof buildMpcReplayVerification>,
) {
  console.log(`\n[smoke] artefakt-helse: ${report.health.toUpperCase()}`);
  console.log(`[smoke] ${report.stepCount} steg · ${report.evalStart ?? "?"} → ${report.evalEnd ?? "?"}`);
  console.log(
    `[smoke] peak: observedKw ${report.peakFields.observedKwSteps} steg · peak-timer emulert ${report.peakFields.peakEmulatedHours} MPC ${report.peakFields.peakMpcHours}`,
  );
  if (report.comfort.maeObservedVsMpcC != null) {
    console.log(
      `[smoke] komfort MAE MPC ${report.comfort.maeObservedVsMpcC} °C · brudd ${report.comfort.violationStepsMpc} steg`,
    );
  }
  if (report.priceLoad.present) {
    console.log(
      `[smoke] lastflytting ΔE_hp ${report.priceLoad.deltaE_hp_kwh} kWh · høypris ${report.priceLoad.highPriceHours} t`,
    );
  }
  if (report.capacity.present) {
    console.log(
      `[smoke] effekttopp MPC ${report.capacity.evalPeakMpcKw ?? "—"} kW · capacityLink ${report.capacity.hasCapacityLink ? "ja" : "nei"}`,
    );
  }
  if (report.replaySummary.deltaCostPct != null) {
    console.log(`[smoke] Δ kost ${report.replaySummary.deltaCostPct} %`);
  }
  for (const w of report.warnings) console.log(`  ⚠ ${w}`);
  for (const f of report.failures) console.log(`  ✗ ${f}`);
}

function printDbAudit(audit: MpcPipelineDbAudit) {
  console.log(`\n[smoke] DB-audit: ${audit.health.toUpperCase()}`);
  console.log(
    `[smoke] DB tellinger: rader ${audit.counts.replayStepRows}/${audit.counts.stepCountDeclared} · reconcile ${audit.counts.energyReconcileHours} t · BHCC ${audit.counts.bhccHours} t · kommandoer ${audit.counts.supervisoryCommands}/${audit.counts.supervisoryCommandsExpected}`,
  );
  if (audit.scopeCompare?.rows.length) {
    for (const row of audit.scopeCompare.rows) {
      console.log(
        `[smoke] scope ${row.label}: ${row.scopeKwh ?? "—"} kWh / ${row.buildingKwh ?? "—"} kWh · topp ${row.scopePeakKw ?? "—"}/${row.buildingPeakKw ?? "—"} kW`,
      );
    }
  }
  for (const c of audit.checks.filter((x) => x.status !== "pass")) {
    console.log(
      `  ${c.status === "fail" ? "✗" : "⚠"} [${c.id}] ${c.message}${
        c.expected != null || c.actual != null
          ? ` (${c.actual ?? "?"} vs ${c.expected ?? "?"})`
          : ""
      }`,
    );
  }
  if (audit.scalarVerification) {
    console.log(
      `[smoke] E2E scalars: ${audit.scalarVerification.ok ? "OK" : "AVVIK"} · ${audit.scalarVerification.checks.filter((c) => c.status === "pass").length}/${audit.scalarVerification.checks.length} felt`,
    );
    for (const f of audit.scalarVerification.failures.slice(0, 3)) {
      console.log(`  ✗ ${f}`);
    }
  }
}

function combinedHealth(
  verification: ReturnType<typeof buildMpcReplayVerification>,
  dbAudit: MpcPipelineDbAudit | null,
): "pass" | "warn" | "fail" {
  if (verification.health === "fail" || dbAudit?.health === "fail") return "fail";
  if (verification.health === "warn" || dbAudit?.health === "warn") return "warn";
  return "pass";
}

async function main() {
  const shouldRun = process.argv.includes("--run");
  const skipEnsure = process.argv.includes("--skip-ensure");
  const auditOnly = process.argv.includes("--audit-only");
  const window = parseSmokeWindow();

  const ctx = await resolveMpcBuildingSource({
    buildingSlug: resolveBuildingSlug(),
  });
  if (!ctx) {
    console.error(`[smoke] Fant ikke bygg «${resolveBuildingSlug()}» i DB`);
    process.exit(1);
  }

  console.log(`[smoke] bygg ${ctx.buildingSlug} · vindu ${window.label}`);

  let mpcRunId: string | null = null;

  if (shouldRun) {
    console.log("[smoke] kjører replay…");
    process.env.MPC_NO_CLIP_EVAL = "1";
    const run = await runAndPersistMpcSimulation({
      buildingSlug: ctx.buildingSlug,
      skipEnsure,
      evalStart: window.evalStart,
      evalEnd: window.evalEnd,
    });
    if (!run.ok) {
      console.error("[smoke] replay feilet:", run.reason, run.detail ?? "");
      process.exit(1);
    }
    mpcRunId = run.mpcRunId;
    console.log(
      `[smoke] replay OK · ${run.result.replay.steps.length} steg · run ${mpcRunId ?? "?"}`,
    );
    if (run.dbAudit) {
      printDbAudit(run.dbAudit);
    }
  } else if (auditOnly) {
    const audit = await auditLatestMpcPipelineRun(ctx.buildingId);
    if (!audit) {
      console.error("[smoke] ingen pipeline-run i DB");
      process.exit(1);
    }
    printDbAudit(audit);
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(
      OUTPUT_PATH,
      `${JSON.stringify({ dbAudit: audit, health: audit.health }, null, 2)}\n`,
    );
    console.log(`\n[smoke] rapport → ${OUTPUT_PATH}`);
    if (audit.health === "fail") process.exit(1);
    return;
  }

  const artifacts = await loadMpcEvalArtifacts(ctx.buildingId, {
    includeFullReplaySteps: true,
  });
  if (!artifacts?.replaySteps.length) {
    console.error("[smoke] ingen replay-steg i DB — kjør med --run");
    process.exit(1);
  }

  const verification = buildMpcReplayVerification({
    steps: artifacts.replaySteps,
    evalStart: artifacts.run.snapshot?.evalStart ?? window.evalStart.toISOString(),
    evalEnd: artifacts.run.snapshot?.evalEnd ?? window.evalEnd.toISOString(),
    priceLoadShift: artifacts.priceLoadShift,
    capacityTariff: artifacts.capacityTariff,
    replaySummary:
      (artifacts.run.snapshot?.replaySummary as MpcReplaySummaryVerificationSlice | null) ??
      null,
  });

  printVerification(verification);

  const dbAudit =
    mpcRunId != null
      ? await auditMpcPipelineRun(mpcRunId)
      : await auditLatestMpcPipelineRun(ctx.buildingId);
  if (dbAudit) printDbAudit(dbAudit);

  const health = combinedHealth(verification, dbAudit);
  console.log(`\n[smoke] samlet helse: ${health.toUpperCase()}`);

  const report = {
    health,
    verification,
    dbAudit,
    pipelineRunId: dbAudit?.pipelineRunId ?? mpcRunId,
    generatedAt: new Date().toISOString(),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n[smoke] rapport → ${OUTPUT_PATH}`);

  if (health === "fail") process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
