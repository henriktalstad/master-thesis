#!/usr/bin/env bun
/**
 * Full thesis MPC-pipeline: ensure data → simulate → persist → export.
 *
 * Usage:
 *   bun run thesis-mpc              # ensure + auto-klipp eval-vindu ved lav dekning
 *   bun run thesis-mpc --refresh    # tving re-henting selv om dekning OK
 *   bun run thesis-mpc --full-sync  # inkluder tung full Infraspawn-sync (~750k rader)
 *   bun run thesis-mpc --no-clip-eval  # ikke klipp THESIS_EVAL_START (streng modus)
 *   bun run thesis-mpc --mode supervisory   # lagrer writeback-kommandoer (operatør)
 *   bun run thesis-mpc --mode live            # live BMS-modus (krever env-gates)
 *   bun run thesis-mpc --skip-ensure
 *   bun run thesis-mpc:fast         # MPC_DEV_HORIZON=1
 */

import "dotenv/config";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { revalidatePath, revalidateTag } from "next/cache";

import { buildMpcSignalComparison } from "@/lib/sd-anlegg/control/build-mpc-signal-comparison";
import { getDefaultBuildingSlug } from "@/lib/config/env";
import { loadMpcPipelineRunByIdForExport } from "@/lib/sd-anlegg/control/load-mpc-pipeline-run";
import { prisma } from "@/lib/db";
import { buildMpcPipelineSnapshot, buildMpcPipelineRunRecordFromResult } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-run";
import { orchestrateThesisPipelineExport } from "@/lib/thesis-export/orchestrate-thesis-export";
import { verifyDbRunMatchesMemoryReplay } from "@/lib/thesis-export/verify-db-export";
import type { MpcPipelineResult } from "@/lib/sd-anlegg/mpc/shared/types";
import { ensureThesisMpcData } from "@/services/mpc/ensure-thesis-mpc-data";
import { findEvalStartMeetingCoverage } from "@/services/mpc/analyze-eval-coverage";
import { resolveEffectiveEvalWindowForMpc } from "@/services/mpc/resolve-effective-eval-window";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { parseMpcExecutionMode } from "@/lib/sd-anlegg/control/mpc-execution-mode";
import { runAndPersistMpcSimulation } from "@/services/mpc/run-simulation";

function parseExecutionModeArg(argv: Set<string>) {
  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      return parseMpcExecutionMode(arg.slice("--mode=".length));
    }
  }
  const modeIdx = [...argv].indexOf("--mode");
  if (modeIdx >= 0) {
    const next = [...argv][modeIdx + 1];
    if (next) return parseMpcExecutionMode(next);
  }
  return parseMpcExecutionMode(process.env.MPC_EXECUTION_MODE);
}

function parseInfluxPages(): number {
  const raw = Number(process.env.MPC_ENSURE_INFLUX_PAGES ?? "40");
  if (!Number.isFinite(raw) || raw < 1) return 40;
  return Math.min(120, Math.floor(raw));
}

function revalidateStyringWorkspace(buildingSlug?: string | null): void {
  const slug = buildingSlug ?? getDefaultBuildingSlug();
  if (!slug) return;
  try {
    revalidatePath(`/sd-anlegg/${slug}/styring`);
    revalidateTag(`mpc-coverage:${slug}`, { expire: 0 });
  } catch {
    // CLI uten Next.js request context
  }
}

async function resolveBuildingIdForExport(): Promise<string | null> {
  const buildingId = process.env.BUILDING_ID?.trim();
  const buildingSlug = resolveBuildingSlug();
  const building = await prisma.building.findFirst({
    where: buildingId ? { id: buildingId } : buildingSlug ? { slug: buildingSlug } : undefined,
    select: { id: true },
  });
  return building?.id ?? null;
}

async function exportThesisFromResult(result: MpcPipelineResult) {
  const run = buildMpcPipelineRunRecordFromResult(result);
  const buildingId = await resolveBuildingIdForExport();
  if (!buildingId) {
    console.warn("[thesis-mpc] export hoppet over — fant ikke buildingId");
    return;
  }

  const exportResult = await orchestrateThesisPipelineExport({
    buildingId,
    run,
    options: { includeEnergyComparison: true },
  });
  console.log(
    `[thesis-mpc] export (minne) → ${exportResult.outDir}/ (Δ kost ${exportResult.deltaCostPct} %, ${exportResult.deltaCostKr ?? "?"} kr)`,
  );
}

