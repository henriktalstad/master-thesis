import { describe, expect, test } from "bun:test";
import { summarizeSupplySetpointTracking } from "@/lib/sd-anlegg/control/summarize-supply-tracking";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(partial: Partial<MpcReplayStep>): MpcReplayStep {
  return {
    t: "2026-06-24T12:00:00.000Z",
    extractTempC: 22,
    ...partial,
  } as MpcReplayStep;
}

describe("summarizeSupplySetpointTracking", () => {
  test("beregner MAE mellom målt tilluft og operatør-SP", () => {
    const result = summarizeSupplySetpointTracking([
      step({
        supplyTempMeasC: 19.2,
        uBmsMeas: { supplySetpointC: 19, supplyFanPct: 50, exhaustFanPct: 50, heatingValvePct: 0, coolingValvePct: 0 },
      }),
      step({
        supplyTempMeasC: 18.6,
        uBmsMeas: { supplySetpointC: 19, supplyFanPct: 50, exhaustFanPct: 50, heatingValvePct: 0, coolingValvePct: 0 },
      }),
    ]);

    expect(result.comparedSteps).toBe(2);
    expect(result.maeSetpointTrackingC).toBe(0.3);
    expect(result.latestDeltaC).toBe(-0.4);
  });

  test("hopper over steg uten målt tilluft eller SP", () => {
    const result = summarizeSupplySetpointTracking([
      step({ supplyTempMeasC: null }),
      step({ supplyTempMeasC: 20, uBmsMeas: undefined }),
    ]);

    expect(result.comparedSteps).toBe(0);
    expect(result.maeSetpointTrackingC).toBeNull();
  });
});
