import {
  fitBaselineEmulator,
  fitPlantModel,
  fitPowerProxyParams,
  validateBaselineEmulator,
  validatePlantModel,
} from "@/lib/sd-anlegg/envelope-model";
import { resolveMpcSolverConfig, resolveMpcReplaySolverConfig, MPC_CONTROL_MODEL_VERSION, type MpcReplaySolverProfile } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import {
  buildMpcPipelineResult,
  runHistoricalMpcReplay,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/replay-loop";
import { splitTrainHoldout } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import type {
  EvalDataset,
  MpcCalibrationBundle,
  MpcPipelineResult,
} from "@/lib/sd-anlegg/mpc/shared/types";
import type { ResolvedMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import {
  fitOccupancyCalibrationFromSteps,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import {
  serializeMpcPreferencesSnapshot,
  solverConfigFromPreferences,
} from "@/lib/sd-anlegg/mpc/config/resolve-preferences";

export function fitMpcCalibrationFromSteps(
  steps: readonly import("@/lib/sd-anlegg/mpc/shared/types").MpcTimestep[],
): import("@/lib/sd-anlegg/mpc/shared/types").MpcCalibrationBundle | null {
  if (steps.length < 96) return null;

  const { train, holdout } = splitTrainHoldout(steps, 0.7);
  const emulator = fitBaselineEmulator(train);
  const plant = fitPlantModel(train);
  if (!plant) return null;

  const power = fitPowerProxyParams(train);
  const solver = resolveMpcSolverConfig();
  const occupancy = fitOccupancyCalibrationFromSteps(train);

  return {
    modelVersion: MPC_CONTROL_MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    trainStepCount: train.length,
    holdoutStepCount: holdout.length,
    emulator,
    plant,
    power,
    solver,
    occupancy,
  };
}

export function fitMpcPipelineCalibration(
  dataset: EvalDataset,
  options?: {
    buildingPreferences?: ResolvedMpcBuildingPreferences;
  },
): {
  calibration: MpcCalibrationBundle;
  emulatorValidation: MpcPipelineResult["emulatorValidation"];
  plantValidation: MpcPipelineResult["plantValidation"];
} | null {
  if (dataset.steps.length < 96) return null;

  const { train, holdout } = splitTrainHoldout(dataset.steps, 0.7);
  const emulator = fitBaselineEmulator(train);
  const plant = fitPlantModel(train);
  if (!plant) return null;

  const power = fitPowerProxyParams(train);
  const baseSolver = resolveMpcSolverConfig();
  const solver = options?.buildingPreferences
    ? solverConfigFromPreferences(options.buildingPreferences, baseSolver)
    : baseSolver;
  const occupancy = fitOccupancyCalibrationFromSteps(train);

  const calibration: MpcCalibrationBundle = {
    modelVersion: MPC_CONTROL_MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    trainStepCount: train.length,
    holdoutStepCount: holdout.length,
    emulator,
    plant,
    power,
    solver,
    occupancy,
  };

  return {
    calibration,
    emulatorValidation: validateBaselineEmulator(holdout, emulator),
    plantValidation: validatePlantModel(holdout, plant),
  };
}

export function runMpcSimulationFromDataset(
  dataset: EvalDataset,
  options?: {
    buildingPreferences?: ResolvedMpcBuildingPreferences;
    replaySolverProfile?: MpcReplaySolverProfile;
    onProgress?: (progress: {
      stepIndex: number;
      totalSteps: number;
      elapsedMs: number;
      fallbackSteps: number;
    }) => void;
  },
): MpcPipelineResult | null {
  if (dataset.steps.length < 96) {
    return null;
  }

  const fitted = fitMpcPipelineCalibration(dataset, options);
  if (!fitted) return null;

  const { calibration, emulatorValidation, plantValidation } = fitted;

  const replaySolver = resolveMpcReplaySolverConfig(
    calibration.solver,
    options?.replaySolverProfile,
  );
  console.info("[mpc-pipeline] replay solver:", {
    modelVersion: calibration.modelVersion,
    policyId: "mpc-v1",
    horizonSteps: replaySolver.horizonSteps,
    maxIterations: replaySolver.maxIterations,
    lambdaMoveTemporal: replaySolver.lambdaMoveTemporal,
    devShortHorizon: process.env.MPC_DEV_HORIZON === "1",
  });

  const replay = runHistoricalMpcReplay({
    steps: dataset.steps,
    calibration,
    replayStartIndex: 0,
    solverConfig: replaySolver,
    buildingPreferences: options?.buildingPreferences,
    onProgress: (progress) => {
      options?.onProgress?.(progress);
    },
  });

  return buildMpcPipelineResult({
    evalStart: dataset.evalStart,
    evalEnd: dataset.evalEnd,
    steps: dataset.steps,
    calibration,
    emulatorValidation,
    plantValidation,
    replay,
    preferencesSnapshot: options?.buildingPreferences
      ? serializeMpcPreferencesSnapshot(options.buildingPreferences, {
          occupancyCalibration: calibration.occupancy ?? null,
        })
      : null,
  });
}

export type { EvalDataset, MpcPipelineResult };
