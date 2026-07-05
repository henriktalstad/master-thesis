import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";
import { getControlPolicy, REPLAY_POLICY_IDS } from "@/lib/sd-anlegg/mpc/controller/policies/registry";
import type { PolicySummaryKpi } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import { policyNomenclature } from "@/lib/sd-anlegg/control/control-nomenclature";

function pctDelta(next: number, base: number): number {
  if (base === 0) return 0;
  return Math.round(((next - base) / base) * 1000) / 10;
}

export function buildPolicySummaries(
  summary: MpcReplayResult["summary"],
): PolicySummaryKpi[] {
  const observedCost = summary.totalCostBaselineKr;

  return REPLAY_POLICY_IDS.map((policyId) => {
    const policy = getControlPolicy(policyId);
    let totalCostKr = observedCost;
    let comfortViolations = summary.comfortViolationsHarmonizedObserved ?? summary.comfortViolationsBaseline;
    let peakElectricKw = summary.peakElectricKwBaseline;
    let controllableElectricKwh = summary.controllableElectricKwhBaseline;
    let controllableHeatKwh = summary.controllableHeatKwhBaseline;

    if (policyId === "emulated") {
      totalCostKr = summary.totalCostEmulatedKr;
      comfortViolations = summary.comfortViolationsEmulated;
      peakElectricKw = summary.peakElectricKwEmulated;
      controllableElectricKwh = summary.controllableElectricKwhEmulated;
      controllableHeatKwh = summary.controllableHeatKwhEmulated;
    } else if (policyId === "demand-scoped") {
      totalCostKr = summary.totalCostDemandKr;
      comfortViolations = summary.comfortViolationsDemand;
      peakElectricKw = summary.peakElectricKwDemand;
      controllableElectricKwh = summary.controllableElectricKwhDemand;
      controllableHeatKwh = summary.controllableHeatKwhDemand;
    } else if (policyId === "mpc-v1") {
      totalCostKr = summary.totalCostMpcKr;
      comfortViolations = summary.comfortViolationsMpc;
      peakElectricKw = summary.peakElectricKwMpc;
      controllableElectricKwh = summary.controllableElectricKwhMpc;
      controllableHeatKwh = summary.controllableHeatKwhMpc;
    }

    const deltaCostVsObservedKr =
      Math.round((totalCostKr - observedCost) * 100) / 100;

    return {
      policyId,
      label: policyNomenclature(policyId).shortLabel,
      thesisLabel: policyNomenclature(policyId).thesisLabel,
      controlMode: policyNomenclature(policyId).controlMode,
      controlModeLabel: policyNomenclature(policyId).controlModeLabel,
      role: policyNomenclature(policyId).role,
      claimLevel: policy.claimLevel,
      totalCostKr,
      deltaCostVsObservedKr,
      deltaCostVsObservedPct: pctDelta(totalCostKr, observedCost),
      comfortViolations,
      peakElectricKw,
      controllableElectricKwh,
      controllableHeatKwh,
    };
  });
}
