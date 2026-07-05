import type { BuildingEnergyAttest } from "./types";

export type ReplayEnergyWindow = {
  measuredElectricityKwh: number;
  measuredDistrictHeatingKwh: number;
  proxyElectricKwh: number;
  proxyHeatKwh: number;
};

export type AttestPracticeComparison = {
  normativeDeliveredElectricityKwh: number;
  normativeDeliveredDistrictHeatingKwh: number;
  measuredThreeYearElectricityKwh: number;
  measuredThreeYearDistrictHeatingKwh: number;
  mpcNetDemandKwhPerM2Year: number;
  ventilationHeatShareOfDistrictHeat: number;
  fanElectricityShareOfDeliveredElectricity: number;
  replay?: {
    measuredElectricityKwh: number;
    measuredDistrictHeatingKwh: number;
    proxyElectricKwh: number;
    proxyHeatKwh: number;
    proxyElectricShareOfMeasured: number;
    proxyHeatShareOfMeasured: number;
    attestScaledVentilationHeatKwh: number;
  };
};

function sumDelivered(
  attest: BuildingEnergyAttest,
  id: "electricity" | "districtHeating",
): number {
  return attest.delivered.find((row) => row.id === id)?.kwhPerYear ?? 0;
}

function mpcNetDemandKwhPerM2(attest: BuildingEnergyAttest): number {
  return attest.netEnergyDemand
    .filter((row) => row.inMpcScope)
    .reduce((sum, row) => sum + row.kwhPerM2PerYear, 0);
}

export function compareAttestToPractice(
  attest: BuildingEnergyAttest,
  replay?: ReplayEnergyWindow,
): AttestPracticeComparison {
  const comparison: AttestPracticeComparison = {
    normativeDeliveredElectricityKwh: sumDelivered(attest, "electricity"),
    normativeDeliveredDistrictHeatingKwh: sumDelivered(attest, "districtHeating"),
    measuredThreeYearElectricityKwh: attest.measuredThreeYearAvg.electricityKwh,
    measuredThreeYearDistrictHeatingKwh:
      attest.measuredThreeYearAvg.districtHeatingKwh,
    mpcNetDemandKwhPerM2Year: mpcNetDemandKwhPerM2(attest),
    ventilationHeatShareOfDistrictHeat:
      attest.mpcScope.ventilationHeatShareOfDistrictHeat,
    fanElectricityShareOfDeliveredElectricity:
      attest.mpcScope.fanElectricityShareOfDeliveredElectricity,
  };

  if (!replay) return comparison;

  const { measuredElectricityKwh, measuredDistrictHeatingKwh } = replay;
  comparison.replay = {
    measuredElectricityKwh,
    measuredDistrictHeatingKwh,
    proxyElectricKwh: replay.proxyElectricKwh,
    proxyHeatKwh: replay.proxyHeatKwh,
    proxyElectricShareOfMeasured:
      measuredElectricityKwh > 0
        ? replay.proxyElectricKwh / measuredElectricityKwh
        : 0,
    proxyHeatShareOfMeasured:
      measuredDistrictHeatingKwh > 0
        ? replay.proxyHeatKwh / measuredDistrictHeatingKwh
        : 0,
    attestScaledVentilationHeatKwh:
      measuredDistrictHeatingKwh *
      attest.mpcScope.ventilationHeatShareOfDistrictHeat,
  };

  return comparison;
}
