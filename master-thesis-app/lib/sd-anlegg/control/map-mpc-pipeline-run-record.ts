import type { MpcEnergyReconcileSummary } from "./build-mpc-energy-reconcile";
import type {
  MpcPipelineRunRecord,
  MpcPipelineSnapshot,
  MpcSignalComparison,
} from "./control-types";
import type { PolicySummaryKpi } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import type {
  MpcCalibrationBundle,
  MpcReplayStep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import { parsePersistedCalibrationPayload } from "./build-mpc-pipeline-run-scalars";
import { buildMpcSignalComparison } from "./build-mpc-signal-comparison";
import { summarizeMpcReplaySteps } from "./summarize-mpc-replay-steps";
import {
  shouldUseReplayStepsForSummary,
} from "./resolve-replay-summary";

export type MpcPipelineRunRow = {
  id: string;
  modelVersion: string;
  evalStart: Date;
  evalEnd: Date;
  stepCount: number;
  trainStepCount: number;
  holdoutStepCount: number;
  calibration: unknown;
  createdAt: Date;
  totalCostBaselineKr?: number | null;
  totalCostEmulatedKr?: number | null;
  totalCostMpcKr?: number | null;
  totalCostDemandKr?: number | null;
  deltaCostKr?: number | null;
  deltaCostPct?: number | null;
  deltaCostVsEmulatedKr?: number | null;
  deltaCostVsEmulatedPct?: number | null;
  controllableElectricKwhBaseline?: number | null;
  controllableElectricKwhEmulated?: number | null;
  controllableElectricKwhMpc?: number | null;
  controllableHeatKwhBaseline?: number | null;
  controllableHeatKwhEmulated?: number | null;
  controllableHeatKwhMpc?: number | null;
  peakElectricKwBaseline?: number | null;
  peakElectricKwEmulated?: number | null;
  peakElectricKwMpc?: number | null;
  fallbackSteps?: number | null;
  optimizablePct?: number | null;
  meaningfulDeltaPct?: number | null;
  plantRmseC?: number | null;
  emulatorMaeSupplySetpointC?: number | null;
  comfortViolationsMpc?: number | null;
  comfortViolationsBaseline?: number | null;
  comfortViolationsEmulated?: number | null;
  comfortViolationsDemand?: number | null;
  comfortViolationsObservedProxy?: number | null;
  comfortViolationsHarmonizedObserved?: number | null;
  measuredElectricityKwh?: number | null;
  measuredDistrictHeatingKwh?: number | null;
  measuredTotalCostKr?: number | null;
  proxyEmulatedCostKr?: number | null;
  proxyMpcCostKr?: number | null;
  deltaMpcVsEmulatedCostKr?: number | null;
  deltaMpcVsEmulatedCostPct?: number | null;
  persistStatus?: string | null;
  chartsGeneratedAt?: Date | null;
};

function energyReconcileSummaryFromRowScalars(
  row: MpcPipelineRunRow,
  calibration?: MpcCalibrationBundle | null,
): MpcEnergyReconcileSummary | null {
  if (row.measuredTotalCostKr == null || row.measuredTotalCostKr <= 0) {
    return null;
  }
  const elBaseline = row.controllableElectricKwhBaseline ?? 0;
  const elEmulated = row.controllableElectricKwhEmulated ?? elBaseline;
  const elMpc = row.controllableElectricKwhMpc ?? elEmulated;
  const heatBaseline = row.controllableHeatKwhBaseline ?? 0;
  const heatEmulated = row.controllableHeatKwhEmulated ?? heatBaseline;
  const heatMpc = row.controllableHeatKwhMpc ?? heatEmulated;
  const costObserved = row.totalCostBaselineKr ?? row.proxyEmulatedCostKr ?? 0;
  const costEmulated = row.totalCostEmulatedKr ?? row.proxyEmulatedCostKr ?? costObserved;
  const costMpc = row.totalCostMpcKr ?? row.proxyMpcCostKr ?? costEmulated;
  const measuredEl = row.measuredElectricityKwh ?? 0;
  const measuredHeat = row.measuredDistrictHeatingKwh ?? 0;
  const proxyElShare =
    measuredEl > 0 && elBaseline > 0 ? (elBaseline / measuredEl) * 100 : null;
  const proxyHeatShare =
    measuredHeat > 0 && heatBaseline > 0 ? (heatBaseline / measuredHeat) * 100 : null;
  const calibratedElShare = calibration?.power.controllableElectricShare ?? null;
  const calibratedHeatShare = calibration?.power.controllableHeatShare ?? null;

  return {
    evalStart: row.evalStart.toISOString(),
    evalEnd: row.evalEnd.toISOString(),
    hoursAligned: Math.max(1, Math.ceil(row.stepCount / 4)),
    measured: {
      electricityKwh: measuredEl,
      districtHeatingKwh: measuredHeat,
      totalCostKr: row.measuredTotalCostKr,
      hours: Math.max(1, Math.ceil(row.stepCount / 4)),
    },
    proxy: {
      observed: {
        elKwh: elBaseline,
        heatKwh: heatBaseline,
        costKr: costObserved,
      },
      emulated: {
        elKwh: elEmulated,
        heatKwh: heatEmulated,
        costKr: costEmulated,
      },
      mpc: {
        elKwh: elMpc,
        heatKwh: heatMpc,
        costKr: costMpc,
      },
    },
    shares: {
      controllableElectricShare: calibratedElShare ?? (proxyElShare != null ? proxyElShare / 100 : 0),
      controllableHeatShare: calibratedHeatShare ?? (proxyHeatShare != null ? proxyHeatShare / 100 : 0),
      proxyElectricShareOfMeasured: proxyElShare,
      proxyHeatShareOfMeasured: proxyHeatShare,
      proxyHeatShareOfCircuit: null,
      heatGroundTruth: "none",
    },
    deltaMpcVsEmulated: {
      costKr: row.deltaMpcVsEmulatedCostKr ?? row.deltaCostVsEmulatedKr ?? 0,
      costPct: row.deltaMpcVsEmulatedCostPct ?? row.deltaCostVsEmulatedPct ?? 0,
      elKwh: elMpc - elEmulated,
      heatKwh: heatMpc - heatEmulated,
    },
    districtDeltaT: [],
    heatingDemand: {
      activeSteps: 0,
      activeStepPct: 0,
      observed: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
      emulated: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
      mpc: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
      demand: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
      tr003: {
        fromPowerIntegralKwh: 0,
        fromEnergyMeterKwh: 0,
        groundTruthKwh: 0,
        source: "none",
      },
    },
  };
}

function replayStepsLackComfortBands(steps: readonly MpcReplayStep[]): boolean {
  return (
    steps.length > 0 &&
    steps.some((s) => s.comfortBandMinC == null || s.comfortBandMaxC == null)
  );
}

function applyPersistedComfortScalars(
  summary: MpcPipelineSnapshot["replaySummary"],
  row: MpcPipelineRunRow,
): void {
  if (row.comfortViolationsMpc != null) {
    summary.comfortViolationsMpc = row.comfortViolationsMpc;
  }
  if (row.comfortViolationsBaseline != null) {
    summary.comfortViolationsBaseline = row.comfortViolationsBaseline;
  }
  if (row.comfortViolationsEmulated != null) {
    summary.comfortViolationsEmulated = row.comfortViolationsEmulated;
  }
  if (row.comfortViolationsDemand != null) {
    summary.comfortViolationsDemand = row.comfortViolationsDemand;
  }
  if (row.comfortViolationsObservedProxy != null) {
    summary.comfortViolationsObservedProxy = row.comfortViolationsObservedProxy;
  }
  if (row.comfortViolationsHarmonizedObserved != null) {
    summary.comfortViolationsHarmonizedObserved =
      row.comfortViolationsHarmonizedObserved;
  }
}

function replaySummaryFromScalars(
  row: MpcPipelineRunRow,
  policySummaries: PolicySummaryKpi[] = [],
): MpcPipelineSnapshot["replaySummary"] {
  const stepCount = row.stepCount;
  const fallbackSteps = row.fallbackSteps ?? 0;
  return {
    stepCount,
    fallbackSteps,
    fallbackPct:
      stepCount > 0
        ? Math.round((fallbackSteps / stepCount) * 1000) / 1000
        : 0,
    comfortViolationsMpc: row.comfortViolationsMpc ?? 0,
    comfortViolationsBaseline: row.comfortViolationsBaseline ?? row.comfortViolationsObservedProxy ?? 0,
    comfortViolationsEmulated: row.comfortViolationsEmulated ?? undefined,
    comfortViolationsDemand: row.comfortViolationsDemand ?? undefined,
    comfortViolationsObservedProxy: row.comfortViolationsObservedProxy ?? row.comfortViolationsBaseline ?? undefined,
    comfortViolationsHarmonizedObserved: row.comfortViolationsHarmonizedObserved ?? undefined,
    totalCostBaselineKr: row.totalCostBaselineKr ?? 0,
    totalCostEmulatedKr: row.totalCostEmulatedKr ?? undefined,
    totalCostMpcKr: row.totalCostMpcKr ?? 0,
    totalCostDemandKr: row.totalCostDemandKr ?? undefined,
    deltaCostKr: row.deltaCostKr ?? 0,
    deltaCostPct: row.deltaCostPct ?? 0,
    deltaCostVsEmulatedKr: row.deltaCostVsEmulatedKr ?? undefined,
    deltaCostVsEmulatedPct: row.deltaCostVsEmulatedPct ?? undefined,
    peakElectricKwBaseline: row.peakElectricKwBaseline ?? 0,
    peakElectricKwEmulated: row.peakElectricKwEmulated ?? undefined,
    peakElectricKwMpc: row.peakElectricKwMpc ?? 0,
    controllableElectricKwhBaseline: row.controllableElectricKwhBaseline ?? 0,
    controllableElectricKwhEmulated: row.controllableElectricKwhEmulated ?? undefined,
    controllableElectricKwhMpc: row.controllableElectricKwhMpc ?? 0,
    controllableHeatKwhBaseline: row.controllableHeatKwhBaseline ?? 0,
    controllableHeatKwhEmulated: row.controllableHeatKwhEmulated ?? undefined,
    controllableHeatKwhMpc: row.controllableHeatKwhMpc ?? 0,
    meaningfulDeltaPct: row.meaningfulDeltaPct ?? undefined,
    meaningfulDeltaSteps:
      row.meaningfulDeltaPct != null && stepCount > 0
        ? Math.round((row.meaningfulDeltaPct / 100) * stepCount)
        : undefined,
    optimizablePct: row.optimizablePct ?? undefined,
    policySummaries,
  };
}

export function buildSnapshotFromRunRow(
  row: MpcPipelineRunRow,
  policySummaries: PolicySummaryKpi[] = [],
): MpcPipelineSnapshot {
  const { emulatorValidation, plantValidation } =
    parsePersistedCalibrationPayload(row.calibration);

  const defaultEmulator: MpcPipelineSnapshot["emulatorValidation"] = {
    comparedSteps: emulatorValidation?.comparedSteps ?? 0,
    mae: {
      supplySetpointC:
        emulatorValidation?.mae.supplySetpointC ??
        row.emulatorMaeSupplySetpointC ??
        0,
      supplyFanPct: emulatorValidation?.mae.supplyFanPct ?? 0,
      exhaustFanPct: emulatorValidation?.mae.exhaustFanPct ?? 0,
      heatingValvePct: emulatorValidation?.mae.heatingValvePct ?? 0,
      coolingValvePct: emulatorValidation?.mae.coolingValvePct ?? 0,
    },
    heatingModeAccuracy: emulatorValidation?.heatingModeAccuracy ?? 0,
    coolingModeAccuracy: emulatorValidation?.coolingModeAccuracy ?? 0,
  };

  const defaultPlant: MpcPipelineSnapshot["plantValidation"] = {
    comparedSteps: plantValidation?.comparedSteps ?? 0,
    maeC: plantValidation?.maeC ?? 0,
    rmseC: plantValidation?.rmseC ?? row.plantRmseC ?? 0,
    multiStep: plantValidation?.multiStep,
    featureScope: plantValidation?.featureScope,
    heatRecoveryState: plantValidation?.heatRecoveryState,
  };

  return {
    modelVersion: row.modelVersion,
    evalStart: row.evalStart.toISOString(),
    evalEnd: row.evalEnd.toISOString(),
    stepCount: row.stepCount,
    trainStepCount: row.trainStepCount,
    holdoutStepCount: row.holdoutStepCount,
    emulatorValidation: defaultEmulator,
    plantValidation: defaultPlant,
    replaySummary: replaySummaryFromScalars(row, policySummaries),
    policySummaries,
  };
}

export function mapMpcPipelineRunRecord(
  row: MpcPipelineRunRow,
  replaySteps: readonly MpcReplayStep[] = [],
  options?: {
    stepComparison?: MpcSignalComparison | null;
    policySummaries?: PolicySummaryKpi[];
  },
): MpcPipelineRunRecord {
  const { calibration } = parsePersistedCalibrationPayload(row.calibration);
  const policySummaries = options?.policySummaries ?? [];
  const recomputedSummary =
    replaySteps.length > 0 &&
    shouldUseReplayStepsForSummary(replaySteps.length, row.stepCount)
      ? summarizeMpcReplaySteps(replaySteps)
      : null;
  const snapshot = buildSnapshotFromRunRow(
    row,
    recomputedSummary?.policySummaries ?? policySummaries,
  );
  if (recomputedSummary) {
    if (replayStepsLackComfortBands(replaySteps)) {
      applyPersistedComfortScalars(recomputedSummary, row);
    }
    snapshot.replaySummary = recomputedSummary;
  }
  const signalComparison =
    replaySteps.length > 0
      ? buildMpcSignalComparison(replaySteps)
      : { stepCount: 0, stepMinutes: 15 as const, series: [], defaultSeriesId: null };

  return {
    id: row.id,
    modelVersion: row.modelVersion,
    evalStart: row.evalStart.toISOString(),
    evalEnd: row.evalEnd.toISOString(),
    stepCount: row.stepCount,
    trainStepCount: row.trainStepCount,
    holdoutStepCount: row.holdoutStepCount,
    createdAt: row.createdAt.toISOString(),
    snapshot,
    signalComparison,
    stepComparison: options?.stepComparison ?? null,
    calibration,
    replaySteps: [...replaySteps],
    energyReconcileSummary: energyReconcileSummaryFromRowScalars(row, calibration),
    persistStatus: row.persistStatus ?? null,
    chartsGeneratedAt: row.chartsGeneratedAt?.toISOString() ?? null,
  };
}

export const mpcPipelineRunScalarSelect = {
  id: true,
  modelVersion: true,
  evalStart: true,
  evalEnd: true,
  stepCount: true,
  trainStepCount: true,
  holdoutStepCount: true,
  calibration: true,
  createdAt: true,
  totalCostBaselineKr: true,
  totalCostEmulatedKr: true,
  totalCostMpcKr: true,
  totalCostDemandKr: true,
  deltaCostKr: true,
  deltaCostPct: true,
  deltaCostVsEmulatedKr: true,
  deltaCostVsEmulatedPct: true,
  controllableElectricKwhBaseline: true,
  controllableElectricKwhEmulated: true,
  controllableElectricKwhMpc: true,
  controllableHeatKwhBaseline: true,
  controllableHeatKwhEmulated: true,
  controllableHeatKwhMpc: true,
  peakElectricKwBaseline: true,
  peakElectricKwEmulated: true,
  peakElectricKwMpc: true,
  fallbackSteps: true,
  optimizablePct: true,
  meaningfulDeltaPct: true,
  plantRmseC: true,
  emulatorMaeSupplySetpointC: true,
  comfortViolationsMpc: true,
  comfortViolationsBaseline: true,
  comfortViolationsEmulated: true,
  comfortViolationsDemand: true,
  comfortViolationsObservedProxy: true,
  comfortViolationsHarmonizedObserved: true,
  measuredElectricityKwh: true,
  measuredDistrictHeatingKwh: true,
  measuredTotalCostKr: true,
  proxyEmulatedCostKr: true,
  proxyMpcCostKr: true,
  deltaMpcVsEmulatedCostKr: true,
  deltaMpcVsEmulatedCostPct: true,
  chartsGeneratedAt: true,
  persistStatus: true,
  persistedStepCount: true,
  persistError: true,
  uiArtifacts: true,
} as const;
