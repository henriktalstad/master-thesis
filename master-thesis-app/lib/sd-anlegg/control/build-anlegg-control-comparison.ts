import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcEnergyReconcileSummary } from "./build-mpc-energy-reconcile";
import { buildPlantControlScope, type PlantControlScopeSummary } from "./build-plant-control-scope";
import {
  policyNomenclature,
  tuningPresetNomenclature,
  type ControlModeId,
} from "./control-nomenclature";
import type { PolicySummaryKpi } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import type { MpcTuningPresetId } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";

export type AnleggPolicyComparisonRow = PolicySummaryKpi & {
  thesisLabel: string;
  controlMode: ControlModeId;
  controlModeLabel: string;
  role: "reference" | "comparator" | "proposed";
  deltaCostVsEmulatedKr: number;
  deltaCostVsEmulatedPct: number;
};

export type AnleggControlComparison = {
  generatedAt: string;
  evalStart: string;
  evalEnd: string;
  buildingSlug: string;
  plantScope: PlantControlScopeSummary;
  tuningPresetId: MpcTuningPresetId | null;
  tuningPresetLabel: string | null;
  mpcVsEmulatedDeltaPct: number;
  mpcVsObservedDeltaPct: number;
  meaningfulDeltaPct: number | null;
  highPriceShiftPct: number | null;
  stepCount: number;
  fallbackPct: number;
  policies: AnleggPolicyComparisonRow[];
  energyReconcile: {
    measuredBuildingCostKr: number | null;
    proxyObservedCostKr: number | null;
    scopeCoveragePct: number | null;
  } | null;
  comparisonMatrix: {
    baselinePolicyId: "emulated";
    rows: Array<{
      policyId: string;
      deltaCostKr: number;
      deltaCostPct: number;
      comfortDelta: number | null;
    }>;
  };
};

function pctDelta(next: number, base: number): number {
  if (base === 0) return 0;
  return Math.round(((next - base) / base) * 1000) / 10;
}

function enrichPolicyRow(
  row: PolicySummaryKpi,
  emulatedCost: number,
  _emulatedComfort: number,
): AnleggPolicyComparisonRow {
  const meta = policyNomenclature(row.policyId);
  const deltaCostVsEmulatedKr =
    Math.round((row.totalCostKr - emulatedCost) * 100) / 100;
  return {
    ...row,
    label: meta.shortLabel,
    thesisLabel: meta.thesisLabel,
    controlMode: meta.controlMode,
    controlModeLabel: meta.controlModeLabel,
    role: meta.role,
    deltaCostVsEmulatedKr,
    deltaCostVsEmulatedPct: pctDelta(row.totalCostKr, emulatedCost),
  };
}

export function buildAnleggControlComparison(input: {
  evalStart: string;
  evalEnd: string;
  buildingSlug?: string;
  replaySummary: MpcReplayResult["summary"];
  policySummaries: PolicySummaryKpi[];
  tuningPresetId?: MpcTuningPresetId | null;
  energyReconcile?: MpcEnergyReconcileSummary | null;
  highPriceShiftPct?: number | null;
}): AnleggControlComparison | null {
  const buildingSlug = input.buildingSlug ?? "sorgenfriveien-32ab";
  const plantScope = buildPlantControlScope(buildingSlug);
  if (!plantScope) return null;

  const emulatedCost = input.replaySummary.totalCostEmulatedKr;
  const emulatedComfort = input.replaySummary.comfortViolationsEmulated;

  const policies = input.policySummaries.map((row) =>
    enrichPolicyRow(row, emulatedCost, emulatedComfort),
  );

  const tuningPresetId = input.tuningPresetId ?? null;
  const tuningPresetLabel = tuningPresetId
    ? tuningPresetNomenclature(tuningPresetId).shortLabel
    : null;

  const comparisonMatrix = {
    baselinePolicyId: "emulated" as const,
    rows: policies
      .filter((p) => p.policyId !== "emulated")
      .map((p) => ({
        policyId: p.policyId,
        deltaCostKr: p.deltaCostVsEmulatedKr,
        deltaCostPct: p.deltaCostVsEmulatedPct,
        comfortDelta:
          p.policyId === "observed"
            ? p.comfortViolations - emulatedComfort
            : p.comfortViolations - emulatedComfort,
      })),
  };

  const reconcile = input.energyReconcile;
  const measuredBuildingCostKr = reconcile?.measured.totalCostKr ?? null;
  const proxyObservedCostKr =
    reconcile?.proxy.observed.costKr ||
    input.replaySummary.totalCostBaselineKr ||
    null;
  const scopeCoveragePct =
    measuredBuildingCostKr != null &&
    proxyObservedCostKr != null &&
    measuredBuildingCostKr > 0
      ? Math.round((proxyObservedCostKr / measuredBuildingCostKr) * 1000) / 10
      : null;

  return {
    generatedAt: new Date().toISOString(),
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
    buildingSlug,
    plantScope,
    tuningPresetId,
    tuningPresetLabel,
    mpcVsEmulatedDeltaPct: input.replaySummary.deltaCostVsEmulatedPct,
    mpcVsObservedDeltaPct: input.replaySummary.deltaCostPct,
    meaningfulDeltaPct: input.replaySummary.meaningfulDeltaPct ?? null,
    highPriceShiftPct: input.highPriceShiftPct ?? null,
    stepCount: input.replaySummary.stepCount,
    fallbackPct: input.replaySummary.fallbackPct,
    policies,
    energyReconcile: reconcile
      ? {
          measuredBuildingCostKr,
          proxyObservedCostKr,
          scopeCoveragePct,
        }
      : null,
    comparisonMatrix,
  };
}
