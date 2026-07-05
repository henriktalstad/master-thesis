import { describe, expect, it } from "bun:test";
import { sanitizeControlLoopStep } from "../live/build-control-loop-series";
import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function baseStep(
  partial: Partial<MpcReplayStep> & {
    uBmsSim: MpcControlVector;
    uMpc: MpcControlVector;
  },
): MpcReplayStep {
  return {
    t: "2026-07-01T19:45:00.000Z",
    uBmsMeas: null,
    deltaU: {
      supplySetpointC: 0,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    extractTempMeasC: null,
    extractTempPredC: null,
    electricKw: 0,
    heatKw: 0,
    marginalKrPerKwh: null,
    outdoorTempC: null,
    costBaselineKr: 0,
    costEmulatedKr: 0,
    costMpcKr: 0,
    comfortViolation: false,
    usedFallback: false,
    ...partial,
  };
}

const off: MpcControlVector = {
  supplySetpointC: 18,
  supplyFanPct: 0,
  exhaustFanPct: 0,
  heatingValvePct: 0,
  coolingValvePct: 0,
};

describe("sanitizeControlLoopStep", () => {
  it("klamper korrupt høy MPC-vifte når målt og emulert er av", () => {
    const step = baseStep({
      uBmsMeas: { ...off },
      uBmsSim: { ...off },
      uMpc: { ...off, supplyFanPct: 68, exhaustFanPct: 63 },
    });
    const sanitized = sanitizeControlLoopStep(step);
    expect(sanitized.uMpc.supplyFanPct).toBe(0);
    expect(sanitized.uMpc.exhaustFanPct).toBe(0);
  });

  it("beholder MPC-vifte når målt er på", () => {
    const step = baseStep({
      uBmsMeas: { ...off, supplyFanPct: 55 },
      uBmsSim: { ...off },
      uMpc: { ...off, supplyFanPct: 60 },
    });
    const sanitized = sanitizeControlLoopStep(step);
    expect(sanitized.uMpc.supplyFanPct).toBe(60);
  });
});
