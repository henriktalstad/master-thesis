import { describe, expect, it } from "bun:test";
import { buildEffectFlowSnapshot } from "@/lib/sd-anlegg/control/build-effect-flow-snapshot";
import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";

function mockReplay(
  partial: Partial<MpcReplayResult["summary"]> = {},
): MpcReplayResult["summary"] {
  return {
    stepCount: 100,
    fallbackSteps: 0,
    optimizedSteps: 100,
    optimizableSteps: 100,
    optimizablePct: 1,
    fallbackPct: 0,
    fallbackByReason: {},
    skippedSteps: 0,
    comfortViolationsMpc: 0,
    comfortViolationsBaseline: 0,
    comfortViolationsEmulated: 0,
    comfortViolationsDemand: 0,
    totalCostBaselineKr: 600,
    totalCostEmulatedKr: 590,
    totalCostMpcKr: 580,
    totalCostDemandKr: 595,
    deltaCostDemandKr: -5,
    deltaCostDemandPct: -0.8,
    deltaCostKr: -20,
    deltaCostPct: -3.3,
    deltaCostVsEmulatedKr: -10,
    deltaCostVsEmulatedPct: -1.7,
    peakElectricKwBaseline: 10,
    peakElectricKwEmulated: 10,
    peakElectricKwMpc: 9,
    peakElectricKwDemand: 10,
    controllableElectricKwhBaseline: 400,
    controllableElectricKwhEmulated: 390,
    controllableElectricKwhMpc: 380,
    controllableElectricKwhDemand: 395,
    controllableHeatKwhBaseline: 200,
    controllableHeatKwhEmulated: 195,
    controllableHeatKwhMpc: 190,
    controllableHeatKwhDemand: 198,
    meaningfulDeltaSteps: 20,
    meaningfulDeltaPct: 0.2,
    mpcVsObservedDeltaSteps: 20,
    mpcVsObservedDeltaPct: 0.2,
    mpcVsObservedEligibleSteps: 100,
    heatingActiveStepPct: 0.5,
    measuredTr003HeatKwh: null,
    policySummaries: [],
    ...partial,
  };
}

describe("buildEffectFlowSnapshot", () => {
  it("bygger fire spor med kost og energi", () => {
    const snap = buildEffectFlowSnapshot({ replay: mockReplay() });
    expect(snap.tracks).toHaveLength(4);
    expect(snap.tracks[0]?.id).toBe("observed");
    expect(snap.tracks[0]?.totalCostKr).toBe(600);
    expect(snap.tracks[3]?.totalCostKr).toBe(580);
    expect(snap.heroDeltaObservedKr).toBe(-20);
    expect(snap.heroDeltaEmulatedKr).toBe(-10);
  });
});
