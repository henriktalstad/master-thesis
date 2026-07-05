import type { Prisma, MpcReplayQuality } from "@/generated/client";
import type { MpcPipelineSnapshot } from "./control-types";
import { resolvePersistedReplayQuality } from "./assess-replay-quality";
import type { PolicySummaryKpi } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import type {
  EmulatorValidationMetrics,
  MpcCalibrationBundle,
  MpcPipelineResult,
  PlantValidationMetrics,
} from "@/lib/sd-anlegg/mpc/shared/types";
import { parseCalibrationFromDb } from "./db-schemas/mpc-calibration";

export type PersistedCalibrationPayload = MpcCalibrationBundle & {
  __pipelineMeta?: {
    emulatorValidation: EmulatorValidationMetrics;
    plantValidation: PlantValidationMetrics;
  };
};

export function buildPersistedCalibrationPayload(
  result: MpcPipelineResult,
): PersistedCalibrationPayload {
  return {
    ...result.calibration,
    __pipelineMeta: {
      emulatorValidation: result.emulatorValidation,
      plantValidation: result.plantValidation,
    },
  };
}

export function parsePersistedCalibrationPayload(
  value: unknown,
): {
  calibration: MpcCalibrationBundle | null;
  emulatorValidation: EmulatorValidationMetrics | null;
  plantValidation: PlantValidationMetrics | null;
  parseIssues?: string[];
} {
  const parsed = parseCalibrationFromDb(value);
  if (!parsed.ok) {
    return {
      calibration: null,
      emulatorValidation: null,
      plantValidation: null,
      parseIssues: parsed.issues,
    };
  }
  return parsed.data;
}

export function buildReplaySummaryFromScalars(input: {
  stepCount: number;
  trainStepCount: number;
  holdoutStepCount: number;
  summary: MpcPipelineResult["replay"]["summary"];
  policySummaries?: PolicySummaryKpi[];
}): MpcPipelineSnapshot["replaySummary"] {
  const s = input.summary;
  return {
    stepCount: input.stepCount,
    fallbackSteps: s.fallbackSteps,
    optimizedSteps: s.optimizedSteps,
    optimizableSteps: s.optimizableSteps,
    optimizablePct: s.optimizablePct,
    fallbackPct: s.fallbackPct,
    fallbackByReason: s.fallbackByReason,
    skippedSteps: s.skippedSteps,
    comfortViolationsMpc: s.comfortViolationsMpc,
    comfortViolationsBaseline: s.comfortViolationsBaseline,
    comfortViolationsEmulated: s.comfortViolationsEmulated,
    comfortViolationsDemand: s.comfortViolationsDemand,
    comfortViolationsObservedProxy:
      s.comfortViolationsObservedProxy ?? s.comfortViolationsBaseline,
    comfortViolationsHarmonizedObserved: s.comfortViolationsHarmonizedObserved,
    totalCostBaselineKr: s.totalCostBaselineKr,
    totalCostEmulatedKr: s.totalCostEmulatedKr,
    totalCostMpcKr: s.totalCostMpcKr,
    totalCostDemandKr: s.totalCostDemandKr,
    deltaCostDemandKr: s.deltaCostDemandKr,
    deltaCostDemandPct: s.deltaCostDemandPct,
    deltaCostKr: s.deltaCostKr,
    deltaCostPct: s.deltaCostPct,
    deltaCostVsEmulatedKr: s.deltaCostVsEmulatedKr,
    deltaCostVsEmulatedPct: s.deltaCostVsEmulatedPct,
    peakElectricKwBaseline: s.peakElectricKwBaseline,
    peakElectricKwEmulated: s.peakElectricKwEmulated,
    peakElectricKwMpc: s.peakElectricKwMpc,
    peakElectricKwDemand: s.peakElectricKwDemand,
    controllableElectricKwhBaseline: s.controllableElectricKwhBaseline,
    controllableElectricKwhEmulated: s.controllableElectricKwhEmulated,
    controllableElectricKwhMpc: s.controllableElectricKwhMpc,
    controllableHeatKwhBaseline: s.controllableHeatKwhBaseline,
    controllableHeatKwhEmulated: s.controllableHeatKwhEmulated,
    controllableHeatKwhMpc: s.controllableHeatKwhMpc,
    controllableElectricKwhDemand: s.controllableElectricKwhDemand,
    controllableHeatKwhDemand: s.controllableHeatKwhDemand,
    meaningfulDeltaSteps: s.meaningfulDeltaSteps,
    meaningfulDeltaPct: s.meaningfulDeltaPct,
    mpcVsObservedDeltaSteps: s.mpcVsObservedDeltaSteps,
    mpcVsObservedDeltaPct: s.mpcVsObservedDeltaPct,
    mpcVsObservedEligibleSteps: s.mpcVsObservedEligibleSteps,
    heatingActiveStepPct: s.heatingActiveStepPct,
    measuredTr003HeatKwh: s.measuredTr003HeatKwh,
    policySummaries: input.policySummaries ?? s.policySummaries ?? [],
  };
}

