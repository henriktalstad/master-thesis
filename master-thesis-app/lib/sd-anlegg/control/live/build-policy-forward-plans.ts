import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
  stepEnergyCostKr,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import { computeDemandControlFromTimestep } from "@/lib/sd-anlegg/mpc/controller/policies/demand-from-timestep";
import { buildPriceThresholdsFromSteps } from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import type {
  MpcCalibrationBundle,
  MpcControlVector,
  MpcTimestep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import type { LiveForwardPlans, MpcForwardPlan, MpcForwardPlanStep } from "../control-types-live";

function marginalPrice(step: MpcTimestep): number | null {
  return step.effectiveMarginalKrPerKwh ?? step.spotKrPerKwh;
}

function clonePlanWithControls(input: {
  base: MpcForwardPlan;
  labelU: (step: MpcForwardPlanStep, index: number) => MpcControlVector;
  calibration: MpcCalibrationBundle;
  timesteps: readonly MpcTimestep[];
}): MpcForwardPlan {
  const powerParams = input.calibration.power;
  const stepMinutes = input.base.stepMinutes;
  let totalBaseline = 0;
  let totalMpc = 0;

  const planSteps = input.base.planSteps.map((planStep, index) => {
    const ts = input.timesteps[index];
    const uBmsSim = planStep.uBmsSim;
    const uMpc = input.labelU(planStep, index);

    const baselineKw = estimateControllableElectricKw({
      u: uBmsSim,
      buildingElectricityKwh: ts?.buildingElectricityKwh ?? 0.5,
      params: powerParams,
    });
    const mpcKw = estimateControllableElectricKw({
      u: uMpc,
      buildingElectricityKwh: ts?.buildingElectricityKwh ?? 0.5,
      params: powerParams,
    });
    const baselineHeatKw = estimateControllableHeatKw({
      u: uBmsSim,
      outdoorTempC: planStep.outdoorTempC,
      buildingDistrictHeatingKwh: ts?.buildingDistrictHeatingKwh ?? 0.2,
      params: powerParams,
    });
    const mpcHeatKw = estimateControllableHeatKw({
      u: uMpc,
      outdoorTempC: planStep.outdoorTempC,
      buildingDistrictHeatingKwh: ts?.buildingDistrictHeatingKwh ?? 0.2,
      params: powerParams,
    });

    const costBase = stepEnergyCostKr({
      electricKw: baselineKw,
      heatKw: baselineHeatKw,
      stepMinutes,
      marginalKrPerKwh: planStep.effectiveMarginalKrPerKwh ?? marginalPrice(ts!),
      heatKrPerKwh: ts?.heatKrPerKwh ?? null,
    });
    const costMpc = stepEnergyCostKr({
      electricKw: mpcKw,
      heatKw: mpcHeatKw,
      stepMinutes,
      marginalKrPerKwh: planStep.effectiveMarginalKrPerKwh ?? marginalPrice(ts!),
      heatKrPerKwh: ts?.heatKrPerKwh ?? null,
    });
    totalBaseline += costBase;
    totalMpc += costMpc;

    return {
      ...planStep,
      uMpc,
      expectedDeltaCostKr: Math.round((costMpc - costBase) * 100) / 100,
    };
  });

  const deltaCostKr = Math.round((totalMpc - totalBaseline) * 100) / 100;
  const deltaCostPct =
    totalBaseline > 0
      ? Math.round((deltaCostKr / totalBaseline) * 1000) / 10
      : 0;

  return {
    ...input.base,
    planSteps,
    effect: {
      totalCostBaselineKr: Math.round(totalBaseline * 100) / 100,
      totalCostMpcKr: Math.round(totalMpc * 100) / 100,
      deltaCostKr,
      deltaCostPct,
    },
  };
}

/** Utvider mpc-v1 day-ahead med demand-scoped og emulated varianter for UI/sammenligning. */
export function buildPolicyForwardPlans(input: {
  mpcPlan: MpcForwardPlan;
  calibration: MpcCalibrationBundle;
  timesteps: readonly MpcTimestep[];
}): LiveForwardPlans {
  const priceThresholds = buildPriceThresholdsFromSteps(input.timesteps);
  let tExtState =
    input.timesteps.find((s) => s.extractTempC != null)?.extractTempC ?? 20;

  const demandPlan = clonePlanWithControls({
    base: input.mpcPlan,
    calibration: input.calibration,
    timesteps: input.timesteps,
    labelU: (planStep, index) => {
      const step = input.timesteps[index];
      if (!step) return planStep.uMpc;
      const uBmsSim = planStep.uBmsSim;
      const result = computeDemandControlFromTimestep({
        step,
        stepIndex: index,
        steps: input.timesteps,
        calibration: input.calibration,
        tExtState,
        uBmsSim,
        priceThresholds,
        canOptimize: true,
      });
      if (step.extractTempC != null) {
        tExtState = step.extractTempC;
      }
      return result.u ?? uBmsSim;
    },
  });

  const emulatedPlan = clonePlanWithControls({
    base: input.mpcPlan,
    calibration: input.calibration,
    timesteps: input.timesteps,
    labelU: (planStep) => planStep.uBmsSim,
  });

  return {
    "mpc-v1": input.mpcPlan,
    "demand-scoped": demandPlan,
    emulated: emulatedPlan,
  };
}
