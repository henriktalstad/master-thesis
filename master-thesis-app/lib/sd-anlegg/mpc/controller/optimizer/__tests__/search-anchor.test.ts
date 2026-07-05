import { describe, expect, it } from "bun:test";
import { fitBaselineEmulator } from "@/lib/sd-anlegg/envelope-model";
import {
  buildBmsSimHorizon,
  buildMpcSearchAnchorHorizon,
  horizonMovePenaltyScale,
  marginalEnergyWeight,
} from "../solve-horizon";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(partial: Partial<MpcTimestep>): MpcTimestep {
  return {
    t: "2026-06-20T08:00:00.000Z",
    tMs: Date.parse("2026-06-20T08:00:00.000Z"),
    dowUtc: 5,
    hourUtc: 8,
    quarterUtc: 0,
    hourLocal: 10,
    supplySetpointOperatorC: 18,
    supplySetpointCalcC: 18,
    extractTempC: 22,
    outdoorTempC: 12,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 2,
    buildingDistrictHeatingKwh: 0.5,
    heatingActive: true,
    coolingActive: false,
    uMeas: {
      supplySetpointC: 20,
      supplyFanPct: 55,
      exhaustFanPct: 55,
      heatingValvePct: 40,
      coolingValvePct: 0,
      districtTr002ValvePct: 10,
      districtTr003ValvePct: 12,
    },
    ...partial,
  };
}

describe("mpc search anchor", () => {
  it("hybrid bruker uMeas kun på første horisontsteg", () => {
    const train = [step({}), step({ t: "2026-06-20T08:15:00.000Z" })];
    const emulator = fitBaselineEmulator(train);
    const calibration = {
      modelVersion: "mpc-v1",
      trainedAt: new Date().toISOString(),
      trainStepCount: 2,
      holdoutStepCount: 0,
      emulator,
      plant: null as never,
      power: {
        version: "power-v1",
        betaFan: 1,
        betaHeat: 1,
        betaCool: 1,
        controllableElectricShare: 0.4,
        controllableHeatShare: 0.4,
      },
      solver: {} as never,
    };

    const hybrid = buildMpcSearchAnchorHorizon(train, 0, 2, calibration, "hybrid");
    expect(hybrid[0]?.supplyFanPct).toBe(55);
    const simOnly = buildBmsSimHorizon(train, 0, 2, calibration);
    expect(hybrid[1]?.supplyFanPct).toBe(simOnly[1]?.supplyFanPct);
  });
});

describe("economic objective helpers", () => {
  it("marginalEnergyWeight øker ved høy pris", () => {
    expect(marginalEnergyWeight(1.8, 1)).toBeGreaterThan(marginalEnergyWeight(0.7, 1));
  });

  it("horizonMovePenaltyScale senker straff ved høy og lav pris", () => {
    const thresholds = { high: 1.5, low: 0.8 };
    expect(
      horizonMovePenaltyScale({ stepPrice: 1.6, priceThresholds: thresholds }),
    ).toBeLessThan(
      horizonMovePenaltyScale({ stepPrice: 1.1, priceThresholds: thresholds }),
    );
    expect(
      horizonMovePenaltyScale({ stepPrice: 0.75, priceThresholds: thresholds }),
    ).toBeLessThan(1);
  });
});
