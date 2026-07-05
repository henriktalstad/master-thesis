import { describe, expect, it } from "bun:test";

import {
  aggregateComfortViolationsFromSteps,
  applyComfortAggregatesToSummary,
} from "../comfort-violation-counts";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(partial: Partial<MpcReplayStep>): MpcReplayStep {
  return {
    t: "2025-01-01T00:00:00.000Z",
    marginalKrPerKwh: 1,
    costBaselineKr: 0,
    costMpcKr: 0,
    usedFallback: false,
    comfortViolation: false,
    uBmsSim: {
      supplySetpointC: 18,
      supplyFanPct: 50,
      exhaustFanPct: 50,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    uMpc: {
      supplySetpointC: 18,
      supplyFanPct: 50,
      exhaustFanPct: 50,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    ...partial,
  } as MpcReplayStep;
}

describe("comfort-violation-counts", () => {
  it("separates measured proxy from harmonized plant-predicted counts", () => {
    const steps = [
      step({
        extractTempMeasC: 16,
        extractTempPredObservedC: 19,
        extractTempPredEmulatedC: 19,
        extractTempPredC: 19,
        extractTempPredDemandC: 19,
      }),
      step({
        extractTempMeasC: 20,
        extractTempPredObservedC: 25,
        extractTempPredEmulatedC: 25,
        comfortViolationEmulated: true,
        extractTempPredC: 20,
        extractTempPredDemandC: 20,
      }),
    ];

    const agg = aggregateComfortViolationsFromSteps(steps);
    expect(agg.observedMeasuredProxy).toBe(1);
    expect(agg.harmonizedObserved).toBe(1);
    expect(agg.harmonizedEmulated).toBe(1);
    expect(agg.harmonizedMpc).toBe(0);
    expect(agg.harmonizedDemand).toBe(0);
  });

  it("writes harmonized fields onto replay summary", () => {
    const summary = {
      comfortViolationsBaseline: 0,
      comfortViolationsEmulated: 0,
      comfortViolationsMpc: 0,
      comfortViolationsDemand: 0,
    };
    applyComfortAggregatesToSummary(summary, [
      step({ extractTempMeasC: 16, extractTempPredObservedC: 16 }),
    ]);
    expect(summary.comfortViolationsBaseline).toBe(1);
    expect(summary.comfortViolationsObservedProxy).toBe(1);
    expect(summary.comfortViolationsHarmonizedObserved).toBe(1);
  });
});
