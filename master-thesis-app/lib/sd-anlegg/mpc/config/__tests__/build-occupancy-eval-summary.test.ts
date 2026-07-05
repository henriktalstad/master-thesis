import { describe, expect, it } from "bun:test";
import { buildOccupancyEvalSummary } from "@/lib/sd-anlegg/mpc/config/build-occupancy-eval-summary";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function replayStep(
  t: string,
  overrides: Partial<MpcReplayStep> = {},
): MpcReplayStep {
  return {
    t,
    uBmsMeas: { supplyFanPct: 0, exhaustFanPct: 0 } as MpcReplayStep["uBmsMeas"],
    uBmsSim: {} as MpcReplayStep["uBmsSim"],
    uMpc: {} as MpcReplayStep["uMpc"],
    uDemand: {} as MpcReplayStep["uDemand"],
    extractTempMeasC: 21,
    extractTempPredC: 21,
    costBaselineKr: 0,
    costEmulatedKr: 0,
    costMpcKr: 0,
    costDemandKr: 0,
    usedFallback: false,
    ...overrides,
  };
}

describe("buildOccupancyEvalSummary", () => {
  it("teller helg og ubelegg fra persisterte occupancy-felt", () => {
    const steps = [
      replayStep("2026-06-27T10:00:00.000Z", {
        occupancyQ: 0,
        occupancySource: "schedule",
      }),
      replayStep("2026-06-25T10:00:00.000Z", {
        occupancyQ: 0.85,
        occupancySource: "historical",
      }),
    ];

    const summary = buildOccupancyEvalSummary(steps);

    expect(summary.stepCount).toBe(2);
    expect(summary.weekendStepCount).toBe(1);
    expect(summary.unoccupiedStepCount).toBe(1);
    expect(summary.unoccupiedStepPct).toBe(50);
    expect(summary.bySource.schedule).toBe(1);
    expect(summary.bySource.historical).toBe(1);
  });

  it("faller tilbake til resolveOccupancyForStep når felt mangler", () => {
    const summary = buildOccupancyEvalSummary([
      replayStep("2026-06-27T10:00:00.000Z"),
    ]);

    expect(summary.unoccupiedStepCount).toBe(1);
    expect(summary.weekendStepCount).toBe(1);
  });
});
