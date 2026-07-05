import { deriveDistrictPlantFollowers } from "@/lib/sd-anlegg/mpc/controller/district/district-plant-followers";
import { comfortViolation } from "@/lib/sd-anlegg/mpc/config/mpc-comfort";
import type { MpcFallbackReason } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import type {
  MpcControlVector,
  MpcReplayStep,
  MpcTimestep,
} from "@/lib/sd-anlegg/mpc/shared/types";

export type ReplayStepPowerCosts = {
  stepHours: number;
  baselineElectricKw: number;
  emulatedElectricKw: number;
  mpcElectricKw: number;
  demandElectricKw: number;
  baselineHeatKw: number;
  emulatedHeatKw: number;
  mpcHeatKw: number;
  demandHeatKw: number;
  costBaselineKr: number;
  costEmulatedKr: number;
  costMpcKr: number;
  costDemandKr: number;
  marginalKrPerKwh: number | null;
  heatingBatteryKwhBaseline?: number;
  heatingDistrictKwhBaseline?: number;
  heatingBatteryKwhEmulated?: number;
  heatingDistrictKwhEmulated?: number;
  heatingBatteryKwhMpc?: number;
  heatingDistrictKwhMpc?: number;
  heatingBatteryKwhDemand?: number;
  heatingDistrictKwhDemand?: number;
};