export function buildRunScalarUpdateData(
  result: MpcPipelineResult,
): {
  stepCount: number;
  trainStepCount: number;
  holdoutStepCount: number;
  calibration: Prisma.InputJsonValue;
  replayQuality: MpcReplayQuality;
  signalBindingVersion: string | null;
  totalCostBaselineKr: number;
  totalCostEmulatedKr: number;
  totalCostMpcKr: number;
  totalCostDemandKr: number | undefined;
  deltaCostKr: number;
  deltaCostPct: number;
  deltaCostVsEmulatedKr: number | undefined;
  deltaCostVsEmulatedPct: number | undefined;
  controllableElectricKwhBaseline: number;
  controllableElectricKwhEmulated: number | undefined;
  controllableElectricKwhMpc: number;
  controllableHeatKwhBaseline: number;
  controllableHeatKwhEmulated: number | undefined;
  controllableHeatKwhMpc: number;
  peakElectricKwBaseline: number;
  peakElectricKwEmulated: number | undefined;
  peakElectricKwMpc: number;
  fallbackSteps: number;
  optimizablePct: number | undefined;
  meaningfulDeltaPct: number | undefined;
  plantRmseC: number;
  emulatorMaeSupplySetpointC: number | null;
  comfortViolationsMpc: number;
  comfortViolationsBaseline: number;
  comfortViolationsEmulated: number;
  comfortViolationsDemand: number;
  comfortViolationsObservedProxy: number;
  comfortViolationsHarmonizedObserved: number | undefined;
} {
  const s = result.replay.summary;
  const mae = result.emulatorValidation.mae;
  const replayQuality = resolvePersistedReplayQuality({
    stepCount: result.stepCount,
    steps: result.replay.steps,
  });
  return {
    stepCount: result.stepCount,
    trainStepCount: result.calibration.trainStepCount,
    holdoutStepCount: result.calibration.holdoutStepCount,
    calibration: buildPersistedCalibrationPayload(result) as Prisma.InputJsonValue,
    replayQuality,
    signalBindingVersion:
      result.preferencesSnapshot?.buildingSlug ??
      result.preferencesSnapshot?.unitKey ??
      null,
    totalCostBaselineKr: s.totalCostBaselineKr,
    totalCostEmulatedKr: s.totalCostEmulatedKr,
    totalCostMpcKr: s.totalCostMpcKr,
    totalCostDemandKr: s.totalCostDemandKr,
    deltaCostKr: s.deltaCostKr,
    deltaCostPct: s.deltaCostPct,
    deltaCostVsEmulatedKr: s.deltaCostVsEmulatedKr,
    deltaCostVsEmulatedPct: s.deltaCostVsEmulatedPct,
    controllableElectricKwhBaseline: s.controllableElectricKwhBaseline,
    controllableElectricKwhEmulated: s.controllableElectricKwhEmulated,
    controllableElectricKwhMpc: s.controllableElectricKwhMpc,
    controllableHeatKwhBaseline: s.controllableHeatKwhBaseline,
    controllableHeatKwhEmulated: s.controllableHeatKwhEmulated,
    controllableHeatKwhMpc: s.controllableHeatKwhMpc,
    peakElectricKwBaseline: s.peakElectricKwBaseline,
    peakElectricKwEmulated: s.peakElectricKwEmulated,
    peakElectricKwMpc: s.peakElectricKwMpc,
    fallbackSteps: s.fallbackSteps,
    optimizablePct: s.optimizablePct,
    meaningfulDeltaPct: s.meaningfulDeltaPct,
    plantRmseC: result.plantValidation.rmseC,
    emulatorMaeSupplySetpointC: mae.supplySetpointC ?? null,
    ...comfortScalarsFromSummary(s),
  };
}

