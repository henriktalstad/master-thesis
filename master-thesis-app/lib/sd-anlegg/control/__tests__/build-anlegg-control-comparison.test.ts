import { describe, expect, it } from "bun:test";
import { buildAnleggControlComparison } from "../build-anlegg-control-comparison";
import { buildPolicySummaries } from "@/lib/sd-anlegg/mpc/pipeline/build-policy-summaries";
import { emptyFallbackByReason } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";

describe("buildAnleggControlComparison", () => {
  it("bygger fire-spors sammenligning med plant scope", () => {
    const summary = {
      stepCount: 100,
      fallbackSteps: 2,
      optimizedSteps: 98,
      optimizableSteps: 100,
      optimizablePct: 100,
      fallbackPct: 2,
      fallbackByReason: emptyFallbackByReason(),
      skippedSteps: 0,
      comfortViolationsMpc: 230,
      comfortViolationsBaseline: 240,
      comfortViolationsEmulated: 239,
      comfortViolationsDemand: 245,
      totalCostBaselineKr: 531,
      totalCostEmulatedKr: 530,
      totalCostMpcKr: 524,
      totalCostDemandKr: 543,
      deltaCostDemandKr: 12,
      deltaCostDemandPct: 2.3,
      deltaCostKr: -7,
      deltaCostPct: -1.3,
      deltaCostVsEmulatedKr: -6,
      deltaCostVsEmulatedPct: -1.1,
      peakElectricKwBaseline: 5.2,
      peakElectricKwEmulated: 5.1,
      peakElectricKwMpc: 4.8,
      peakElectricKwDemand: 5.0,
      controllableElectricKwhBaseline: 120,
      controllableElectricKwhEmulated: 118,
      controllableElectricKwhMpc: 115,
      controllableElectricKwhDemand: 116,
      controllableHeatKwhBaseline: 800,
      controllableHeatKwhEmulated: 790,
      controllableHeatKwhMpc: 780,
      controllableHeatKwhDemand: 400,
      meaningfulDeltaSteps: 40,
      meaningfulDeltaPct: 40,
      mpcVsObservedDeltaSteps: 35,
      mpcVsObservedDeltaPct: 35,
      mpcVsObservedEligibleSteps: 100,
      heatingActiveStepPct: 60,
      measuredTr003HeatKwh: 750,
    };

    const policies = buildPolicySummaries(summary);
    const comparison = buildAnleggControlComparison({
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-07-02T00:00:00.000Z",
      replaySummary: summary,
      policySummaries: policies,
      tuningPresetId: "anlegg_pris_respons_v1",
    });

    expect(comparison).not.toBeNull();
    expect(comparison!.policies).toHaveLength(4);
    expect(comparison!.plantScope.actuatorCount).toBe(7);
    expect(comparison!.comparisonMatrix.rows).toHaveLength(3);
    expect(comparison!.policies.find((p) => p.policyId === "mpc-v1")?.thesisLabel).toContain(
      "MPC",
    );
  });
});
