import type { ControlHourlyEnergy } from "@/lib/sd-anlegg/control/control-types";

/** BMS-kontrollvektor u_k (Methods eq. method_measured_baseline_vector). */
export type MpcControlVector = {
  supplySetpointC: number;
  supplyFanPct: number;
  exhaustFanPct: number;
  heatingValvePct: number;
  coolingValvePct: number;
  districtTr002ValvePct: number;
  districtTr003ValvePct: number;
};

export type MpcControlBounds = {
  min: MpcControlVector;
  max: MpcControlVector;
  maxDeltaPerStep: MpcControlVector;
};

/** AHU 360.102 — opprinnelig mpc-v1 scope. */
export const MPC_AHU_CONTROL_KEYS = [
  "supplySetpointC",
  "supplyFanPct",
  "exhaustFanPct",
  "heatingValvePct",
  "coolingValvePct",
] as const satisfies readonly (keyof MpcControlVector)[];

export const MPC_DISTRICT_CONTROL_KEYS = [
  "districtTr002ValvePct",
  "districtTr003ValvePct",
] as const satisfies readonly (keyof MpcControlVector)[];

export const MPC_CONTROL_KEYS: (keyof MpcControlVector)[] = [
  ...MPC_AHU_CONTROL_KEYS,
  ...MPC_DISTRICT_CONTROL_KEYS,
];

export type MpcTimestep = {
  t: string;
  tMs: number;
  dowUtc: number;
  hourUtc: number;
  quarterUtc: number;
  hourLocal: number;
  /** Målt u^BMS,meas */
  uMeas: MpcControlVector | null;
  supplySetpointOperatorC: number | null;
  supplySetpointCalcC: number | null;
  extractTempC: number | null;
  supplyTempMeasC?: number | null;
  intakeTempMeasC?: number | null;
  extractSetpointC?: number | null;
  heatRecoveryAfterTempC?: number | null;
  outdoorTempC: number | null;
  outdoorTempFrostC?: number | null;
  /** Målt BMS utetemp 320.001RT901_MV (kryssvalidering / fallback). */
  outdoorTempBmsC?: number | null;
  spotKrPerKwh: number | null;
  effectiveMarginalKrPerKwh: number | null;
  heatKrPerKwh: number | null;
  buildingElectricityKwh: number;
  /** BHCC kjøleenergi (timevis, replikert per 15 min) — kalibrerer el-proxy. */
  buildingCoolingKwh?: number;
  buildingDistrictHeatingKwh: number;
  heatingActive: boolean;
  coolingActive: boolean;
  /** Aktiv frost/brann/røyk-alarm — fallback (Methods eq:method_mpc_fallback). */
  alarmActive?: boolean;
  coolingValveCommandPct?: number | null;
  coolingValveFeedbackPct?: number | null;
  supplyFanFlowM3h?: number | null;
  exhaustFanFlowM3h?: number | null;
  heatingCoilTempC?: number | null;
  heatRecoveryEfficiencyPct?: number | null;
  frostRiskActive?: boolean;
  fireAlarmActive?: boolean;
  /** Lav virkningsgrad gjenvinner (constraint.low_efficiency). */
  lowEfficiencyActive?: boolean;
  /** TR002 bolig — ventilpådrag (observert, utenfor u_k). */
  districtTr002ValvePct?: number | null;
  /** TR003 næring — ventilpådrag (observert, utenfor u_k). */
  districtTr003ValvePct?: number | null;
  districtTr002SupplyTempC?: number | null;
  districtTr003SupplyTempC?: number | null;
  districtTr002ReturnTempC?: number | null;
  districtTr003ReturnTempC?: number | null;
  districtTr002SupplySetpointC?: number | null;
  districtTr003SupplySetpointC?: number | null;
  districtMeterTr002EnergyKwh?: number | null;
  districtMeterTr002PowerKw?: number | null;
  districtMeterTr002SupplyTempC?: number | null;
  districtMeterTr002ReturnTempC?: number | null;
  districtMeterTr003EnergyKwh?: number | null;
  districtMeterTr003PowerKw?: number | null;
  districtMeterTr003SupplyTempC?: number | null;
  districtMeterTr003ReturnTempC?: number | null;
  districtTr002PumpObserved?: boolean;
  districtTr003PumpObserved?: boolean;
  ventilationSfp?: number | null;
  systemPlantMode?: number | null;
  heatRecoveryRotationGuardRaw?: number | null;
  /** Alarm pumpe varmebatteri (Malf_pumpheater) — trigger for pump_fault-fallback. */
  pumpHeatingMalfunctionActive?: boolean;
  /** Alarm pumpe kjølebatteri (Malf_pumpcooler) — trigger for pump_fault-fallback. */
  pumpCoolingMalfunctionActive?: boolean;
};

