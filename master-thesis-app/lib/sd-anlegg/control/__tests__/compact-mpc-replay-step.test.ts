import { describe, expect, it } from "bun:test";
import {
  compactMpcReplayStep,
  expandCompactMpcReplayStep,
} from "@/lib/sd-anlegg/control/compact-mpc-replay-step";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const sampleStep: MpcReplayStep = {
  t: "2026-06-30T12:00:00.000Z",
  uBmsMeas: {
    supplySetpointC: 18,
    supplyFanPct: 40,
    exhaustFanPct: 35,
    heatingValvePct: 10,
    coolingValvePct: 0,
  },
  uBmsSim: {
    supplySetpointC: 18,
    supplyFanPct: 42,
    exhaustFanPct: 36,
    heatingValvePct: 12,
    coolingValvePct: 0,
  },
  uMpc: {
    supplySetpointC: 17.5,
    supplyFanPct: 38,
    exhaustFanPct: 34,
    heatingValvePct: 8,
    coolingValvePct: 0,
  },
  uDemand: {
    supplySetpointC: 18,
    supplyFanPct: 39,
    exhaustFanPct: 35,
    heatingValvePct: 9,
    coolingValvePct: 0,
  },
  deltaU: {
    supplySetpointC: -0.5,
    supplyFanPct: -4,
    exhaustFanPct: -2,
    heatingValvePct: -4,
    coolingValvePct: 0,
  },
  extractTempMeasC: 22.86616556007397,
  extractTempPredC: 24.84844044672927,
  outdoorTempC: 15.4321,
  outdoorTempFrostC: 15.1,
  outdoorTempBmsC: 15.6,
  marginalKrPerKwh: 1.697456,
  electricKw: 12,
  heatKw: 3,
  costBaselineKr: 1.2,
  costEmulatedKr: 1.1,
  costMpcKr: 1.0,
  costDemandKr: 1.05,
  comfortViolation: false,
  usedFallback: false,
};

describe("compactMpcReplayStep", () => {
  it("bevarer vær/pris i kompakt payload", () => {
    const compact = compactMpcReplayStep(sampleStep);
    expect(compact.ot).toBe(15.4);
    expect(compact.otf).toBe(15.1);
    expect(compact.otb).toBe(15.6);
    expect(compact.mp).toBe(1.697);
    expect(compact.xp).toBe(24.8);

    const expanded = expandCompactMpcReplayStep(sampleStep.t, compact);
    expect(expanded.outdoorTempC).toBe(15.4);
    expect(expanded.marginalKrPerKwh).toBe(1.697);
    expect(expanded.extractTempPredC).toBe(24.8);
  });

  it("bevarer demand-vektor og kostnad i kompakt payload", () => {
    const compact = compactMpcReplayStep(sampleStep);
    expect(compact.d).toEqual([18, 39, 35, 9, 0]);
    expect(compact.cd).toBe(1.05);

    const expanded = expandCompactMpcReplayStep(sampleStep.t, compact);
    expect(expanded.uDemand?.supplyFanPct).toBe(39);
    expect(expanded.costDemandKr).toBe(1.05);
  });
});
