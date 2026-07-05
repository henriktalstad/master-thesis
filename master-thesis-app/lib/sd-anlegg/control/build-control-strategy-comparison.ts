import {
  policyNomenclature,
} from "./control-nomenclature";
import { CONTROL_DISPLAY } from "./control-display-labels";
import type { MpcPipelineSnapshot } from "./control-types";
import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";
import { emptyFallbackByReason } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import { normalizeFallbackPctFraction } from "./normalize-fallback-pct";

export type ControlStrategyId =
  | "observed"
  | "predicted"
  | "demand"
  | "simulated";

export type ControlStrategyRow = {
  id: ControlStrategyId;
  label: string;
  controlModeLabel: string;
  description: string;
  totalCostKr: number;
  deltaCostVsObservedKr: number;
  deltaCostVsObservedPct: number;
  /** Kun for simulert MPC — vs forventet BMS-styring. */
  deltaCostVsEmulatedKr?: number;
  deltaCostVsEmulatedPct?: number;
  comfortViolations: number | null;
  peakElectricKw: number;
  controllableElectricKwh: number | null;
  controllableHeatKwh: number | null;
};

export type ControlStrategyComparison = {
  stepCount: number;
  fallbackPct: number;
  meaningfulDeltaPct: number | null;
  mpcVsObservedDeltaPct: number | null;
  rows: ControlStrategyRow[];
};

function pctDelta(next: number, base: number): number {
  if (base === 0) return 0;
  return Math.round(((next - base) / base) * 1000) / 10;
}

export function normalizeReplaySummary(
  summary: MpcPipelineSnapshot["replaySummary"],
): MpcReplayResult["summary"] {
  const observedCost = summary.totalCostBaselineKr;
  return {
    stepCount: summary.stepCount,
    fallbackSteps: summary.fallbackSteps,
    optimizedSteps: summary.optimizedSteps ?? 0,
    optimizableSteps: summary.optimizableSteps ?? summary.stepCount,
    optimizablePct: summary.optimizablePct ?? 0,
    fallbackPct: normalizeFallbackPctFraction(summary.fallbackPct ?? 0),
    fallbackByReason: summary.fallbackByReason ?? emptyFallbackByReason(),
    skippedSteps: summary.skippedSteps ?? 0,
    comfortViolationsMpc: summary.comfortViolationsMpc,
    comfortViolationsBaseline: summary.comfortViolationsBaseline,
    comfortViolationsEmulated: summary.comfortViolationsEmulated ?? 0,
    comfortViolationsDemand: summary.comfortViolationsDemand ?? 0,
    totalCostBaselineKr: observedCost,
    totalCostEmulatedKr: summary.totalCostEmulatedKr ?? observedCost,
    totalCostMpcKr: summary.totalCostMpcKr,
    totalCostDemandKr: summary.totalCostDemandKr ?? observedCost,
    deltaCostDemandKr: summary.deltaCostDemandKr ?? 0,
    deltaCostDemandPct: summary.deltaCostDemandPct ?? 0,
    deltaCostKr: summary.deltaCostKr,
    deltaCostPct: summary.deltaCostPct,
    deltaCostVsEmulatedKr: summary.deltaCostVsEmulatedKr ?? summary.deltaCostKr,
    deltaCostVsEmulatedPct: summary.deltaCostVsEmulatedPct ?? summary.deltaCostPct,
    peakElectricKwBaseline: summary.peakElectricKwBaseline,
    peakElectricKwEmulated:
      summary.peakElectricKwEmulated ?? summary.peakElectricKwBaseline,
    peakElectricKwMpc: summary.peakElectricKwMpc,
    peakElectricKwDemand:
      summary.peakElectricKwDemand ?? summary.peakElectricKwBaseline,
    controllableElectricKwhBaseline: summary.controllableElectricKwhBaseline,
    controllableElectricKwhEmulated:
      summary.controllableElectricKwhEmulated ??
      summary.controllableElectricKwhBaseline,
    controllableElectricKwhMpc: summary.controllableElectricKwhMpc,
    controllableElectricKwhDemand:
      summary.controllableElectricKwhDemand ?? summary.controllableElectricKwhBaseline,
    controllableHeatKwhBaseline: summary.controllableHeatKwhBaseline,
    controllableHeatKwhEmulated:
      summary.controllableHeatKwhEmulated ?? summary.controllableHeatKwhBaseline,
    controllableHeatKwhMpc: summary.controllableHeatKwhMpc,
    controllableHeatKwhDemand:
      summary.controllableHeatKwhDemand ?? summary.controllableHeatKwhBaseline,
    meaningfulDeltaSteps: summary.meaningfulDeltaSteps,
    meaningfulDeltaPct: summary.meaningfulDeltaPct,
    mpcVsObservedDeltaSteps: summary.mpcVsObservedDeltaSteps,
    mpcVsObservedDeltaPct: summary.mpcVsObservedDeltaPct,
    mpcVsObservedEligibleSteps: summary.mpcVsObservedEligibleSteps,
    heatingActiveStepPct: summary.heatingActiveStepPct,
    measuredTr003HeatKwh: summary.measuredTr003HeatKwh,
    policySummaries: summary.policySummaries,
  };
}

