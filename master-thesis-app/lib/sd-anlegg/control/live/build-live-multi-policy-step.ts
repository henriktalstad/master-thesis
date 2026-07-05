import { deltaControlVectors } from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
  resolvePowerFlowAnchor,
  stepEnergyCostKr,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import type {
  MpcCalibrationBundle,
  MpcControlVector,
  MpcReplayStep,
} from "@/lib/sd-anlegg/mpc/shared/types";

export function buildLiveMultiPolicyStep(input: {
  stepAt: string;
  uMeas: MpcControlVector | null;
  uBmsSim: MpcControlVector;
  uMpc: MpcControlVector;
  uDemand: MpcControlVector;
  extractTempMeasC: number | null;
  extractTempPredC: number | null;
  supplySetpointOperatorC?: number | null;
  supplySetpointCalcC?: number | null;
  supplyTempMeasC?: number | null;
  marginalKrPerKwh: number | null;
  heatKrPerKwh: number | null;
  outdoorTempC: number | null;
  outdoorTempFrostC?: number | null;
  outdoorTempBmsC?: number | null;
  buildingElectricityKwh: number;
  buildingDistrictHeatingKwh: number;
  power: MpcCalibrationBundle["power"];
  coolingValveCommandPct?: number | null;
  coolingValveFeedbackPct?: number | null;
}): MpcReplayStep {
  const flowAnchor = resolvePowerFlowAnchor(input.uMeas, input.uBmsSim);

  const baselineKw = input.uMeas
    ? estimateControllableElectricKw({
        u: input.uMeas,
        buildingElectricityKwh: input.buildingElectricityKwh,
        outdoorTempC: input.outdoorTempC,
        params: input.power,
        uReference: flowAnchor,
      })
    : 0;
  const emulatedKw = estimateControllableElectricKw({
    u: input.uBmsSim,
    buildingElectricityKwh: input.buildingElectricityKwh,
    outdoorTempC: input.outdoorTempC,
    params: input.power,
    uReference: flowAnchor,
  });
  const mpcKw = estimateControllableElectricKw({
    u: input.uMpc,
    buildingElectricityKwh: input.buildingElectricityKwh,
    outdoorTempC: input.outdoorTempC,
    params: input.power,
    uReference: flowAnchor,
  });
  const demandKw = estimateControllableElectricKw({
    u: input.uDemand,
    buildingElectricityKwh: input.buildingElectricityKwh,
    outdoorTempC: input.outdoorTempC,
    params: input.power,
    uReference: flowAnchor,
  });

  const baselineHeatKw = input.uMeas
    ? estimateControllableHeatKw({
        u: input.uMeas,
        outdoorTempC: input.outdoorTempC,
        buildingDistrictHeatingKwh: input.buildingDistrictHeatingKwh,
        params: input.power,
        uReference: flowAnchor,
      })
    : 0;
  const emulatedHeatKw = estimateControllableHeatKw({
    u: input.uBmsSim,
    outdoorTempC: input.outdoorTempC,
    buildingDistrictHeatingKwh: input.buildingDistrictHeatingKwh,
    params: input.power,
    uReference: flowAnchor,
  });
  const mpcHeatKw = estimateControllableHeatKw({
    u: input.uMpc,
    outdoorTempC: input.outdoorTempC,
    buildingDistrictHeatingKwh: input.buildingDistrictHeatingKwh,
    params: input.power,
    uReference: flowAnchor,
  });
  const demandHeatKw = estimateControllableHeatKw({
    u: input.uDemand,
    outdoorTempC: input.outdoorTempC,
    buildingDistrictHeatingKwh: input.buildingDistrictHeatingKwh,
    params: input.power,
    uReference: flowAnchor,
  });

  const costBaselineKr = stepEnergyCostKr({
    electricKw: baselineKw,
    heatKw: baselineHeatKw,
    stepMinutes: 15,
    marginalKrPerKwh: input.marginalKrPerKwh,
    heatKrPerKwh: input.heatKrPerKwh,
  });
  const costEmulatedKr = stepEnergyCostKr({
    electricKw: emulatedKw,
    heatKw: emulatedHeatKw,
    stepMinutes: 15,
    marginalKrPerKwh: input.marginalKrPerKwh,
    heatKrPerKwh: input.heatKrPerKwh,
  });
  const costMpcKr = stepEnergyCostKr({
    electricKw: mpcKw,
    heatKw: mpcHeatKw,
    stepMinutes: 15,
    marginalKrPerKwh: input.marginalKrPerKwh,
    heatKrPerKwh: input.heatKrPerKwh,
  });
  const costDemandKr = stepEnergyCostKr({
    electricKw: demandKw,
    heatKw: demandHeatKw,
    stepMinutes: 15,
    marginalKrPerKwh: input.marginalKrPerKwh,
    heatKrPerKwh: input.heatKrPerKwh,
  });

  return {
    t: input.stepAt,
    uBmsMeas: input.uMeas,
    uBmsSim: input.uBmsSim,
    uMpc: input.uMpc,
    uDemand: input.uDemand,
    deltaU: deltaControlVectors(input.uMpc, input.uBmsSim),
    extractTempMeasC: input.extractTempMeasC,
    extractTempPredC: input.extractTempPredC,
    supplySetpointOperatorC: input.supplySetpointOperatorC ?? null,
    supplySetpointCalcC: input.supplySetpointCalcC ?? null,
    supplyTempMeasC: input.supplyTempMeasC ?? null,
    electricKw: mpcKw,
    heatKw: mpcHeatKw,
    buildingElectricityKwh: input.buildingElectricityKwh,
    buildingDistrictHeatingKwh: input.buildingDistrictHeatingKwh,
    marginalKrPerKwh: input.marginalKrPerKwh,
    outdoorTempC: input.outdoorTempC,
    outdoorTempFrostC: input.outdoorTempFrostC ?? null,
    outdoorTempBmsC: input.outdoorTempBmsC ?? null,
    costBaselineKr,
    costEmulatedKr,
    costMpcKr,
    costDemandKr,
    coolingValveCommandPct: input.coolingValveCommandPct ?? null,
    coolingValveFeedbackPct: input.coolingValveFeedbackPct ?? null,
    comfortViolation: false,
    usedFallback: false,
  };
}
