import { describe, expect, test } from "bun:test";
import {
  isPartialReplayForUi,
  resolveReplaySummaryForUi,
  shouldUseReplayStepsForSummary,
} from "@/lib/sd-anlegg/control/resolve-replay-summary";
import type { MpcPipelineSnapshot } from "@/lib/sd-anlegg/control/control-types";

const fullSnapshot: MpcPipelineSnapshot["replaySummary"] = {
  stepCount: 999,
  fallbackSteps: 0,
  fallbackPct: 0,
  comfortViolationsMpc: 0,
  comfortViolationsBaseline: 0,
  totalCostBaselineKr: 1000,
  totalCostMpcKr: 985,
  deltaCostKr: -15,
  deltaCostPct: -1.5,
  deltaCostVsEmulatedKr: -15,
  deltaCostVsEmulatedPct: -23.1,
  peakElectricKwBaseline: 10,
  peakElectricKwMpc: 9,
  controllableElectricKwhBaseline: 500,
  controllableElectricKwhMpc: 490,
  controllableHeatKwhBaseline: 200,
  controllableHeatKwhMpc: 195,
  meaningfulDeltaPct: 16.4,
  meaningfulDeltaSteps: 164,
  policySummaries: [],
};

describe("shouldUseReplayStepsForSummary", () => {
  test("avviser delvis last når forventet eval er større", () => {
    expect(shouldUseReplayStepsForSummary(128, 999)).toBe(false);
    expect(isPartialReplayForUi(128, 999)).toBe(true);
  });

  test("godtar nær-full dekning", () => {
    expect(shouldUseReplayStepsForSummary(950, 999)).toBe(true);
    expect(isPartialReplayForUi(950, 999)).toBe(false);
  });
});

describe("resolveReplaySummaryForUi", () => {
  test("bruker snapshot ved delvis last — ikke recompute fra 128 steg", () => {
    const summary = resolveReplaySummaryForUi(
      fullSnapshot,
      [{ t: "2026-06-19T10:00:00.000Z" } as never],
      { expectedStepCount: 999 },
    );

    expect(summary?.stepCount).toBe(999);
    expect(summary?.deltaCostKr).toBe(-15);
    expect(summary?.deltaCostVsEmulatedPct).toBe(-23.1);
  });

  test("normaliserer legacy fallbackPct (0–100) fra snapshot", () => {
    const summary = resolveReplaySummaryForUi(
      { ...fullSnapshot, fallbackPct: 12, fallbackSteps: 120 },
      [{ t: "2026-06-19T10:00:00.000Z" } as never],
      { expectedStepCount: 999 },
    );

    expect(summary?.fallbackPct).toBeCloseTo(0.12);
  });
});
