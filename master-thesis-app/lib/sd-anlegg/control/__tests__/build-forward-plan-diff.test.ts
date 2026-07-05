import { describe, expect, it } from "bun:test";
import { buildForwardPlanDiff } from "../live/build-forward-plan-diff";
import type { MpcForwardPlan } from "../control-types-live";

function stubPlan(partial: Partial<MpcForwardPlan> & Pick<MpcForwardPlan, "computedAt">): MpcForwardPlan {
  return {
    horizonSteps: 4,
    stepMinutes: 15,
    planSteps: [
      {
        t: "2026-06-30T10:00:00.000Z",
        spotKrPerKwh: 1,
        effectiveMarginalKrPerKwh: 1.2,
        outdoorTempC: 15,
        uBmsSim: {
          supplySetpointC: 18,
          supplyFanPct: 30,
          exhaustFanPct: 30,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
        uMpc: {
          supplySetpointC: 18.5,
          supplyFanPct: 28,
          exhaustFanPct: 28,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
        predictedExtractC: 21,
        expectedDeltaCostKr: -0.5,
      },
    ],
    optimizedSteps: 1,
    fallbackSteps: 0,
    fallbackByReason: {
      missing_u_meas: 0,
      simultaneous_heat_cool: 0,
      alarm: 0,
    },
    effect: {
      totalCostBaselineKr: 10,
      totalCostMpcKr: 9,
      deltaCostKr: -1,
      deltaCostPct: -10,
    },
    weatherSource: "met_locationforecast",
    dayAheadHourCount: 24,
    computedAt: partial.computedAt,
    ...partial,
  };
}

describe("buildForwardPlanDiff", () => {
  it("rapporterer delta i aktiv kommando", () => {
    const previous = stubPlan({ computedAt: "2026-06-30T09:45:00.000Z" });
    const current = stubPlan({ computedAt: "2026-06-30T10:00:00.000Z" });
    current.planSteps[0]!.uMpc.supplySetpointC = 19;

    const diff = buildForwardPlanDiff({ previous, current });
    expect(diff.activeCommandDelta.supplySetpointC).toBe(0.5);
    expect(diff.summary).toContain("tilluft SP");
  });

  it("håndterer første plan uten previous", () => {
    const current = stubPlan({ computedAt: "2026-06-30T10:00:00.000Z" });
    const diff = buildForwardPlanDiff({ previous: null, current });
    expect(diff.previousComputedAt).toBeNull();
    expect(diff.effectDeltaKr).toBeNull();
  });
});
