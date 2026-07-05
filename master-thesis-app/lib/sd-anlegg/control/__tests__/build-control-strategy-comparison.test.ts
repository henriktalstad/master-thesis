import { describe, expect, it } from "bun:test";
import { buildControlStrategyComparison } from "../build-control-strategy-comparison";
import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";

const summary: MpcReplayResult["summary"] = {
  stepCount: 100,
  fallbackSteps: 3,
  optimizedSteps: 97,
  optimizableSteps: 97,
  optimizablePct: 0.97,
  fallbackPct: 0.03,
  fallbackByReason: {
    alarm: 2,
    missing_u_meas: 0,
    simultaneous_heat_cool: 1,
  },
  skippedSteps: 0,
  comfortViolationsMpc: 50,
  comfortViolationsBaseline: 60,
  comfortViolationsEmulated: 55,
  comfortViolationsDemand: 52,
  totalCostBaselineKr: 100,
  totalCostEmulatedKr: 102,
  totalCostMpcKr: 95,
  totalCostDemandKr: 98,
  deltaCostDemandKr: -2,
  deltaCostDemandPct: -2,
  deltaCostKr: -5,
  deltaCostPct: -5,
  deltaCostVsEmulatedKr: -7,
  deltaCostVsEmulatedPct: -6.9,
  peakElectricKwBaseline: 0.8,
  peakElectricKwEmulated: 0.82,
  peakElectricKwMpc: 0.7,
  peakElectricKwDemand: 0.75,
  controllableElectricKwhBaseline: 30,
  controllableElectricKwhEmulated: 31,
  controllableElectricKwhMpc: 28,
  controllableElectricKwhDemand: 29,
  controllableHeatKwhBaseline: 50,
  controllableHeatKwhEmulated: 51,
  controllableHeatKwhMpc: 48,
  controllableHeatKwhDemand: 49,
};

describe("buildControlStrategyComparison", () => {
  it("bygger fire strategi-rader med kost-delta", () => {
    const result = buildControlStrategyComparison(summary);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0]?.id).toBe("observed");
    expect(result.rows[1]?.comfortViolations).toBe(55);
    expect(result.rows[1]?.controllableElectricKwh).toBe(31);
    expect(result.rows[1]?.controllableHeatKwh).toBe(51);
    expect(result.rows[2]?.id).toBe("demand");
    expect(result.rows[2]?.totalCostKr).toBe(98);
    expect(result.rows[3]?.deltaCostVsObservedPct).toBe(-5);
  });
});