async function exportThesisAfterRun(
  mpcRunId: string | null,
  result: MpcPipelineResult,
) {
  // Fersk replay i minne er autoritativ — DB-steg kan mangle komfortbånd ved recompute.
  await exportThesisFromResult(result);
  if (!mpcRunId) {
    console.warn("[thesis-mpc] ingen DB-persist — hoppet over DB-verifikasjon");
    return;
  }
  try {
    const run = await loadMpcPipelineRunByIdForExport(mpcRunId);
    if (!run) {
      console.warn(`[thesis-mpc] fant ikke run ${mpcRunId} for verifikasjon`);
      return;
    }
    const verification = verifyDbRunMatchesMemoryReplay({ run, result });
    if (verification.ok) {
      console.log(
        `[thesis-mpc] DB-verifikasjon OK (${result.replay.summary.stepCount} steg, Δ ${result.replay.summary.deltaCostPct} %)`,
      );
    } else {
      console.warn(
        "[thesis-mpc] DB/minne-avvik (minne-eksport er canonical):",
        verification.issues.join("; "),
      );
    }
  } catch (error) {
    console.warn("[thesis-mpc] DB-verifikasjon feilet:", error);
  }
}

async function writeLocalArtifacts(
  result: import("@/lib/sd-anlegg/mpc/shared/types").MpcPipelineResult,
) {
  const outDir = resolve(process.cwd(), "data/simulation");
  await mkdir(outDir, { recursive: true });
  const snapshot = buildMpcPipelineSnapshot(result);
  const comparison = buildMpcSignalComparison(result.replay.steps);

  await writeFile(
    resolve(outDir, "mpc_pipeline_result.json"),
    `${JSON.stringify({ ...snapshot, hourlyComparison: comparison }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(outDir, "mpc_replay_summary.json"),
    `${JSON.stringify(result.replay.summary, null, 2)}\n`,
    "utf8",
  );
}

async function main() {
  const argv = new Set(process.argv.slice(2));
  const skipEnsure = argv.has("--skip-ensure");
  const forceRefresh = argv.has("--refresh");
  const fullSync = argv.has("--full-sync");
  const noClipEval = argv.has("--no-clip-eval");
  const executionMode = parseExecutionModeArg(argv);
  console.log(`[thesis-mpc] executionMode=${executionMode}`);

  if (!skipEnsure) {
    console.log("[thesis-mpc] sikrer thesis-data…");
    if (forceRefresh) {
      console.log("[thesis-mpc] --refresh: tvinger re-henting");
    }
    if (fullSync) {
      console.log("[thesis-mpc] --full-sync: inkluderer tung Infraspawn-sync");
    } else {
      console.log(
        "[thesis-mpc] kun direkte Influx for kontrollsignaler (bruk --full-sync for alle BACnet-punkter)",
      );
    }
    if (noClipEval) {
      console.log("[thesis-mpc] --no-clip-eval: bruker THESIS_EVAL_START uendret");
    }

    const ensured = await ensureThesisMpcData({
      forceDataRefresh: forceRefresh,
      skipFullSourceSync: !fullSync,
      maxSyncIterations: fullSync ? 2 : 0,
      allowDirectInflux: true,
      directInfluxMaxPages: parseInfluxPages(),
      autoClipEvalStart: !noClipEval,
    });
    console.log("[thesis-mpc] ensure:", ensured.message);
    for (const action of ensured.actions) {
      console.log("  ·", action);
    }
    if (!ensured.ok) {
      const pct = Math.round((ensured.coverageAfter?.uMeasPct ?? 0) * 100);
      console.error(
        `[thesis-mpc] avbrutt — dekning ${pct} % etter ensure. Hent SD-data før simulering.`,
      );
      for (const action of ensured.actions) console.error("  ·", action);

      const thesisWindow = getThesisEvalWindow();
      const configuredStart =
        thesisWindow.start ??
        (ensured.coverageAfter
          ? new Date(ensured.coverageAfter.evalStart)
          : null);
      const evalEnd =
        thesisWindow.end ??
        (ensured.coverageAfter
          ? new Date(ensured.coverageAfter.evalEnd)
          : null);
      if (configuredStart && evalEnd) {
        const suggestion = await findEvalStartMeetingCoverage({
          configuredStart,
          evalEnd,
        });
        if (suggestion) {
          console.error(
            `[thesis-mpc] Forslag: sett THESIS_EVAL_START=${suggestion.evalStart.toISOString().slice(0, 10)} (${Math.round(suggestion.uMeasPct * 100)} % uMeas)`,
          );
        } else {
          console.error(
            "[thesis-mpc] Ingen delperiode når 90 % uMeas — sjekk Postgres-sync og THESIS_EVAL_*.",
          );
        }
      }
      process.exit(1);
    }

    console.log("[thesis-mpc] kjører mpc-v1.1-building replay (policy mpc-v1)…");
    const run = await runAndPersistMpcSimulation({
      skipEnsure: true,
      executionMode,
      solverProfile: "thesis",
      evalStart: ensured.effectiveEvalStart
        ? new Date(ensured.effectiveEvalStart)
        : undefined,
      evalEnd: ensured.effectiveEvalEnd
        ? new Date(ensured.effectiveEvalEnd)
        : undefined,
    });
    if (!run.ok) {
      console.error("[thesis-mpc] feilet:", run.reason, run.detail ?? "");
      process.exit(1);
    }

    await writeLocalArtifacts(run.result);

    if (run.mpcRunId) {
      console.log(`[thesis-mpc] persistert DB run ${run.mpcRunId}`);
      revalidateStyringWorkspace();
    }
    await exportThesisAfterRun(run.mpcRunId, run.result);

    const summary = run.result.replay.summary;
    console.log("\n[thesis-mpc] replay summary:");
    console.log(
      JSON.stringify(
        {
          stepCount: summary.stepCount,
          optimizedSteps: summary.optimizedSteps,
          fallbackSteps: summary.fallbackSteps,
          skippedSteps: summary.skippedSteps,
          totalCostBaselineKr: summary.totalCostBaselineKr,
          totalCostMpcKr: summary.totalCostMpcKr,
          deltaCostKr: summary.deltaCostKr,
          deltaCostPct: summary.deltaCostPct,
          meaningfulDeltaPct: summary.meaningfulDeltaPct,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("[thesis-mpc] kjører mpc-v1 replay…");
  const thesisWindow = getThesisEvalWindow();
  let evalStart = thesisWindow.start ?? undefined;
  let evalEnd = thesisWindow.end ?? undefined;
  if (!noClipEval) {
    const resolved = await resolveEffectiveEvalWindowForMpc({
      configuredStart: evalStart,
      configuredEnd: evalEnd,
    });
    evalStart = resolved.evalStart;
    evalEnd = resolved.evalEnd;
    for (const action of resolved.actions) {
      console.log("  ·", action);
    }
  }
  const run = await runAndPersistMpcSimulation({
    skipEnsure: true,
    executionMode,
    solverProfile: "thesis",
    evalStart,
    evalEnd,
  });
  if (!run.ok) {
    console.error("[thesis-mpc] feilet:", run.reason, run.detail ?? "");
    process.exit(1);
  }

  await writeLocalArtifacts(run.result);

  if (run.mpcRunId) {
    console.log(`[thesis-mpc] persistert DB run ${run.mpcRunId}`);
    revalidateStyringWorkspace();
  }
  await exportThesisAfterRun(run.mpcRunId, run.result);

  const summary = run.result.replay.summary;
  console.log("\n[thesis-mpc] replay summary:");
  console.log(
    JSON.stringify(
      {
        stepCount: summary.stepCount,
        optimizedSteps: summary.optimizedSteps,
        fallbackSteps: summary.fallbackSteps,
        skippedSteps: summary.skippedSteps,
        totalCostBaselineKr: summary.totalCostBaselineKr,
        totalCostMpcKr: summary.totalCostMpcKr,
        deltaCostKr: summary.deltaCostKr,
        deltaCostPct: summary.deltaCostPct,
        meaningfulDeltaPct: summary.meaningfulDeltaPct,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
