import { describe, expect, test } from "bun:test";
import {
  buildMpcCostTimeline,
  buildMpcReplayLoadProfile,
  sumReplayDeltaCostKr,
  sumReplayDeltaCostVsEmulatedKr,
} from "@/lib/sd-anlegg/control/build-mpc-replay-profiles";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function makeStep(costBase: number, costMpc: number): MpcReplayStep {
  return {
    t: "2026-06-25T10:00:00.000Z",
    uBmsMeas: {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    uBmsSim: {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    uMpc: {
      supplySetpointC: 17.5,
      supplyFanPct: 35,
      exhaustFanPct: 33,
      heatingValvePct: 8,
      coolingValvePct: 0,
    },
    deltaU: {
      supplySetpointC: null,
      supplyFanPct: null,
      exhaustFanPct: null,
      heatingValvePct: null,
      coolingValvePct: null,
    },
    extractTempMeasC: 22,
    extractTempPredC: 21.8,
    electricKw: 0.5,
    heatKw: 0.2,
    marginalKrPerKwh: 1.1,
    comfortViolation: false,
    usedFallback: false,
    costBaselineKr: costBase,
    costMpcKr: costMpc,
    costEmulatedKr: costBase,
  };
}

describe("build-mpc-replay-profiles", () => {
  test("sumReplayDeltaCostKr summerer MPC minus baseline", () => {
    const total = sumReplayDeltaCostKr([
      makeStep(10, 8),
      makeStep(12, 11),
    ]);
    expect(total).toBe(-3);
  });

  test("sumReplayDeltaCostVsEmulatedKr bruker emulert baseline", () => {
    const total = sumReplayDeltaCostVsEmulatedKr([
      { ...makeStep(10, 8), costEmulatedKr: 9 },
      makeStep(12, 11),
    ]);
    expect(total).toBe(-2);
  });

  test("buildMpcCostTimeline aggregerer per time", () => {
    const timeline = buildMpcCostTimeline([
      { ...makeStep(5, 4), t: "2026-06-25T10:00:00.000Z" },
      { ...makeStep(5, 3), t: "2026-06-25T10:15:00.000Z" },
    ]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.baselineCostKr).toBe(10);
    expect(timeline[0]!.mpcCostKr).toBe(7);
    expect(timeline[0]!.deltaCostKr).toBe(-3);
  });

  test("buildMpcReplayLoadProfile bruker proxy el-kWh, ikke total kost/marginal", () => {
    const profile = buildMpcReplayLoadProfile([
      {
        ...makeStep(50, 40),
        t: "2026-06-25T10:00:00.000Z",
        proxyElKwhBaseline: 0.3,
        proxyElKwhEmulated: 0.25,
        proxyElKwhMpc: 0.2,
        marginalKrPerKwh: 100,
      },
      {
        ...makeStep(50, 40),
        t: "2026-06-25T10:15:00.000Z",
        proxyElKwhBaseline: 0.1,
        proxyElKwhEmulated: 0.5,
        proxyElKwhMpc: 0.15,
        marginalKrPerKwh: 100,
      },
    ]);
    expect(profile).toHaveLength(1);
    expect(profile[0]!.observedKw).toBe(0.8);
    expect(profile[0]!.actualKw).toBe(1.5);
    expect(profile[0]!.simulatedKw).toBe(0.7);
    expect(profile[0]!.peakEmulatedKw).toBe(2);
    expect(profile[0]!.peakMpcKw).toBe(0.8);
  });
});
