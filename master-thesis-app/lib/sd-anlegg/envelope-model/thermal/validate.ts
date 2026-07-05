import { maeFromErrors, rmseFromErrors } from "../lib/stats";
import { predictExtractTemperature, predictHeatRecoveryAfterTemp } from "./predict";
import type {
  MpcTimestep,
  PlantModelParams,
  PlantMultiStepValidation,
  PlantValidationMetrics,
} from "@/lib/sd-anlegg/mpc/shared/types";

const MULTI_STEP_HORIZONS = [
  { horizonHours: 4, horizonSteps: 16 },
  { horizonHours: 12, horizonSteps: 48 },
  { horizonHours: 24, horizonSteps: 96 },
] as const;

function validateOneStep(
  steps: readonly MpcTimestep[],
  params: PlantModelParams,
): Pick<PlantValidationMetrics, "comparedSteps" | "maeC" | "rmseC"> {
  const errors: number[] = [];

  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const curr = steps[i]!;
    if (curr.extractTempC == null || prev.extractTempC == null) continue;
    if (!curr.uMeas) continue;

    const pred = predictExtractTemperature({
      params,
      tExtPrev: prev.extractTempC,
      u: curr.uMeas,
      step: curr,
    });
    if (pred == null) continue;
    errors.push(pred - curr.extractTempC);
  }

  if (errors.length === 0) {
    return { comparedSteps: 0, maeC: 0, rmseC: 0 };
  }

  return {
    comparedSteps: errors.length,
    maeC: maeFromErrors(errors),
    rmseC: rmseFromErrors(errors),
  };
}

function validateMultiStepOpenLoop(
  steps: readonly MpcTimestep[],
  params: PlantModelParams,
  horizonSteps: number,
  horizonHours: number,
): PlantMultiStepValidation {
  const errors: number[] = [];
  let comparedStarts = 0;

  for (let start = 0; start < steps.length - horizonSteps; start++) {
    const seed = steps[start]!;
    if (seed.extractTempC == null) continue;

    let tExt = seed.extractTempC;
    let validRun = true;

    for (let h = 1; h <= horizonSteps; h++) {
      const step = steps[start + h]!;
      if (step.extractTempC == null || !step.uMeas) {
        validRun = false;
        break;
      }

      const pred = predictExtractTemperature({
        params,
        tExtPrev: tExt,
        u: step.uMeas,
        step,
      });
      if (pred == null) {
        validRun = false;
        break;
      }

      errors.push(pred - step.extractTempC);
      tExt = pred;
    }

    if (validRun) comparedStarts += 1;
  }

  return {
    horizonHours,
    horizonSteps,
    comparedStarts,
    maeC: maeFromErrors(errors),
    rmseC: rmseFromErrors(errors),
  };
}

/** Ett-stegs validering av andre RC-tilstand (varmegjenvinner etter-temp). */
function validateHeatRecoveryState(
  steps: readonly MpcTimestep[],
  params: PlantModelParams,
): { comparedSteps: number; maeC: number; rmseC: number } | null {
  if (!params.heatRecoveryState) return null;
  const errors: number[] = [];

  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const curr = steps[i]!;
    if (curr.heatRecoveryAfterTempC == null || prev.heatRecoveryAfterTempC == null) {
      continue;
    }
    if (prev.extractTempC == null || !curr.uMeas) continue;

    const pred = predictHeatRecoveryAfterTemp({
      params,
      tExtPrev: prev.extractTempC,
      tRecPrev: prev.heatRecoveryAfterTempC,
      u: curr.uMeas,
      step: curr,
    });
    if (pred == null) continue;
    errors.push(pred - curr.heatRecoveryAfterTempC);
  }

  if (errors.length === 0) return { comparedSteps: 0, maeC: 0, rmseC: 0 };
  return {
    comparedSteps: errors.length,
    maeC: maeFromErrors(errors),
    rmseC: rmseFromErrors(errors),
  };
}

export function validatePlantModel(
  steps: readonly MpcTimestep[],
  params: PlantModelParams,
): PlantValidationMetrics {
  const oneStep = validateOneStep(steps, params);
  const multiStep = MULTI_STEP_HORIZONS.map(({ horizonHours, horizonSteps }) =>
    validateMultiStepOpenLoop(steps, params, horizonSteps, horizonHours),
  );

  return {
    ...oneStep,
    multiStep,
    featureScope: params.featureScope ?? [],
    heatRecoveryState: validateHeatRecoveryState(steps, params),
  };
}
