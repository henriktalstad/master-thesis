import {
  fitLinearRegression,
  regressionMetrics,
  type LinearModel,
} from "../lib/linear-regression";
import { buildPlantFeatureVector } from "./build-features";
import type {
  MpcTimestep,
  SecondaryPlantStateParams,
} from "@/lib/sd-anlegg/mpc/shared/types";

/**
 * Andre RC-tilstand: varmegjenvinner etter-temp. Egen AR(1)+u+d-modell,
 * koblet til extractTemp-tilstanden via t_ext_prev — sammen gir de to
 * modellene et 2-tilstands lineært system (x_{k+1} = A x_k + B u_k + E d_k)
 * i stedet for én lumpet ARX-tilstand.
 */
export const HEAT_RECOVERY_STATE_FEATURE_NAMES = [
  "t_rec_prev",
  "t_ext_prev",
  "supply_setpoint",
  "supply_fan",
  "exhaust_fan",
  "heat_valve",
  "cool_valve",
  "outdoor_temp",
  "solar_proxy",
  "hour_sin",
  "hour_cos",
  "weekend",
] as const;

const MIN_TRAIN_ROWS = 60;

export function heatRecoveryStateToLinear(
  params: SecondaryPlantStateParams,
): LinearModel {
  return {
    intercept: params.coefficients[0] ?? 0,
    coefficients: params.coefficients.slice(1),
  };
}

export function fitHeatRecoveryStateModel(
  train: readonly MpcTimestep[],
): SecondaryPlantStateParams | null {
  const rows: { x: number[]; y: number }[] = [];

  for (let i = 1; i < train.length; i++) {
    const prev = train[i - 1]!;
    const curr = train[i]!;
    if (curr.heatRecoveryAfterTempC == null || prev.heatRecoveryAfterTempC == null) {
      continue;
    }
    if (prev.extractTempC == null || !curr.uMeas) continue;

    const features = buildPlantFeatureVector(
      [...HEAT_RECOVERY_STATE_FEATURE_NAMES],
      {
        tExtPrev: prev.extractTempC,
        tRecPrev: prev.heatRecoveryAfterTempC,
        u: curr.uMeas,
        step: curr,
      },
    );
    if (!features) continue;

    rows.push({ x: features, y: curr.heatRecoveryAfterTempC });
  }

  if (rows.length < MIN_TRAIN_ROWS) return null;

  const model = fitLinearRegression(rows, 1e-4);
  if (!model) return null;

  const metrics = regressionMetrics(rows, model);

  return {
    featureNames: HEAT_RECOVERY_STATE_FEATURE_NAMES,
    coefficients: [model.intercept, ...model.coefficients],
    trainMae: metrics.mae,
    trainRmse: metrics.rmse,
  };
}
