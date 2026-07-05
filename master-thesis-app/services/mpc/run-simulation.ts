import { ensurePrismaConnection } from "@/lib/db";
import { parseMpcExecutionMode } from "@/lib/sd-anlegg/control/mpc-execution-mode";
import type { MpcExecutionMode } from "@/generated/client";
import { auditMpcPipelineRun } from "@/lib/sd-anlegg/control/audit-mpc-pipeline-run";
import { persistMpcPipelineRun } from "@/lib/sd-anlegg/control/persist-mpc-pipeline-run";
import {
  markMpcSimulationFinished,
} from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import { ensureThesisMpcData } from "./ensure-thesis-mpc-data";
import {
  runMpcSimulationFromEvalDataset,
  type MpcPipelineResult,
  type MpcSimulationFailureReason,
  type MpcSimulationRunResult,
} from "./run-mpc-pipeline-core";
import { resolveMpcBuildingSource } from "./resolve-mpc-context";

export type {
  MpcPipelineResult,
  MpcSimulationFailureReason,
  MpcSimulationRunResult,
};

export async function runMpcSimulationPipeline(): Promise<MpcPipelineResult | null> {
  const run = await runMpcSimulationPipelineDetailed();
  return run.ok ? run.result : null;
}

export async function runMpcSimulationPipelineDetailed(input?: {
  buildingSlug?: string;
  skipEnsure?: boolean;
  evalStart?: Date;
  evalEnd?: Date;
  solverProfile?: import("@/lib/sd-anlegg/mpc/config/mpc-config").MpcReplaySolverProfile;
}): Promise<MpcSimulationRunResult> {
  if (!input?.skipEnsure && process.env.MPC_SKIP_ENSURE !== "1") {
    console.log("[mpc-simulation] sikrer thesis-data før dataset…");
    const ensured = await ensureThesisMpcData({
      buildingSlug: input?.buildingSlug,
      maxSyncIterations: Number(process.env.MPC_ENSURE_SYNC_ITERATIONS ?? "10"),
      allowDirectInflux: true,
      directInfluxMaxPages: Number(
        process.env.MPC_ENSURE_INFLUX_PAGES ?? "80",
      ),
      autoClipEvalStart: process.env.MPC_NO_CLIP_EVAL !== "1",
    });
    console.log("[mpc-simulation] ensure:", ensured.message, ensured.actions);
  }

  return runMpcSimulationFromEvalDataset({
    buildingSlug: input?.buildingSlug,
    evalStart: input?.evalStart,
    evalEnd: input?.evalEnd,
    solverProfile: input?.solverProfile,
  });
}

export type RunAndPersistMpcSimulationResult =
  | (MpcSimulationRunResult & {
      mpcRunId: string | null;
      dbAudit?: Awaited<ReturnType<typeof auditMpcPipelineRun>> | null;
    })
  | {
      ok: false;
      reason: MpcSimulationFailureReason;
      detail?: string;
      mpcRunId: null;
    };

export async function runAndPersistMpcSimulation(input?: {
  buildingSlug?: string;
  skipEnsure?: boolean;
  evalStart?: Date;
  evalEnd?: Date;
  executionMode?: MpcExecutionMode | string;
  solverProfile?: import("@/lib/sd-anlegg/mpc/config/mpc-config").MpcReplaySolverProfile;
}): Promise<RunAndPersistMpcSimulationResult> {
  const executionMode =
    typeof input?.executionMode === "string"
      ? parseMpcExecutionMode(input.executionMode)
      : input?.executionMode ?? parseMpcExecutionMode(process.env.MPC_EXECUTION_MODE);
  const run = await runMpcSimulationPipelineDetailed(input);
  if (!run.ok) {
    return { ...run, mpcRunId: null };
  }

  try {
    await ensurePrismaConnection();
    const ctx = await resolveMpcBuildingSource({ buildingSlug: input?.buildingSlug });
    if (!ctx) {
      return {
        ok: true,
        result: run.result,
        mpcRunId: null,
      };
    }

    const persisted = await persistMpcPipelineRun({
      buildingId: ctx.buildingId,
      result: run.result,
      executionMode,
    });

    await markMpcSimulationFinished({
      buildingId: ctx.buildingId,
      status: "completed",
      pipelineRunId: persisted?.id ?? null,
      message: "Simulering fullført",
    });

    if (persisted?.artifactIssues.some((issue) => issue.critical)) {
      console.error("[mpc-simulation] pipeline-run persistert med kritiske artifact-feil", {
        runId: persisted.id,
        issues: persisted.artifactIssues,
      });
    }

    const dbAudit = persisted?.id
      ? await auditMpcPipelineRun(persisted.id)
      : null;
    if (dbAudit) {
      console.log(`[mpc-simulation] DB-audit: ${dbAudit.health.toUpperCase()}`);
      for (const c of dbAudit.checks.filter((x) => x.status !== "pass")) {
        console.log(
          `  ${c.status === "fail" ? "✗" : "⚠"} [${c.id}] ${c.message}${
            c.expected != null || c.actual != null
              ? ` (${c.actual ?? "?"} vs ${c.expected ?? "?"})`
              : ""
          }`,
        );
      }
    }

    return {
      ok: true,
      result: run.result,
      mpcRunId: persisted?.id ?? null,
      dbAudit,
    };
  } catch (error) {
    console.error("[mpc-simulation] DB-persist feilet etter replay:", error);
    return {
      ok: true,
      result: run.result,
      mpcRunId: null,
    };
  }
}