function comfortScalarsFromSummary(
  s: MpcPipelineResult["replay"]["summary"],
) {
  return {
    comfortViolationsMpc: s.comfortViolationsMpc,
    comfortViolationsBaseline: s.comfortViolationsBaseline,
    comfortViolationsEmulated: s.comfortViolationsEmulated,
    comfortViolationsDemand: s.comfortViolationsDemand,
    comfortViolationsObservedProxy:
      s.comfortViolationsObservedProxy ?? s.comfortViolationsBaseline,
    comfortViolationsHarmonizedObserved: s.comfortViolationsHarmonizedObserved,
  };
}

export function buildRunScalarCreateData(input: {
  buildingId: string;
  inputFingerprint: string;
  result: MpcPipelineResult;
  executionMode?: Prisma.SdAnleggMpcPipelineRunCreateInput["executionMode"];
  stepMinutes?: number;
}): Prisma.SdAnleggMpcPipelineRunCreateInput {
  const { buildingId, inputFingerprint, result } = input;
  const s = result.replay.summary;
  const mae = result.emulatorValidation.mae;
  const replayQuality = resolvePersistedReplayQuality({
    stepCount: result.stepCount,
    steps: result.replay.steps,
  });
  return {
    building: { connect: { id: buildingId } },
    modelVersion: result.calibration.modelVersion,
    executionMode: input.executionMode ?? "SHADOW",
    stepMinutes: input.stepMinutes ?? result.calibration.solver.stepMinutes ?? 15,
    evalStart: new Date(result.evalStart),
    evalEnd: new Date(result.evalEnd),
    inputFingerprint,
    stepCount: result.stepCount,
    trainStepCount: result.calibration.trainStepCount,
    holdoutStepCount: result.calibration.holdoutStepCount,
    calibration: buildPersistedCalibrationPayload(result) as Prisma.InputJsonValue,
    replayQuality,
    signalBindingVersion:
      result.preferencesSnapshot?.buildingSlug ??
      result.preferencesSnapshot?.unitKey ??
      null,
    totalCostBaselineKr: s.totalCostBaselineKr,
    totalCostEmulatedKr: s.totalCostEmulatedKr,
    totalCostMpcKr: s.totalCostMpcKr,
    totalCostDemandKr: s.totalCostDemandKr,
    deltaCostKr: s.deltaCostKr,
    deltaCostPct: s.deltaCostPct,
    deltaCostVsEmulatedKr: s.deltaCostVsEmulatedKr,
    deltaCostVsEmulatedPct: s.deltaCostVsEmulatedPct,
    controllableElectricKwhBaseline: s.controllableElectricKwhBaseline,
    controllableElectricKwhEmulated: s.controllableElectricKwhEmulated,
    controllableElectricKwhMpc: s.controllableElectricKwhMpc,
    controllableHeatKwhBaseline: s.controllableHeatKwhBaseline,
    controllableHeatKwhEmulated: s.controllableHeatKwhEmulated,
    controllableHeatKwhMpc: s.controllableHeatKwhMpc,
    peakElectricKwBaseline: s.peakElectricKwBaseline,
    peakElectricKwEmulated: s.peakElectricKwEmulated,
    peakElectricKwMpc: s.peakElectricKwMpc,
    fallbackSteps: s.fallbackSteps,
    optimizablePct: s.optimizablePct,
    meaningfulDeltaPct: s.meaningfulDeltaPct,
    plantRmseC: result.plantValidation.rmseC,
    emulatorMaeSupplySetpointC: mae.supplySetpointC ?? null,
    ...comfortScalarsFromSummary(s),
    persistStatus: "PENDING",
    persistedStepCount: 0,
    persistError: null,
  };
}
