import {
  fitLinearRegression,
  regressionMetrics,
  type LinearModel,
} from "../lib/linear-regression";
import { resolvePlantFeatureNames } from "../spec/resolve-features";
import type { PlantFeatureScope } from "../spec/signal-scope";
import { buildPlantFeatureVector } from "./build-features";
import { fitHeatRecoveryStateModel } from "./fit-heat-recovery-state";
import type { MpcTimestep, PlantModelParams } from "@/lib/sd-anlegg/mpc/shared/types";

function plantModelToLinear(params: PlantModelParams): LinearModel {
  return {
    intercept: params.coefficients[0] ?? 0,
    coefficients: params.coefficients.slice(1),
  };
}

export function fitPlantModel(
  train: readonly MpcTimestep[],
): PlantModelParams | null {
  const { featureNames, featureScope } = resolvePlantFeatureNames(train);
  const rows: { x: number[]; y: number }[] = [];

  for (let i = 1; i < train.length; i++) {
    const prev = train[i - 1]!;
    const curr = train[i]!;
    if (curr.extractTempC == null || prev.extractTempC == null) continue;
    if (!curr.uMeas) continue;

    const features = buildPlantFeatureVector(featureNames, {
      tExtPrev: prev.extractTempC,
      tRecPrev: prev.heatRecoveryAfterTempC,
      u: curr.uMeas,
      step: curr,
    });
    if (!features) continue;

    rows.push({ x: features, y: curr.extractTempC });
  }

  const model = fitLinearRegression(rows, 1e-4);
  if (!model) return null;

  const metrics = regressionMetrics(rows, model);
  const heatRecoveryState = fitHeatRecoveryStateModel(train);

  return {
    version: heatRecoveryState ? "plant-v2" : "plant-v1",
    featureNames,
    coefficients: [model.intercept, ...model.coefficients],
    trainMae: metrics.mae,
    trainRmse: metrics.rmse,
    featureScope,
    heatRecoveryState,
  };
}

export { plantModelToLinear };

export type { PlantFeatureScope };