export function buildReplayStepRecord(input: {
  step: MpcTimestep;
  uMeas: MpcControlVector | null;
  uBmsSim: MpcControlVector;
  uMpc: MpcControlVector;
  uDemand: MpcControlVector;
  deltaU: MpcControlVector;
  extractPred: number | null;
  /** Andre RC-tilstand (plant-v2) — predikert varmegjenvinner etter-temp. */
  heatRecoveryPred?: number | null;
  extractPredEmulated: number | null;
  extractPredDemand: number | null;
  extractPredObserved?: number | null;
  powerCosts: ReplayStepPowerCosts;
  comfortBandC: { min: number; max: number };
  occupancyQ?: number | null;
  occupancySource?: import("@/lib/sd-anlegg/mpc/config/resolve-occupancy").OccupancySource | null;
  usedFallback: boolean;
  fallbackReason: MpcFallbackReason | null;
}): MpcReplayStep {
  const {
    step,
    uMeas,
    uBmsSim,
    uMpc,
    uDemand,
    deltaU,
    extractPred,
    heatRecoveryPred,
    extractPredEmulated,
    extractPredDemand,
    extractPredObserved,
    powerCosts,
    comfortBandC,
    usedFallback,
    fallbackReason,
  } = input;
  const { stepHours } = powerCosts;
  const observedFollowers = deriveDistrictPlantFollowers(uMeas ?? uBmsSim);
  const mpcFollowers = deriveDistrictPlantFollowers(uMpc);

  return {
    t: step.t,
    supplySetpointOperatorC: step.supplySetpointOperatorC,
    supplySetpointCalcC: step.supplySetpointCalcC,
    uBmsMeas: uMeas,
    uBmsSim,
    uMpc,
    uDemand,
    deltaU,
    extractTempMeasC: step.extractTempC,
    extractTempPredC: extractPred,
    extractTempPredEmulatedC: extractPredEmulated,
    extractTempPredDemandC: extractPredDemand,
    extractTempPredObservedC: extractPredObserved ?? null,
    comfortBandMinC: comfortBandC.min,
    comfortBandMaxC: comfortBandC.max,
    occupancyQ: input.occupancyQ ?? null,
    occupancySource: input.occupancySource ?? null,
    heatRecoveryAfterTempPredC: heatRecoveryPred ?? null,
    supplyTempMeasC: step.supplyTempMeasC ?? null,
    intakeTempMeasC: step.intakeTempMeasC ?? null,
    extractSetpointC: step.extractSetpointC ?? null,
    heatRecoveryAfterTempC: step.heatRecoveryAfterTempC ?? null,
    supplyFanFlowM3h: step.supplyFanFlowM3h ?? null,
    exhaustFanFlowM3h: step.exhaustFanFlowM3h ?? null,
    heatingCoilTempC: step.heatingCoilTempC ?? null,
    heatRecoveryEfficiencyPct: step.heatRecoveryEfficiencyPct ?? null,
    frostRiskActive: step.frostRiskActive,
    fireAlarmActive: step.fireAlarmActive,
    lowEfficiencyActive: step.lowEfficiencyActive,
    pumpHeatingMalfunctionActive: step.pumpHeatingMalfunctionActive,
    pumpCoolingMalfunctionActive: step.pumpCoolingMalfunctionActive,
    electricKw: powerCosts.mpcElectricKw,
    heatKw: powerCosts.mpcHeatKw,
    buildingElectricityKwh: step.buildingElectricityKwh,
    buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
    proxyElKwhBaseline: powerCosts.baselineElectricKw * stepHours,
    proxyElKwhEmulated: powerCosts.emulatedElectricKw * stepHours,
    proxyElKwhMpc: powerCosts.mpcElectricKw * stepHours,
    proxyElKwhDemand: powerCosts.demandElectricKw * stepHours,
    proxyHeatKwhBaseline: powerCosts.baselineHeatKw * stepHours,
    proxyHeatKwhEmulated: powerCosts.emulatedHeatKw * stepHours,
    proxyHeatKwhMpc: powerCosts.mpcHeatKw * stepHours,
    proxyHeatKwhDemand: powerCosts.demandHeatKw * stepHours,
    heatingBatteryKwhBaseline: powerCosts.heatingBatteryKwhBaseline,
    heatingDistrictKwhBaseline: powerCosts.heatingDistrictKwhBaseline,
    heatingBatteryKwhEmulated: powerCosts.heatingBatteryKwhEmulated,
    heatingDistrictKwhEmulated: powerCosts.heatingDistrictKwhEmulated,
    heatingBatteryKwhMpc: powerCosts.heatingBatteryKwhMpc,
    heatingDistrictKwhMpc: powerCosts.heatingDistrictKwhMpc,
    heatingBatteryKwhDemand: powerCosts.heatingBatteryKwhDemand,
    heatingDistrictKwhDemand: powerCosts.heatingDistrictKwhDemand,
    marginalKrPerKwh: powerCosts.marginalKrPerKwh,
    spotKrPerKwh: step.spotKrPerKwh,
    outdoorTempC: step.outdoorTempC,
    outdoorTempFrostC: step.outdoorTempFrostC ?? null,
    outdoorTempBmsC: step.outdoorTempBmsC ?? null,
    costBaselineKr: powerCosts.costBaselineKr,
    costEmulatedKr: powerCosts.costEmulatedKr,
    costMpcKr: powerCosts.costMpcKr,
    costDemandKr: powerCosts.costDemandKr,
    comfortViolationEmulated:
      extractPredEmulated != null
        ? comfortViolation(extractPredEmulated, comfortBandC) > 0
        : false,
    comfortViolationDemand:
      extractPredDemand != null
        ? comfortViolation(extractPredDemand, comfortBandC) > 0
        : false,
    comfortViolation:
      extractPred != null ? comfortViolation(extractPred, comfortBandC) > 0 : false,
    usedFallback,
    fallbackReason,
    coolingValveCommandPct: step.coolingValveCommandPct ?? null,
    coolingValveFeedbackPct: step.coolingValveFeedbackPct ?? null,
    districtTr002ValvePct: step.districtTr002ValvePct ?? null,
    districtTr003ValvePct: step.districtTr003ValvePct ?? null,
    districtTr002SupplyTempC: step.districtTr002SupplyTempC ?? null,
    districtTr003SupplyTempC: step.districtTr003SupplyTempC ?? null,
    districtTr002ReturnTempC: step.districtTr002ReturnTempC ?? null,
    districtTr003ReturnTempC: step.districtTr003ReturnTempC ?? null,
    districtTr002SupplySetpointC: step.districtTr002SupplySetpointC ?? null,
    districtTr003SupplySetpointC: step.districtTr003SupplySetpointC ?? null,
    districtMeterTr002EnergyKwh: step.districtMeterTr002EnergyKwh ?? null,
    districtMeterTr002PowerKw: step.districtMeterTr002PowerKw ?? null,
    districtMeterTr002SupplyTempC: step.districtMeterTr002SupplyTempC ?? null,
    districtMeterTr002ReturnTempC: step.districtMeterTr002ReturnTempC ?? null,
    districtMeterTr003EnergyKwh: step.districtMeterTr003EnergyKwh ?? null,
    districtMeterTr003PowerKw: step.districtMeterTr003PowerKw ?? null,
    districtMeterTr003SupplyTempC: step.districtMeterTr003SupplyTempC ?? null,
    districtMeterTr003ReturnTempC: step.districtMeterTr003ReturnTempC ?? null,
    districtTr002PumpObserved: step.districtTr002PumpObserved,
    districtTr003PumpObserved: step.districtTr003PumpObserved,
    districtTr002PumpMatch:
      step.districtTr002PumpObserved != null
        ? step.districtTr002PumpObserved === observedFollowers.districtTr002PumpActive
        : undefined,
    districtTr003PumpMatch:
      step.districtTr003PumpObserved != null
        ? step.districtTr003PumpObserved === observedFollowers.districtTr003PumpActive
        : undefined,
    ventilationSfp: step.ventilationSfp ?? null,
    systemPlantMode: step.systemPlantMode ?? null,
    heatRecoveryRotationGuardRaw: step.heatRecoveryRotationGuardRaw ?? null,
    districtTr002PumpActive: observedFollowers.districtTr002PumpActive,
    districtTr003PumpActive: observedFollowers.districtTr003PumpActive,
    districtTr002PumpActiveMpc: mpcFollowers.districtTr002PumpActive,
    districtTr003PumpActiveMpc: mpcFollowers.districtTr003PumpActive,
  };
}
