/**
 * Kuvertmodell for AHU 360.102 — termisk prediksjon, baseline-emulator, effekt-proxy og state blend.
 *
 * @see README.md
 */

export type {
  PlantFeatureAvailability,
  PlantFeatureCategory,
  PlantFeatureScope,
} from "./spec/signal-scope";
export {
  PLANT_FEATURE_COVERAGE_THRESHOLD,
} from "./spec/signal-scope";
export {
  CORE_PLANT_FEATURE_IDS,
  OPTIONAL_PLANT_FEATURES,
  UNAVAILABLE_PLANT_FEATURES,
  resolvePlantFeatureNames,
} from "./spec/resolve-features";

export { fitPlantModel } from "./thermal/fit-plant";
export {
  predictExtractTemperature,
  predictHeatRecoveryAfterTemp,
} from "./thermal/predict";
export { validatePlantModel } from "./thermal/validate";
export {
  buildPlantFeatureVector,
  buildPlantFeatures,
  plantFeatureValue,
} from "./thermal/build-features";
export {
  fitHeatRecoveryStateModel,
  HEAT_RECOVERY_STATE_FEATURE_NAMES,
} from "./thermal/fit-heat-recovery-state";

export {
  fitBaselineEmulator,
  emulateBaselineControl,
} from "./baseline/fit-emulator";
export { validateBaselineEmulator } from "./baseline/validate-emulator";

export {
  allocateHourlyEnergyToSteps,
  averagePowerKwFromStepEnergy,
  integratePowerSeriesToEnergyKwh,
  resolveTr003GroundTruthKwh,
} from "./power/energy-quantity";
export type { Tr003GroundTruthSource, Tr003MeasuredEnergy } from "./power/energy-quantity";
export {
  fitPowerProxyParams,
  scalePowerProxyParams,
  estimateControllableElectricKw,
  estimateControllableHeatKw,
  breakdownHeatingDemandKw,
  isHeatingDemandActive,
  stepEnergyCostKr,
  resolvePowerFlowAnchor,
} from "./power/build-proxies";
export {
  stepDistrictHeatKw,
  stepDistrictHeatTargetKw,
  integrateDistrictHeatPowerKwh,
  sumHourlyTr003EnergyDelta,
  summarizeTr003MeasuredEnergy,
} from "./power/district-heat-ground-truth";

export {
  resolveStateBlendAlpha,
  updateExtractState,
} from "./state/extract-blend";

export {
  fitLinearRegression,
  predictLinear,
  regressionMetrics,
  type LinearModel,
} from "./lib/linear-regression";

export { median, meanAbs, classificationAccuracy } from "./lib/stats";