export type BaselineEmulatorTemplateKey = string;

export type BaselineEmulatorParams = {
  version:
    | "bms-emulator-v1"
    | "bms-emulator-v1.1-mode-gated"
    | "bms-emulator-v1.2-plant-aware"
    | "bms-emulator-v1.3-hourly-fallback";
  templates: Record<
    BaselineEmulatorTemplateKey,
    Partial<MpcControlVector>
  >;
  hourlyTemplates?: Record<string, Partial<MpcControlVector>>;
  weatherSlopes: Partial<Record<keyof MpcControlVector, number>>;
  globalMedians: Partial<MpcControlVector>;
  comfortErrorSlopes?: Partial<Record<keyof MpcControlVector, number>>;
  defaultExtractSetpointC?: number;
  trainNormalStepCount?: number;
};

export type EmulateBaselineOptions = {
  fallback?: MpcControlVector | null;
  tExtPrev?: number | null;
  disturbed?: boolean;
};

export type PlantModelParams = {
  /** plant-v2: to-tilstands modell (extractTemp + heatRecoveryAfterTemp). plant-v1 = énstats ARX. */
  version?: "plant-v1" | "plant-v2";
  featureNames: readonly string[];
  coefficients: number[];
  trainMae: number | null;
  trainRmse: number | null;
  featureScope: PlantFeatureScope[];
  heatRecoveryState?: SecondaryPlantStateParams | null;
};

export type SecondaryPlantStateParams = {
  featureNames: readonly string[];
  coefficients: number[];
  trainMae: number | null;
  trainRmse: number | null;
};

export type PlantFeatureScope = {
  featureId: string;
  label: string;
  category: "state" | "control" | "disturbance" | "observation" | "time";
  availability: "available" | "partial" | "missing";
  usedInModel: boolean;
  coveragePct: number | null;
};

export type PlantMultiStepValidation = {
  horizonHours: number;
  horizonSteps: number;
  comparedStarts: number;
  maeC: number;
  rmseC: number;
};

export type PowerProxyParams = {
  version: "power-v1" | "power-v2" | "power-v3";
  betaFan: number;
  betaFanFlow?: number | null;
  betaHeat: number;
  betaCool: number;
  controllableElectricShare: number;
  controllableHeatShare: number;
  /** TR002/TR003 — andel av BHCC FV knyttet til ventilpådrag (0 = kun AHU-varme). */
  betaDistrictHeat?: number;
};

export type MpcSolverConfig = {
  horizonSteps: number;
  stepMinutes: 15;
  comfortBandC: { min: number; max: number };
  lambdaMove: number;
  lambdaMoveTemporal: number;
  lambdaComfort: number;
  lambdaPeak: number;
  bounds: MpcControlBounds;
  maxIterations: number;
  learningRate: number;
};

export type MpcCalibrationBundle = {
  modelVersion: "mpc-v1" | "mpc-v1.1-building";
  trainedAt: string;
  trainStepCount: number;
  holdoutStepCount: number;
  emulator: BaselineEmulatorParams;
  plant: PlantModelParams;
  power: PowerProxyParams;
  solver: MpcSolverConfig;
  occupancy?: import("@/lib/sd-anlegg/mpc/config/resolve-occupancy").OccupancyCalibration;
};

export type EmulatorValidationMetrics = {
  comparedSteps: number;
  mae: Partial<Record<keyof MpcControlVector, number>>;
  heatingModeAccuracy: number | null;
  coolingModeAccuracy: number | null;
};

export type PlantValidationMetrics = {
  comparedSteps: number;
  maeC: number;
  rmseC: number;
  multiStep?: PlantMultiStepValidation[];
  featureScope?: PlantFeatureScope[];
  heatRecoveryState?: {
    comparedSteps: number;
    maeC: number;
    rmseC: number;
  } | null;
};

