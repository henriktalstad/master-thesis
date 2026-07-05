import { describe, expect, it } from "bun:test";
import {
  pickReplayStepsForForwardPlan,
  resolveMpcInitialControl,
} from "@/lib/sd-anlegg/control/resolve-mpc-initial-control";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function stubReplay(partial: Partial<MpcReplayStep>): MpcReplayStep {
  return {
    t: "2026-07-01T12:00:00.000Z",
    uBmsMeas: null,
    uBmsSim: {
      supplySetpointC: 18,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    uMpc: {
      supplySetpointC: 18,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
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
    costBaselineKr: 0,
    costEmulatedKr: 0,
    costMpcKr: 0,
    outdoorTempC: null,
    ...partial,
  };
}

describe("resolveMpcInitialControl", () => {
  it("bruker live override selv når vifte er av (0 %)", () => {
    const u = resolveMpcInitialControl({
      override: {
        supplySetpointC: 18,
        supplyFanPct: 0,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
      replaySteps: [
        stubReplay({
          uBmsMeas: {
            supplySetpointC: 18,
            supplyFanPct: 68,
            exhaustFanPct: 65,
            heatingValvePct: 0,
            coolingValvePct: 0,
          },
        }),
      ],
    });
    expect(u?.supplyFanPct).toBe(0);
  });
});

describe("pickReplayStepsForForwardPlan", () => {
  it("beholder live-loop når uMeas finnes, også med vifte av", () => {
    const loopSteps = [
      stubReplay({
        uBmsMeas: {
          supplySetpointC: 18,
          supplyFanPct: 0,
          exhaustFanPct: 0,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
      }),
    ];
    const evalSteps = [
      stubReplay({
        uBmsMeas: {
          supplySetpointC: 18,
          supplyFanPct: 68,
          exhaustFanPct: 65,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
      }),
    ];
    const picked = pickReplayStepsForForwardPlan({
      loopSteps,
      evalReplaySteps: evalSteps,
    });
    expect(picked).toEqual(loopSteps);
  });

  it("faller tilbake til eval når live-loop mangler uMeas", () => {
    const evalSteps = [
      stubReplay({
        uBmsMeas: {
          supplySetpointC: 18,
          supplyFanPct: 68,
          exhaustFanPct: 65,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
      }),
    ];
    const picked = pickReplayStepsForForwardPlan({
      loopSteps: [stubReplay({})],
      evalReplaySteps: evalSteps,
    });
    expect(picked).toEqual(evalSteps);
  });
});
