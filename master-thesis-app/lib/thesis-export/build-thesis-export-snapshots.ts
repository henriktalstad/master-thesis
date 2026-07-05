import { assessPlantPredictionBounded } from "@/lib/sd-anlegg/mpc/pipeline/assess-plant-prediction-error";
import { buildOccupancyEvalSummary } from "@/lib/sd-anlegg/mpc/config/build-occupancy-eval-summary";
import { NAERBYEN_OFFICE_COMFORT_SCHEDULE } from "@/lib/sd-anlegg/mpc/config/comfort-schedule";
import { inferTuningPresetFromSolver } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import { resolveMpcBuildingPreferences, serializeMpcPreferencesSnapshot } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import type { MpcPipelineRunRecord } from "@/lib/sd-anlegg/control/control-types";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const HOLDOUT_TRAIN_FRACTION = 0.7;

function replayStepHasFullUMeas(step: MpcReplayStep): boolean {
  const u = step.uBmsMeas;
  if (!u) return false;
  return (
    u.supplySetpointC != null &&
    u.supplyFanPct != null &&
    u.exhaustFanPct != null &&
    u.heatingValvePct != null &&
    u.coolingValvePct != null
  );
}

function uMeasCoverageFromSteps(steps: readonly MpcReplayStep[]): {
  stepCount: number;
  fullVectorSteps: number;
  fullVectorPct: number;
} {
  const stepCount = steps.length;
  const fullVectorSteps = steps.filter(replayStepHasFullUMeas).length;
  return {
    stepCount,
    fullVectorSteps,
    fullVectorPct:
      stepCount > 0
        ? Math.round((fullVectorSteps / stepCount) * 1000) / 10
        : 0,
  };
}

export function buildCalibrationSnapshotJson(run: MpcPipelineRunRecord): string {
  const buildingSlug = resolveMpcBuildingPreferences({ buildingSlug: "sorgenfriveien-32ab" });
  const prefs = buildingSlug
    ? serializeMpcPreferencesSnapshot(buildingSlug, {
        occupancyCalibration: run.calibration?.occupancy ?? null,
      })
    : null;
  const tuningPreset = run.calibration?.solver
    ? inferTuningPresetFromSolver(run.calibration.solver)
    : null;

  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      modelVersion: run.modelVersion,
      evalStart: run.evalStart,
      evalEnd: run.evalEnd,
      pipelineRunId: run.id,
      tuningPresetId: tuningPreset?.id ?? null,
      calibration: run.calibration ?? null,
      preferencesSnapshot: prefs,
    },
    null,
    2,
  )}\n`;
}

export function buildHoldoutSplitJson(run: MpcPipelineRunRecord): string {
  const datasetSteps = run.trainStepCount + run.holdoutStepCount;
  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      evalStart: run.evalStart,
      evalEnd: run.evalEnd,
      trainFraction: HOLDOUT_TRAIN_FRACTION,
      trainStepCount: run.trainStepCount,
      holdoutStepCount: run.holdoutStepCount,
      datasetStepCount: datasetSteps,
      replayStepCount: run.stepCount,
      note:
        "Chronological 70/30 split on eval dataset before replay; replay uses full window for counterfactual KPIs.",
    },
    null,
    2,
  )}\n`;
}

export function buildModelReadinessJson(run: MpcPipelineRunRecord): string {
  const { snapshot, replaySteps, calibration } = run;
  const replay = snapshot.replaySummary;
  const plant = snapshot.plantValidation;
  const comfortBand = NAERBYEN_OFFICE_COMFORT_SCHEDULE.periods.find(
    (p) => p.label === "ukedag-drift",
  )?.band ?? { min: 18, max: 24 };
  const bounded = assessPlantPredictionBounded({
    rmseC: plant.rmseC,
    comfortBandC: comfortBand,
  });
  const uMeasCoverage = uMeasCoverageFromSteps(replaySteps);
  const occupancyEval = buildOccupancyEvalSummary(
    replaySteps,
    calibration?.occupancy ?? null,
  );

  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      evalStart: run.evalStart,
      evalEnd: run.evalEnd,
      replayStepCount: replay.stepCount,
      plantValidation: {
        comparedSteps: plant.comparedSteps,
        rmseC: plant.rmseC,
        maeC: plant.maeC,
        comfortBandC: comfortBand,
        bounded: bounded?.bounded ?? null,
        rmseShareOfBand: bounded?.rmseShareOfBand ?? null,
      },
      emulatorValidation: {
        comparedSteps: snapshot.emulatorValidation.comparedSteps,
        heatingModeAccuracy: snapshot.emulatorValidation.heatingModeAccuracy,
        coolingModeAccuracy: snapshot.emulatorValidation.coolingModeAccuracy,
      },
      replayReadiness: {
        optimizablePct: replay.optimizablePct ?? null,
        fallbackPct: replay.fallbackPct ?? null,
        uMeasCoverage,
      },
      occupancyEval,
      readyForMpcClaims:
        bounded?.bounded === true &&
        uMeasCoverage.fullVectorPct >= 95 &&
        (replay.optimizablePct ?? 0) >= 90,
    },
    null,
    2,
  )}\n`;
}
