import { describe, expect, it } from "bun:test";
import {
  controlVector,
  deltaControlVectors,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import {
  countMpcVsObservedDeltaSteps,
  MEANINGFUL_DELTA_NORM_SQ,
} from "@/lib/sd-anlegg/mpc/pipeline/count-meaningful-delta-steps";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function replayStep(input: {
  uMeas?: MpcReplayStep["uBmsMeas"];
  uMpc?: MpcReplayStep["uMpc"];
}): MpcReplayStep {
  const base = controlVector({
    supplySetpointC: 18,
    supplyFanPct: 30,
    exhaustFanPct: 30,
    heatingValvePct: 10,
  });
  const uMeas = input.uMeas === undefined ? null : input.uMeas;
  const uMpc = input.uMpc ?? base;
  const deltaReference = uMeas ?? base;
  return {
    t: "2026-06-24T10:00:00.000Z",
    uBmsMeas: uMeas,
    uBmsSim: base,
    uMpc,
    deltaU: deltaControlVectors(uMpc, deltaReference),
    extractTempMeasC: 20,
    extractTempPredC: 20,
    electricKw: 0.5,
    heatKw: 0.1,
    marginalKrPerKwh: 1,
    outdoorTempC: 15,
    costBaselineKr: 0.1,
    costEmulatedKr: 0.1,
    costMpcKr: 0.09,
    comfortViolation: false,
    usedFallback: false,
  };
}

describe("countMpcVsObservedDeltaSteps", () => {
  it("teller avvik mot målt styring", () => {
    const base = controlVector({
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 30,
      heatingValvePct: 10,
    });
    const shifted = controlVector({ ...base, supplySetpointC: 17 });
    const result = countMpcVsObservedDeltaSteps([
      replayStep({ uMeas: base, uMpc: base }),
      replayStep({ uMeas: base, uMpc: shifted }),
    ]);
    expect(result.deltaSteps).toBe(1);
    expect(result.deltaPct).toBe(50);
    expect(result.eligibleSteps).toBe(2);
  });

  it("ignorerer steg uten målt styring", () => {
    const base = controlVector({
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 30,
      heatingValvePct: 10,
    });
    const shifted = controlVector({ ...base, supplySetpointC: 17 });
    const result = countMpcVsObservedDeltaSteps([
      replayStep({ uMeas: null, uMpc: shifted }),
    ]);
    expect(result.deltaSteps).toBe(0);
    expect(result.eligibleSteps).toBe(0);
  });

  it("eksporterer terskel for dokumentasjon", () => {
    expect(MEANINGFUL_DELTA_NORM_SQ).toBe(0.25);
  });
});
