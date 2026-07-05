import type {
  ControlTickHistoryEntry,
  ControlTickState,
  LiveForwardPlans,
  MpcForwardPlan,
} from "./control-types-live";
import type {
  MpcPipelineRunRecord,
  MpcPipelineSnapshot,
  MpcSignalComparison,
} from "./control-types-mpc";
import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import type { ControlPeriodMode } from "./resolve-control-lookback";
import type { ControlSignalSeriesLoadResult } from "./load-control-signal-series";
import type { ReplaySignalSummary } from "./summarize-replay-signals";
import type { PriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import type { MpcSimulationProgress } from "./mpc-simulation-progress";
import type { ResolvedMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import type { MpcSimulationReadiness } from "@/services/mpc/assess-mpc-simulation-readiness";
import type {
  EvalDatasetProvenance,
  MpcControlVector,
  MpcReplayResult,
  MpcReplayStep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type LiveMpcWindowMeta = {
  lookbackDays: number;
  evalStart: string;
  evalEnd: string;
  replayStepCount: number;
  backfillProgressPct: number | null;
  partialBackfill: boolean;
};

export type ControlSubsystem =
  | "ventilation"
  | "heating"
  | "cooling"
  | "district_heating"
  | "temperature"
  | "energy"
  | "system";

export type ControlSignalKind =
  | "control"
  | "measured_state"
  | "derived_state"
  | "disturbance"
  | "constraint"
  | "objective";

export type ControlSignalAvailability =
  | "available"
  | "missing"
  | "expected_missing";

export type ControlCatalogEntry = {
  canonicalId: string;
  label: string;
  subsystem: ControlSubsystem;
  kind: ControlSignalKind;
  influxPatterns: readonly string[];
  equipmentTagPatterns?: readonly string[];
  /** Forventes i anlegget men ofte ikke eksportert til SD — vises som modellhull. */
  expectedMissing?: boolean;
};

export type ResolvedControlSignal = {
  catalog: ControlCatalogEntry;
  availability: ControlSignalAvailability;
  point?: InfraspawnPointListItem;
  lastValue: number | null;
  lastSampledAt: string | null;
};

export type ControlPlantSubsystem = {
  id: ControlSubsystem;
  label: string;
  controls: ResolvedControlSignal[];
  states: ResolvedControlSignal[];
  constraints: ResolvedControlSignal[];
};

export type ControlDataQuality = {
  sdPointCount: number;
  catalogCoveragePct: number;
  energyHourCount: number;
  weatherHourCount: number;
  priceHourCount: number;
  historyDays: number;
  missingCritical: string[];
  warnings: string[];
};

export type ControlPlantModel = {
  buildingId: string;
  buildingName: string;
  unitKey: string;
  subsystems: ControlPlantSubsystem[];
  dataQuality: ControlDataQuality;
};

export type ControlHourlyEnergy = {
  hour: string;
  electricityKwh: number;
  electricityCostKr: number;
  districtHeatingKwh: number;
  districtHeatingCostKr: number;
  totalCostKr: number;
};

export type ControlHourlyWeather = {
  hour: string;
  outdoorTempC: number | null;
};

export type ControlHourlyPrice = {
  hour: string;
  spotKrPerKwh: number | null;
  /** Spot + nettleie energiledd + forbruksavgift (marginal). */
  effectiveMarginalKrPerKwh?: number | null;
  /** Spot fra publisert day-ahead i databasen. */
  isDayAheadSpot?: boolean;
};

export type ControlImprovementSeverity = "info" | "warning" | "opportunity";

export type ControlImprovementPoint = {
  id: string;
  label: string;
  detail: string;
  hourSpan: string | null;
  severity: ControlImprovementSeverity;
  sampleHours: number;
};

export type ControlEffectSummary = {
  baselineKwh: number;
  baselineCostKr: number;
  scopedKwh: number;
  scopedCostKr: number;
  deltaKwh: number;
  deltaCostKr: number;
  deltaPctKwh: number;
  deltaPctCostKr: number;
};

export type ControlForwardPlanHour = {
  hour: string;
  spotKrPerKwh: number | null;
  effectiveMarginalKrPerKwh: number | null;
  outdoorTempC: number | null;
  gjeldendeProfile: ControlSdHourlyProfile | null;
  scopedProfile: ControlSdHourlyProfile | null;
  expectedDeltaKwh: number | null;
  expectedDeltaCostKr: number | null;
};

export type ControlForwardPlan = {
  horizonHours: number;
  planHours: ControlForwardPlanHour[];
  effect: ControlEffectSummary;
  weatherSource: "met_locationforecast" | "frost_hour_of_day" | "unavailable";
  dayAheadHourCount: number;
};

export type ControlReconcileSummary = {
  comparedHours: number;
  meanAbsErrorSetpoint: number | null;
  meanAbsErrorFan: number | null;
  hoursWithDeviation: number;
};

/** @deprecated Scenario-basert modell — arkivert sammen med scoped-v1 cron */
export type ControlScenarioId =
  | "baseline"
  | "price_aware_temperature"
  | "night_ventilation_trim"
  | "mpc_weather_price_48h";

export type ControlScenarioResult = {
  id: ControlScenarioId;
  label: string;
  description: string;
  totalKwh: number;
  totalCostKr: number;
  deltaKwh: number;
  deltaCostKr: number;
  deltaPctKwh: number;
  deltaPctCostKr: number;
  comfortProxyHoursOutOfBand: number;
  explanation: string[];
  blockedByConstraints: boolean;
};

export type ControlMpcForecastPoint = {
  hour: string;
  outdoorTempC: number | null;
  spotKrPerKwh: number | null;
};

export type ControlMpcOutlook = {
  projectedHours: number;
  baselineCostKr: number;
  optimizedCostKr: number;
  deltaCostKr: number;
  deltaPctCostKr: number;
  forecastPoints: ControlMpcForecastPoint[];
  weatherSource: "met_locationforecast" | "frost_hour_of_day" | "unavailable";
};

export type ControlLoadHourPoint = {
  hour: string;
  /** Snitt el-effekt (kW) — emulert BMS, for graf. */
  actualKw: number | null;
  /** Snitt el-effekt (kW) — simulert MPC, for graf. */
  simulatedKw?: number | null;
  /** Snitt el-effekt (kW) — observert pådrag (uBmsMeas). */
  observedKw?: number | null;
  /** Maks el-effekt (kW) i timen — for effekttariff. */
  peakObservedKw?: number | null;
  peakEmulatedKw?: number | null;
  peakMpcKw?: number | null;
  costKr: number;
  spotKrPerKwh: number | null;
};

export type ControlDataCoverage = {
  lookbackHours: number;
  lookbackDays: number;
  energyHours: number;
  sdSignalHours: number;
  weatherHours: number;
  priceHours: number;
  sdSignalCoveragePct: number;
  /** Når SD-timer < valgt periode. */
  sdCoverageNote: string | null;
};

export type ControlPeakAnalysis = {
  actualPeakKw: number;
  actualPeakHour: string;
  simulatedPeakKw: number | null;
  peakDeltaKw: number | null;
  peakDeltaPct: number | null;
};

export type ControlSignalImpact = {
  signalKey: string;
  label: string;
  unit: string;
  sampleHours: number;
  correlationKwh: number | null;
  correlationCostKr: number | null;
};

export type ControlComparisonKind =
  | "setpoint_vs_measured"
  | "setpoint_vs_calc"
  | "gjeldende_vs_scoped";

/** @deprecated */
export type ControlComparisonKindLegacy =
  | ControlComparisonKind
  | "actual_vs_simulated";

export type ControlComparisonPoint = {
  hour: string;
  primary: number | null;
  secondary: number | null;
  /** Estimert kost-delta for 15-min steg (shadow vs observert). */
  deltaCostKr?: number | null;
};

export type ControlShadowAdjustments = {
  supplySetpointDeltaC: number;
  supplyFanFactor: number;
  exhaustFanFactor: number;
  heatingValveFactor: number;
  coolingValveFactor: number;
};

export type ControlLiveSignalSnapshot = {
  stepIso: string;
  sd: {
    supplySetpointC?: number;
    supplyFanPct?: number;
    exhaustFanPct?: number;
    heatingValvePct?: number;
  };
  shadow: {
    supplySetpointC?: number;
    supplyFanPct?: number;
    exhaustFanPct?: number;
    heatingValvePct?: number;
  };
  deltaCostKrQuarter: number | null;
};

export type ControlComparisonSeries = {
  id: string;
  label: string;
  tabLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  unit: string;
  kind: ControlComparisonKind;
  points: ControlComparisonPoint[];
  summary: {
    sampleHours: number;
    meanAbsError: number | null;
    maxAbsError: number | null;
    hoursWithDeviation: number;
  };
};

export type ControlSignalComparison = {
  adjustedControlHours: number;
  series: ControlComparisonSeries[];
  defaultSeriesId: string | null;
  /** 15 = kvartalsvis SD, 60 = timevis fallback */
  stepMinutes: 1 | 5 | 15 | 60;
  totalDeltaCostKr: number | null;
};

/** @deprecated */
export type ControlSignalComparisonLegacy = ControlSignalComparison & {
  recommendedScenarioId: ControlScenarioId;
  recommendedScenarioLabel: string;
};

export type ControlLoopNodeRole =
  | "disturbance"
  | "setpoint"
  | "controller"
  | "actuator"
  | "plant"
  | "sensor"
  | "simulatedMpc";

export type ControlLoopNode = {
  id: string;
  label: string;
  role: ControlLoopNodeRole;
  canonicalId?: string;
  value: string | null;
  available: boolean;
  x: number;
  y: number;
};

export type ControlLoopEdge = {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
};

export type ControlLoopDiagram = {
  unitKey: string;
  nodes: ControlLoopNode[];
  edges: ControlLoopEdge[];
};

export type ControlRecommendationNarrative = {
  headline: string;
  summary: string;
  actions: Array<{ label: string; detail: string }>;
  savings: { costKr: number; pct: number } | null;
  shadowModeNote: string;
};

export type ControlDailyLoadPoint = {
  day: string;
  totalKwh: number;
  totalCostKr: number;
  peakKw: number;
};

export type ControlRunTrackingPoint = {
  runId: string;
  createdAt: string;
  predictedDeltaPctCostKr: number | null;
  actualDeltaPctCostKr: number | null;
  actualPeakKw: number | null;
  recommendedScenarioId: string;
  modelVersion: string;
};

export type ControlSimulationRunRecord = {
  id: string;
  createdAt: string;
  horizonHours: number;
  modelVersion: string;
  recommendedScenarioId: string;
  recommendedSummary: {
    label?: string;
    deltaPctCostKr?: number;
    deltaPctKwh?: number;
    deltaCostKr?: number;
  };
  baselineSummary: {
    totalCostKr?: number;
    totalKwh?: number;
  };
  sdSignalCoveragePct: number | null;
  metadata: Record<string, unknown> | null;
};

export type ControlTrackingSummary = {
  points: ControlRunTrackingPoint[];
  comparedRuns: number;
  meanAbsErrorPct: number | null;
  dailyLoad: ControlDailyLoadPoint[];
};

/** Offline snapshot fra `bun run mpc-simulation` (data/simulation/). */
export type {
  MpcPipelineRunRecord,
  MpcPipelineSnapshot,
  MpcSignalComparison,
  MpcSignalComparisonPoint,
  MpcSignalComparisonSeries,
} from "./control-types-mpc";

export type {
  ControlPlanDiff,
  ControlTickHistoryEntry,
  ControlTickState,
  ControlTickTriggerAssessment,
  ControlTickTriggerReason,
  LiveForwardPlans,
  MpcForwardPlan,
  MpcForwardPlanStep,
} from "./control-types-live";

export type MpcHourTableRow = {
  hour: string;
  observedCostKr: number;
  emulatedCostKr: number;
  mpcCostKr: number;
  deltaCostKr: number;
};

export type ThesisEvalPeriod = {
  evalStart: string;
  /** Live eval-slutt for UI (SD/coverage, cap til nå). */
  evalEnd: string;
  /** Slutt på siste lagrede pipeline-run — kan ligge bak evalEnd. */
  evalEndSnapshot?: string | null;
  periodEnd?: string | null;
  /** Forventede 15-min intervaller i eval-vinduet. */
  stepCount: number;
  /** Persisterte replay-steg i DB. */
  replayStepCount?: number | null;
  /** Eval SD strekker seg forbi lagret replay. */
  replayBehindEval?: boolean;
  source: "db" | "file" | null;
  mpcRunId?: string | null;
};

export type MpcEvalCoverageSignal = {
  canonicalId: string;
  sampleStepCount: number;
  coveragePct: number;
};

export type MpcEvalCoveragePlantSignal = {
  canonicalId: string;
  sampleBucketCount: number;
  expectedBucketCount: number;
  coveragePct: number;
};

export type MpcEvalCoverageSummary = {
  evalStart: string;
  evalEnd: string;
  stepCount: number;
  stepsWithUMeas: number;
  stepsOptimizable: number;
  optimizablePct: number;
  uMeasPct: number;
  extractTempPct: number;
  thresholdPct: number;
  needsMpcBackfill: boolean;
  needsPlantBackfill: boolean;
  needsSampleRefresh: boolean;
  needsBackfill: boolean;
  missingCanonicals: string[];
  resolvedSignalCount: number;
  signals: MpcEvalCoverageSignal[];
  plantMirrorCoveragePct: number;
  plantMirrorStart: string;
  plantMirrorEnd: string;
  plantSignals: MpcEvalCoveragePlantSignal[];
  canSimulate: boolean;
  blockReason?: string | null;
  /** Eval starter før Influx kan nås (~2 d). Eldre steg må finnes i Postgres. */
  evalBeyondInfluxLookback: boolean;
  influxLookbackHours: number;
  /** Postgres-rad-telling for eval-datasett (replay-kilde). */
  datasetProvenance: EvalDatasetProvenance | null;
};

/** Siste live SD-steg opp mot replay for samme 15-min intervall. */
export type MpcLiveStepSnapshot = {
  stepAt: string;
  sampledAt: string;
  observed: Partial<MpcControlVector> & {
    supplySetpointOperatorC?: number;
    supplySetpointCalcC?: number;
    extractTempC?: number;
    supplyTempC?: number;
  };
  typicalBms: MpcControlVector | null;
  mpc: MpcControlVector | null;
  deltaCostKr: number | null;
  /** Normalisert belegg q ∈ [0,1] for steget. */
  occupancyQ?: number | null;
  /** Kort kontekst (helg, ukedag, helligdag). */
  occupancyLabel?: string | null;
  /** Effektivt komfortband for steget (avtrekk °C). */
  comfortBandMinC?: number | null;
  comfortBandMaxC?: number | null;
  hasMpcDeviation: boolean;
  isLive: boolean;
};

/** Live MPC-shadow: modell + optimizer mot bygg (Methods δu-MPC). */
export type LiveMpcShadowResult = {
  modelVersion: string;
  calibrationSource: "db" | "fitted";
  forwardPlan: MpcForwardPlan;
  recentReplaySteps: MpcReplayStep[];
  replaySummary: MpcReplayResult["summary"] | null;
  signalComparison: MpcSignalComparison;
  plantRmseC: number | null;
  emulatorMaeSupplySetpointC: number | null;
  windowMeta: LiveMpcWindowMeta;
};

export type ControlWorkspaceData = {
  plantModel: ControlPlantModel;
  simulationError: string | null;
  sdSignalCoveragePct: number;
  loadedSdCanonicalIds: string[];
  dataCoverage: ControlDataCoverage;
  lookbackDays: number;
  periodMode: ControlPeriodMode;
  periodLabel: string;
  mpcPipelineSnapshot: MpcPipelineSnapshot | null;
  mpcPipelineRun: MpcPipelineRunRecord | null;
  mpcForwardPlan: MpcForwardPlan | null;
  mpcHourTable: MpcHourTableRow[];
  mpcReplayStepsTail: MpcReplayStep[];
  /** Full eval-replay for Effekt (analyse-mode). */
  mpcReplayStepsFull: MpcReplayStep[];
  mpcReplayRunDisplayMeta: {
    incomplete: boolean;
    persistedStepCount: number;
    expectedStepCount: number;
    canonicalRunId: string | null;
  } | null;
  mpcEvalCoverage: MpcEvalCoverageSummary | null;
  mpcReadiness: MpcSimulationReadiness | null;
  evalPeriod: ThesisEvalPeriod | null;
  backgroundEnsureScheduled: boolean;
  pipelineStatus: import("./resolve-pipeline-status").PipelineStatus;
  mpcBuildingPreferences: ResolvedMpcBuildingPreferences | null;
  mpcPreferencesHasSavedOverrides: boolean;
  controlTickState: ControlTickState | null;
  controlTickHistory: ControlTickHistoryEntry[];
  controlLoopSteps: MpcReplayStep[];
  controlSignalSeries: ControlSignalSeriesLoadResult;
  mpcForwardPlans: LiveForwardPlans | null;
  replaySignalSummary: ReplaySignalSummary | null;
  liveLoopSignalSummary: ReplaySignalSummary | null;
  mpcEnergyReconcile: import("./load-mpc-energy-reconcile").MpcEnergyReconcileBundle | null;
  /** Server-beregnede eval-grafer (full replay — ikke serialisert til klient som 610 steg). */
  mpcEvalCharts: import("./load-mpc-eval-artifacts").MpcEvalChartBundle | null;
  mpcPriceLoadShift: PriceLoadShiftAnalysis | null;
  mpcCapacityTariff: import("./build-capacity-tariff-analysis").CapacityTariffAnalysis | null;
  mpcWorkspaceRevision: string;
  mpcSimulationProgress: MpcSimulationProgress | null;
};