export function buildControlStrategyComparison(
  summary: MpcPipelineSnapshot["replaySummary"] | MpcReplayResult["summary"],
): ControlStrategyComparison {
  const normalized = normalizeReplaySummary(
    summary as MpcPipelineSnapshot["replaySummary"],
  );
  const observedCost = normalized.totalCostBaselineKr;
  const predictedCost = normalized.totalCostEmulatedKr;
  const demandCost = normalized.totalCostDemandKr;
  const simulatedCost = normalized.totalCostMpcKr;

  const rows: ControlStrategyRow[] = [
    {
      id: "observed",
      label: CONTROL_DISPLAY.observed.short,
      controlModeLabel: policyNomenclature("observed").controlModeLabel,
      description: CONTROL_DISPLAY.observed.description,
      totalCostKr: observedCost,
      deltaCostVsObservedKr: 0,
      deltaCostVsObservedPct: 0,
      comfortViolations: normalized.comfortViolationsBaseline,
      peakElectricKw: normalized.peakElectricKwBaseline,
      controllableElectricKwh: normalized.controllableElectricKwhBaseline,
      controllableHeatKwh: normalized.controllableHeatKwhBaseline,
    },
    {
      id: "predicted",
      label: CONTROL_DISPLAY.predicted.short,
      controlModeLabel: policyNomenclature("emulated").controlModeLabel,
      description: CONTROL_DISPLAY.predicted.description,
      totalCostKr: predictedCost,
      deltaCostVsObservedKr:
        Math.round((predictedCost - observedCost) * 100) / 100,
      deltaCostVsObservedPct: pctDelta(predictedCost, observedCost),
      comfortViolations: normalized.comfortViolationsEmulated,
      peakElectricKw: normalized.peakElectricKwEmulated,
      controllableElectricKwh: normalized.controllableElectricKwhEmulated,
      controllableHeatKwh: normalized.controllableHeatKwhEmulated,
    },
    {
      id: "demand",
      label: CONTROL_DISPLAY.demand.short,
      controlModeLabel: policyNomenclature("demand-scoped").controlModeLabel,
      description: CONTROL_DISPLAY.demand.description,
      totalCostKr: demandCost,
      deltaCostVsObservedKr: normalized.deltaCostDemandKr,
      deltaCostVsObservedPct: normalized.deltaCostDemandPct,
      comfortViolations: normalized.comfortViolationsDemand,
      peakElectricKw: normalized.peakElectricKwDemand,
      controllableElectricKwh: normalized.controllableElectricKwhDemand,
      controllableHeatKwh: normalized.controllableHeatKwhDemand,
    },
    {
      id: "simulated",
      label: CONTROL_DISPLAY.simulatedControl.short,
      controlModeLabel: policyNomenclature("mpc-v1").controlModeLabel,
      description: CONTROL_DISPLAY.simulatedControl.description,
      totalCostKr: simulatedCost,
      deltaCostVsObservedKr: normalized.deltaCostKr,
      deltaCostVsObservedPct: normalized.deltaCostPct,
      deltaCostVsEmulatedKr: normalized.deltaCostVsEmulatedKr,
      deltaCostVsEmulatedPct: normalized.deltaCostVsEmulatedPct,
      comfortViolations: normalized.comfortViolationsMpc,
      peakElectricKw: normalized.peakElectricKwMpc,
      controllableElectricKwh: normalized.controllableElectricKwhMpc,
      controllableHeatKwh: normalized.controllableHeatKwhMpc,
    },
  ];

  return {
    stepCount: normalized.stepCount,
    fallbackPct: normalized.fallbackPct,
    meaningfulDeltaPct: normalized.meaningfulDeltaPct ?? null,
    mpcVsObservedDeltaPct: normalized.mpcVsObservedDeltaPct ?? null,
    rows,
  };
}
