export type EnergyAttestLabel = {
  energyGrade: string;
};

export type EnergyAttestGeometry = {
  heatedBraM2: number;
  heatedVolumeM3: number;
  externalWallAreaM2: number;
  windowAreaM2: number;
  windowRatioPct: number;
  leakageTestDate?: string;
};

export type EnergyAttestEnvelope = {
  uValueWallWPerM2K: number;
  uValueWindowWPerM2K: number;
  thermalBridgeWPerM2K: number;
  normalizedHeatCapacityWhPerM2K: number;
  solarFactor: number;
  frameFactor: number;
  airtightnessH1: number;
};

export type EnergyAttestVentilationDesign = {
  heatRecoveryAnnualPct: number;
  frostEfficiencyPct: number;
  specificFanPowerKwPerM3s: number;
  designAirflowM3PerM2H: number;
};

export type EnergyAttestSystemDesign = {
  heatingSource: string;
  coolingSource: string;
  heatingSetpointC: number;
  coolingSetpointC: number;
  installedHeatingWPerM2: number;
  installedCoolingWPerM2: number;
  systemHeatingEfficiencyPct: number;
  districtHeatingSystemEfficiencyPct: number;
  annualCoolingCopPct: number;
  specificPumpPowerKwPerLs: number;
};

export type EnergyAttestMeasure = {
  id: string;
  labelNo: string;
  labelEn: string;
  summary: string;
};

export type EnergyAttestTechnicalSpecs = {
  geometry: EnergyAttestGeometry;
  envelope: EnergyAttestEnvelope;
  ventilation: EnergyAttestVentilationDesign;
  systems: EnergyAttestSystemDesign;
  label: EnergyAttestLabel;
  measures: readonly EnergyAttestMeasure[];
};

export type EnergyAttestHeatingCarrierShare = {
  id: "districtHeating" | "electricity" | "biofuel" | "heatPump" | "oil" | "gas" | "other";
  labelNo: string;
  labelEn: string;
  sharePct: number;
};

export type EnergyAttestNetDemandRow = {
  id: string;
  labelNo: string;
  labelEn: string;
  kwhPerM2PerYear: number;
  inMpcScope: boolean;
};

export type EnergyAttestDeliveredCarrier = {
  id: "electricity" | "districtHeating" | "districtCooling";
  labelEn: string;
  kwhPerYear: number;
  kwhPerM2PerYear: number;
};

export type EnergyAttestDistrictHeatEndUse = {
  id: "spaceHeating" | "ventilationHeat" | "domesticHotWater";
  labelEn: string;
  kwhPerM2PerYear: number;
};

export type EnergyAttestMpcScopePrior = {
  ventilationHeatShareOfDistrictHeat: number;
  fanElectricityShareOfDeliveredElectricity: number;
  mpcNetDemandShare: number;
  bhccVentilationHeatShareFallback: number;
};

export type BuildingEnergyAttest = {
  buildingSlug: string;
  certificateNumber: string;
  issuedAt: string;
  documentUrl: string;
  address: string;
  postalPlace: string;
  heatedBraM2: number;
  buildingYear: number;
  buildingCategory: string;
  tekStandard: string;
  calculationStandard: string;
  calculationSoftware: string;
  netEnergyDemandTotalKwhPerM2: number;
  netEnergyDemand: readonly EnergyAttestNetDemandRow[];
  delivered: readonly EnergyAttestDeliveredCarrier[];
  districtHeatEndUses: readonly EnergyAttestDistrictHeatEndUse[];
  heatingCarrierShares: readonly EnergyAttestHeatingCarrierShare[];
  measuredThreeYearAvg: {
    electricityKwh: number;
    districtHeatingKwh: number;
    totalKwh: number;
  };
  mpcScope: EnergyAttestMpcScopePrior;
  technical: EnergyAttestTechnicalSpecs;
};
