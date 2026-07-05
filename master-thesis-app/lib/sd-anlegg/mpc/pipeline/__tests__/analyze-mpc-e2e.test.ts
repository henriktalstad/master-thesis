import { describe, expect, it } from "bun:test";
import {
  controlVector,
  deltaControlVectors,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import {
  analyzeMpcReplaySteps,
  analyzeMpcTimesteps,
  buildMpcE2eDiagnosis,
  resolveMpcE2eHealth,
} from "@/lib/sd-anlegg/mpc/pipeline/analyze-e2e";
import type { MpcReplayStep, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function baseStep(overrides: Partial<MpcTimestep> = {}): MpcTimestep {
  return {
    t: "2026-06-24T10:00:00.000Z",
    tMs: Date.parse("2026-06-24T10:00:00.000Z"),
    dowUtc: 3,
    hourUtc: 10,
    quarterUtc: 0,
    hourLocal: 10,
    uMeas: controlVector({
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 30,
      heatingValvePct: 10,
    }),
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    extractTempC: 20,
    outdoorTempC: 15,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1.2,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 1,
    buildingDistrictHeatingKwh: 0.5,
    heatingActive: true,
    coolingActive: false,
    ...overrides,
  };
}

describe("analyzeMpcTimesteps", () => {
  it("rapporterer full uMeas-dekning", () => {
    const result = analyzeMpcTimesteps([baseStep(), baseStep()]);
    expect(result.uMeasCoveragePct.fullVector).toBe(100);
    expect(result.optimizablePct).toBe(100);
  });

  it("fanger manglende uMeas", () => {
    const result = analyzeMpcTimesteps([
      baseStep(),
      baseStep({ uMeas: null }),
    ]);
    expect(result.uMeasCoveragePct.fullVector).toBe(50);
    expect(result.fallbackByReason.missing_u_meas).toBe(1);
  });
});

describe("resolveMpcE2eHealth", () => {
  it("grønn når input og replay er OK", () => {
    const { health, blockers } = resolveMpcE2eHealth({
      uMeasFullPct: 95,
      optimizablePct: 92,
      fallbackPct: 3,
      meaningfulDeltaPct: 12,
      highPriceShiftPct: -2,
    });
    expect(health).toBe("green");
    expect(blockers).toHaveLength(0);
  });

  it("rød ved lav dekning og høy fallback", () => {
    const { health } = resolveMpcE2eHealth({
      uMeasFullPct: 50,
      optimizablePct: 40,
      fallbackPct: 40,
      meaningfulDeltaPct: 0,
      highPriceShiftPct: null,
    });
    expect(health).toBe("red");
  });

  it("amber ved høy δu uten høypris-flytting", () => {
    const { health, blockers } = resolveMpcE2eHealth({
      uMeasFullPct: 95,
      optimizablePct: 92,
      fallbackPct: 3,
      meaningfulDeltaPct: 35,
      highPriceShiftPct: -0.05,
    });
    expect(health).toBe("amber");
    expect(blockers.some((b) => b.includes("høypris-flytting"))).toBe(true);
  });
});

describe("buildMpcE2eDiagnosis", () => {
  it("bygger rapport fra replay-steg", () => {
    const uMeas = baseStep().uMeas!;
    const uMpc = controlVector({
      supplySetpointC: 17,
      supplyFanPct: 25,
      exhaustFanPct: 30,
      heatingValvePct: 10,
    });
    const replayStep: MpcReplayStep = {
      t: "2026-06-24T10:00:00.000Z",
      uBmsMeas: uMeas,
      uBmsSim: uMeas,
      uMpc,
      deltaU: deltaControlVectors(uMpc, uMeas),
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
    const report = buildMpcE2eDiagnosis({
      source: "replay_steps",
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-06-25T00:00:00.000Z",
      timesteps: [baseStep()],
      replaySteps: [replayStep],
    });
    expect(report.stepCount).toBe(1);
    expect(report.meaningfulDeltaPct).toBeGreaterThan(0);
  });
});

describe("analyzeMpcReplaySteps", () => {
  it("teller fallback", () => {
    const step: MpcReplayStep = {
      t: "2026-06-24T10:00:00.000Z",
      uBmsMeas: null,
      uBmsSim: baseStep().uMeas!,
      uMpc: baseStep().uMeas!,
      deltaU: controlVector(),
      extractTempMeasC: null,
      extractTempPredC: null,
      electricKw: 0,
      heatKw: 0,
      marginalKrPerKwh: 1,
      outdoorTempC: 15,
      costBaselineKr: 0,
      costEmulatedKr: 0,
      costMpcKr: 0,
      comfortViolation: false,
      usedFallback: true,
      fallbackReason: "missing_u_meas",
    };
    const result = analyzeMpcReplaySteps([step, step]);
    expect(result.fallbackPct).toBe(100);
  });
});
