import { loadEvalDatasetForMpc } from "./load-eval-dataset";
import { assessFromEvalDataset } from "./assess-mpc-simulation-readiness";
import {
  runMpcSimulationFromDataset,
  type MpcPipelineResult,
} from "@/lib/sd-anlegg/mpc/pipeline/run-mpc-pipeline";
import { resolveGenericMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import { resolveMpcBuildingSource } from "./resolve-mpc-context";
import { loadBuildingComfortTargets } from "./load-building-comfort-band";
import type { MpcReplaySolverProfile } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import {
  markMpcSimulationRunning,
  updateMpcSimulationProgress,
} from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import {
  logMpcReplayProgress,
  resetMpcReplayProgressLog,
} from "@/lib/sd-anlegg/control/mpc-replay-progress-log";
import { runMpcSimulationBatched } from "./run-mpc-simulation-batched";

export type MpcSimulationFailureReason =
  | "building_or_source_unresolved"
  | "dataset_load_failed"
  | "insufficient_steps"
  | "insufficient_u_meas_coverage"
  | "insufficient_extract_temp_coverage"
  | "missing_control_signals"
  | "plant_model_fit_failed";

export type MpcSimulationRunResult =
  | { ok: true; result: MpcPipelineResult }
  | {
      ok: false;
      reason: MpcSimulationFailureReason;
      detail?: string;
      coverage?: Record<string, number>;
    };

export async function runMpcSimulationFromEvalDataset(input?: {
  buildingSlug?: string;
  evalStart?: Date;
  evalEnd?: Date;
  buildingPreferences?: import("@/lib/sd-anlegg/mpc/config/mpc-building-preferences").ResolvedMpcBuildingPreferences;
  buildingId?: string;
  jobId?: string;
  solverProfile?: MpcReplaySolverProfile;
}): Promise<MpcSimulationRunResult> {
  console.log("[mpc-simulation] laster eval-datasett…");
  const dataset = await loadEvalDatasetForMpc({
    buildingSlug: input?.buildingSlug,
    evalStart: input?.evalStart,
    evalEnd: input?.evalEnd,
  });
  if (!dataset) {
    console.error(
      "[mpc-simulation] dataset null — sjekk BUILDING_SLUG, INFRASPAWN_SOURCE_ID, THESIS_EVAL_* og at SD-sync har kjørt",
    );
    return { ok: false, reason: "dataset_load_failed" };
  }

  const { coverage } = dataset;
  console.log("[mpc-simulation] dataset lastet:", {
    evalStart: dataset.evalStart,
    evalEnd: dataset.evalEnd,
    stepCount: coverage.stepCount,
    stepsWithUMeas: coverage.stepsWithUMeas,
    stepsWithExtractTemp: coverage.stepsWithExtractTemp,
    stepsWithOutdoorTemp: coverage.stepsWithOutdoorTemp,
    stepsWithPrice: coverage.stepsWithPrice,
    provenance: dataset.provenance,
  });

  const readiness = assessFromEvalDataset(dataset, {
    warnLowOptimizable: (input?.solverProfile ?? "thesis") !== "thesis",
  });
  if (!readiness.canSimulate) {
    console.error(
      "[mpc-simulation] avbrutt — utilstrekkelig data:",
      readiness.blockers.join(" · "),
    );
    return {
      ok: false,
      reason: readiness.reason ?? "insufficient_u_meas_coverage",
      detail: readiness.detail ?? readiness.blockers[0],
      coverage,
    };
  }

  console.log("[mpc-simulation] kjører kalibrering + full eval replay…");
  let buildingPreferences = input?.buildingPreferences;
  let buildingId = input?.buildingId;
  if (!buildingPreferences || !buildingId) {
    const ctx = await resolveMpcBuildingSource({
      buildingSlug: input?.buildingSlug,
    });
    if (ctx) {
      buildingId = ctx.buildingId;
      if (!buildingPreferences) {
        const comfortTargets = await loadBuildingComfortTargets(ctx.buildingId);
        buildingPreferences = resolveGenericMpcBuildingPreferences({
          buildingSlug: ctx.buildingSlug,
          comfortTargets,
        });
      }
    }
  }

  const replayStepTotal = dataset.steps.length;
  const solverProfile = input?.solverProfile ?? (input?.jobId ? "interactive" : "thesis");

  if (buildingId) {
    if (input?.jobId) {
      await updateMpcSimulationProgress({
        buildingId,
        jobId: input.jobId,
        stepIndex: 0,
        stepTotal: replayStepTotal,
        message: "Kalibrerer modell…",
      });
    } else {
      await markMpcSimulationRunning({
        buildingId,
        stepTotal: replayStepTotal,
      });
    }
  }

  if (buildingId && input?.jobId) {
    let lastProgressWriteMs = 0;
    const result = await runMpcSimulationBatched({
      buildingId,
      jobId: input.jobId,
      dataset,
      buildingPreferences,
      solverProfile,
      onProgress: (progress) => {
        const now = Date.now();
        if (
          now - lastProgressWriteMs < 2_000 &&
          progress.stepIndex !== progress.totalSteps - 1
        ) {
          return;
        }
        lastProgressWriteMs = now;
        void updateMpcSimulationProgress({
          buildingId,
          jobId: input.jobId,
          stepIndex: progress.stepIndex + 1,
          stepTotal: progress.totalSteps,
          message: `Kjører simulering… ${progress.stepIndex + 1}/${progress.totalSteps}`,
        });
      },
    });
    if (!result) {
      console.error(
        "[mpc-simulation] batched pipeline returnerte null — plant-modell kan ha feilet",
      );
      return {
        ok: false,
        reason: "plant_model_fit_failed",
        coverage,
      };
    }
    console.log("[mpc-simulation] ferdig:", {
      replaySteps: result.replay.summary.stepCount,
      deltaCostPct: result.replay.summary.deltaCostPct,
      fallbackSteps: result.replay.summary.fallbackSteps,
    });
    return { ok: true, result };
  }

  resetMpcReplayProgressLog();
  let lastProgressWriteMs = 0;
  const result = runMpcSimulationFromDataset(dataset, {
    buildingPreferences,
    replaySolverProfile: solverProfile,
    onProgress: (progress) => {
      logMpcReplayProgress(progress);
      if (!buildingId && !input?.jobId) return;
      const now = Date.now();
      if (
        now - lastProgressWriteMs < 2_000 &&
        progress.stepIndex !== progress.totalSteps - 1
      ) {
        return;
      }
      lastProgressWriteMs = now;
      void updateMpcSimulationProgress({
        buildingId,
        jobId: input?.jobId,
        stepIndex: progress.stepIndex + 1,
        stepTotal: progress.totalSteps,
        message: `Kjører simulering… ${progress.stepIndex + 1}/${progress.totalSteps}`,
      });
    },
  });
  if (!result) {
    console.error(
      "[mpc-simulation] pipeline returnerte null — plant-modell kan ha feilet (sjekk extract.temp-dekning)",
    );
    return {
      ok: false,
      reason: "plant_model_fit_failed",
      coverage,
    };
  }

  console.log("[mpc-simulation] ferdig:", {
    replaySteps: result.replay.summary.stepCount,
    deltaCostPct: result.replay.summary.deltaCostPct,
    fallbackSteps: result.replay.summary.fallbackSteps,
  });

  return { ok: true, result };
}

export type { MpcPipelineResult };
