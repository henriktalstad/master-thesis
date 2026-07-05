import { describe, expect, it } from "bun:test";
import { buildPolicySummaries } from "@/lib/sd-anlegg/mpc/pipeline/build-policy-summaries";
import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";

const summary: MpcReplayResult["summary"] = {
  stepCount: 10,
  fallbackSteps: 0,
  optimizedSteps: 10,
  optimizableSteps: 10,
  optimizablePct: 1,
  fallbackPct: 0,
  fallbackByReason: {
    alarm: 0,
    missing_u_meas: 0,
    simultaneous_heat_cool: 0,
  },
  skippedSteps: 0,
  comfortViolationsMpc: 1,
  comfortViolationsBaseline: 2,
  comfortViolationsEmulated: 2,
  comfortViolationsDemand: 1,
  totalCostBaselineKr: 100,
  totalCostEmulatedKr: 101,
  totalCostMpcKr: 90,
  totalCostDemandKr: 95,
  deltaCostDemandKr: -5,
  deltaCostDemandPct: -5,
  deltaCostKr: -10,
  deltaCostPct: -10,
  deltaCostVsEmulatedKr: -11,
  deltaCostVsEmulatedPct: -10.9,
  peakElectricKwBaseline: 1,
  peakElectricKwEmulated: 1.02,
  peakElectricKwMpc: 0.9,
  peakElectricKwDemand: 0.95,
  controllableElectricKwhBaseline: 10,
  controllableElectricKwhEmulated: 10.5,
  controllableElectricKwhMpc: 9,
  controllableElectricKwhDemand: 9.5,
  controllableHeatKwhBaseline: 20,
  controllableHeatKwhEmulated: 20.5,
  controllableHeatKwhMpc: 18,
  controllableHeatKwhDemand: 19,
};

describe("buildPolicySummaries", () => {
  it("bygger KPI per policy", () => {
    const rows = buildPolicySummaries(summary);
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.policyId === "demand-scoped")?.totalCostKr).toBe(95);
    expect(rows.find((r) => r.policyId === "emulated")?.controllableHeatKwh).toBe(20.5);
    expect(rows.find((r) => r.policyId === "mpc-v1")?.deltaCostVsObservedPct).toBe(-10);
  });
});
