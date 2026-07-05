import type { PolicySummaryKpi } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import type {
  MpcCalibrationBundle,
  MpcReplayStep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcEnergyReconcileSummary } from "./build-mpc-energy-reconcile";

/** Offline snapshot fra mpc-v1 pipeline — JSON boundary types. */
export type MpcPipelineSnapshot = {
  modelVersion: string;
  evalStart: string;
  evalEnd: string;
  stepCount: number;
  trainStepCount: number;
  holdoutStepCount: number;
  emulatorValidation: {
    comparedSteps: number;
    mae: {
      supplySetpointC: number;
      supplyFanPct: number;
      exhaustFanPct: number;
      heatingValvePct: number;
      coolingValvePct: number;
    };
    heatingModeAccuracy: number;
    coolingModeAccuracy: number;
  };
  plantValidation: {
    comparedSteps: number;
    maeC: number;
    rmseC: number;
    multiStep?: Array<{
      horizonHours: number;
      horizonSteps: number;
      comparedStarts: number;
      maeC: number;
      rmseC: number;
    }>;
    featureScope?: Array<{
      featureId: string;
      label: string;
      category: string;
      availability: string;
      usedInModel: boolean;
      coveragePct: number | null;
    }>;
    /** Andre RC-tilstand (plant-v2) — validering av varmegjenvinner etter-temp. */
    heatRecoveryState?: {
      comparedSteps: number;
      maeC: number;
      rmseC: number;
    } | null;
  };
  replaySummary: {
    stepCount: number;
    fallbackSteps: number;
    optimizedSteps?: number;
    optimizableSteps?: number;
    optimizablePct?: number;
    fallbackPct?: number;
    fallbackByReason?: {
      missing_u_meas: number;
      simultaneous_heat_cool: number;
      alarm: number;
      pump_fault: number;
    };
    skippedSteps?: number;
    comfortViolationsMpc: number;
    comfortViolationsBaseline: number;
    comfortViolationsEmulated?: number;
    comfortViolationsDemand?: number;
    comfortViolationsObservedProxy?: number;
    comfortViolationsHarmonizedObserved?: number;
    totalCostBaselineKr: number;
    totalCostEmulatedKr?: number;
    totalCostMpcKr: number;
    totalCostDemandKr?: number;
    deltaCostDemandKr?: number;
    deltaCostDemandPct?: number;
    deltaCostKr: number;
    deltaCostPct: number;
    deltaCostVsEmulatedKr?: number;
    deltaCostVsEmulatedPct?: number;
    peakElectricKwBaseline: number;
    peakElectricKwEmulated?: number;
    peakElectricKwMpc: number;
    peakElectricKwDemand?: number;
    controllableElectricKwhBaseline: number;
    controllableElectricKwhEmulated?: number;
    controllableElectricKwhMpc: number;
    controllableElectricKwhDemand?: number;
    controllableHeatKwhBaseline: number;
    controllableHeatKwhEmulated?: number;
    controllableHeatKwhMpc: number;
    controllableHeatKwhDemand?: number;
    meaningfulDeltaSteps?: number;
    meaningfulDeltaPct?: number;
    mpcVsObservedDeltaSteps?: number;
    mpcVsObservedDeltaPct?: number;
    mpcVsObservedEligibleSteps?: number;
    heatingActiveStepPct?: number;
    measuredTr003HeatKwh?: number;
    policySummaries?: PolicySummaryKpi[];
  };
  policySummaries?: PolicySummaryKpi[];
};

export type MpcSignalComparisonPoint = {
  hour: string;
  observed: number | null;
  emulated: number | null;
  mpc: number | null;
  reference?: number | null;
  deltaCostKr?: number | null;
};

export type MpcSignalComparisonSeries = {
  id: string;
  label: string;
  tabLabel: string;
  unit: string;
  chartVariant?: "policy" | "observed" | "observed_with_reference";
  referenceLabel?: string;
  points: MpcSignalComparisonPoint[];
  summary: {
    sampleHours: number;
    meanAbsErrorObservedVsMpc: number | null;
    meanAbsErrorObservedVsEmulated: number | null;
    /** Gj.sn. |simulert MPC − forventet BMS| — optimizer-aktivitet. */
    meanAbsErrorMpcVsEmulated: number | null;
    hoursWithMpcDeviation: number;
    /** Steg der |MPC − forventet BMS| > terskel etter normalisert oppløsning. */
    stepsWithMpcVsEmulatedDelta: number;
  };
};

export type MpcSignalComparison = {
  stepCount: number;
  stepMinutes: 1 | 5 | 15 | 60;
  series: MpcSignalComparisonSeries[];
  defaultSeriesId: string | null;
  totalDeltaCostKr?: number | null;
  totalDeltaCostVsObservedKr?: number | null;
};

export type MpcPipelineRunRecord = {
  id: string;
  modelVersion: string;
  evalStart: string;
  evalEnd: string;
  stepCount: number;
  trainStepCount: number;
  holdoutStepCount: number;
  createdAt: string;
  snapshot: MpcPipelineSnapshot;
  signalComparison: MpcSignalComparison;
  stepComparison?: MpcSignalComparison | null;
  calibration: MpcCalibrationBundle | null;
  replaySteps: MpcReplayStep[];
  energyReconcileSummary?: MpcEnergyReconcileSummary | null;
  persistStatus?: string | null;
  chartsGeneratedAt?: string | null;
};