export type {
  ControlPolicy,
  PolicyClaimLevel,
  PolicyId,
  PolicyStepContext,
  PolicyStepResult,
  PolicySummaryKpi,
} from "@/lib/sd-anlegg/mpc/controller/policies/types";

export type MpcReplayStep = {
  t: string;
  supplySetpointOperatorC?: number | null;
  supplySetpointCalcC?: number | null;
  uBmsMeas: MpcControlVector | null;
  uBmsSim: MpcControlVector;
  uMpc: MpcControlVector;
  deltaU: MpcControlVector;
  extractTempMeasC: number | null;
  extractTempPredC: number | null;
  extractTempPredEmulatedC?: number | null;
  extractTempPredDemandC?: number | null;
  extractTempPredObservedC?: number | null;
  comfortBandMinC?: number;
  comfortBandMaxC?: number;
  occupancyQ?: number | null;
  occupancySource?: import("@/lib/sd-anlegg/mpc/config/resolve-occupancy").OccupancySource | null;
  heatRecoveryAfterTempPredC?: number | null;
  supplyTempMeasC?: number | null;
  intakeTempMeasC?: number | null;
  extractSetpointC?: number | null;
  heatRecoveryAfterTempC?: number | null;
  electricKw: number;
  heatKw: number;
  heatingBatteryKwhBaseline?: number;
  heatingDistrictKwhBaseline?: number;
  heatingBatteryKwhEmulated?: number;
  heatingDistrictKwhEmulated?: number;
  heatingBatteryKwhMpc?: number;
  heatingDistrictKwhMpc?: number;
  heatingBatteryKwhDemand?: number;
  heatingDistrictKwhDemand?: number;
  buildingElectricityKwh?: number;
  buildingDistrictHeatingKwh?: number;
  proxyElKwhBaseline?: number;
  proxyElKwhEmulated?: number;
  proxyElKwhMpc?: number;
  proxyElKwhDemand?: number;
  proxyHeatKwhBaseline?: number;
  proxyHeatKwhEmulated?: number;
  proxyHeatKwhMpc?: number;
  proxyHeatKwhDemand?: number;
  marginalKrPerKwh: number | null;
  spotKrPerKwh?: number | null;
  outdoorTempC: number | null;
  outdoorTempFrostC?: number | null;
  outdoorTempBmsC?: number | null;
  costBaselineKr: number;
  costEmulatedKr: number;
  costMpcKr: number;
  uDemand?: MpcControlVector;
  costDemandKr?: number;
  comfortViolationEmulated?: boolean;
  comfortViolationDemand?: boolean;
  comfortViolation: boolean;
  usedFallback: boolean;
  fallbackReason?: import("@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity").MpcFallbackReason;
  coolingValveCommandPct?: number | null;
  coolingValveFeedbackPct?: number | null;
  supplyFanFlowM3h?: number | null;
  exhaustFanFlowM3h?: number | null;
  heatingCoilTempC?: number | null;
  heatRecoveryEfficiencyPct?: number | null;
  frostRiskActive?: boolean;
  fireAlarmActive?: boolean;
  lowEfficiencyActive?: boolean;
  districtTr002PumpActive?: boolean;
  districtTr003PumpActive?: boolean;
  districtTr002PumpActiveMpc?: boolean;
  districtTr003PumpActiveMpc?: boolean;
  districtTr002ValvePct?: number | null;
  districtTr003ValvePct?: number | null;
  districtTr002SupplyTempC?: number | null;
  districtTr003SupplyTempC?: number | null;
  districtTr002ReturnTempC?: number | null;
  districtTr003ReturnTempC?: number | null;
  districtTr002SupplySetpointC?: number | null;
  districtTr003SupplySetpointC?: number | null;
  districtMeterTr002EnergyKwh?: number | null;
  districtMeterTr002PowerKw?: number | null;
  districtMeterTr002SupplyTempC?: number | null;
  districtMeterTr002ReturnTempC?: number | null;
  districtMeterTr003EnergyKwh?: number | null;
  districtMeterTr003PowerKw?: number | null;
  districtMeterTr003SupplyTempC?: number | null;
  districtMeterTr003ReturnTempC?: number | null;
  districtTr002PumpObserved?: boolean;
  districtTr003PumpObserved?: boolean;
  districtTr002PumpMatch?: boolean;
  districtTr003PumpMatch?: boolean;
  ventilationSfp?: number | null;
  systemPlantMode?: number | null;
  heatRecoveryRotationGuardRaw?: number | null;
  pumpHeatingMalfunctionActive?: boolean;
  pumpCoolingMalfunctionActive?: boolean;
};

export type MpcReplayResult = {
  steps: MpcReplayStep[];
  summary: {
    stepCount: number;
    fallbackSteps: number;
    optimizedSteps: number;
    optimizableSteps: number;
    optimizablePct: number;
    fallbackPct: number;
    fallbackByReason: import("@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity").MpcFallbackByReason;
    skippedSteps: number;
    comfortViolationsMpc: number;
    comfortViolationsBaseline: number;
    comfortViolationsEmulated: number;
    comfortViolationsDemand: number;
    comfortViolationsObservedProxy?: number;
    comfortViolationsHarmonizedObserved?: number;
    totalCostBaselineKr: number;
    totalCostEmulatedKr: number;
    totalCostMpcKr: number;
    totalCostDemandKr: number;
    deltaCostDemandKr: number;
    deltaCostDemandPct: number;
    deltaCostKr: number;
    deltaCostPct: number;
    deltaCostVsEmulatedKr: number;
    deltaCostVsEmulatedPct: number;
    peakElectricKwBaseline: number;
    peakElectricKwEmulated: number;
    peakElectricKwMpc: number;
    controllableElectricKwhBaseline: number;
    controllableElectricKwhEmulated: number;
    controllableElectricKwhMpc: number;
    controllableHeatKwhBaseline: number;
    controllableHeatKwhEmulated: number;
    controllableHeatKwhMpc: number;
    controllableElectricKwhDemand: number;
    controllableHeatKwhDemand: number;
    peakElectricKwDemand: number;
    meaningfulDeltaSteps?: number;
    meaningfulDeltaPct?: number;
    mpcVsObservedDeltaSteps?: number;
    mpcVsObservedDeltaPct?: number;
    mpcVsObservedEligibleSteps?: number;
    heatingActiveStepPct?: number;
    measuredTr003HeatKwh?: number;
    policySummaries?: import("@/lib/sd-anlegg/mpc/controller/policies/types").PolicySummaryKpi[];
  };
  /** Plant-/solver-tilstand etter siste behandlede steg (batch-resume). */
  endState?: import("@/lib/sd-anlegg/control/mpc-simulation-checkpoint").MpcReplayLoopState;
};

export type MpcPipelineResult = {
  evalStart: string;
  evalEnd: string;
  stepCount: number;
  calibration: MpcCalibrationBundle;
  emulatorValidation: EmulatorValidationMetrics;
  plantValidation: PlantValidationMetrics;
  replay: MpcReplayResult;
  hourlyEnergy: ControlHourlyEnergy[];
  preferencesSnapshot?: import("@/lib/sd-anlegg/mpc/config/mpc-building-preferences").MpcPreferencesSnapshot | null;
};

export type EvalDatasetProvenance = {
  /** Eval-datasett bygges fra Postgres — aldri direkte fra Influx i replay-løkka. */
  primarySource: "postgres";
  tables: {
    infraspawnBacnetSample: { rowCount: number; latestSampleAt: string | null };
    weatherObservation: { rowCount: number };
    hourlyEnergyPrices: { rowCount: number };
    buildingHourlyCostCache: { rowCount: number };
    infraspawnAlarmEvent: { rowCount: number };
  };
  gapFillApplied: boolean;
};

export type EvalDataset = {
  buildingId: string;
  sourceId: string;
  evalStart: string;
  evalEnd: string;
  steps: MpcTimestep[];
  coverage: {
    stepCount: number;
    stepsWithUMeas: number;
    stepsOptimizable: number;
    optimizablePct: number;
    stepsWithExtractTemp: number;
    stepsWithOutdoorTemp: number;
    stepsWithOutdoorTempBms?: number;
    stepsWithPrice: number;
  };
  provenance: EvalDatasetProvenance;
};
