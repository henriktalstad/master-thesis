import { describe, expect, it } from "bun:test";
import { fitPlantModel } from "@/lib/sd-anlegg/envelope-model";
import { advancePlantHorizonState } from "../plant-horizon-rollout";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(partial: Partial<MpcTimestep>): MpcTimestep {
  return {
    t: partial.t ?? "2026-06-20T08:00:00.000Z",
    tMs: Date.parse(partial.t ?? "2026-06-20T08:00:00.000Z"),
    dowUtc: 5,
    hourUtc: 8,
    quarterUtc: 0,
    hourLocal: 10,
    supplySetpointOperatorC: 18,
    supplySetpointCalcC: 18,
    extractTempC: 22,
    outdoorTempC: 5,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 2,
    buildingDistrictHeatingKwh: 0.5,
    heatingActive: true,
    coolingActive: false,
    heatRecoveryAfterTempC: 14,
    uMeas: {
      supplySetpointC: 20,
      supplyFanPct: 55,
      exhaustFanPct: 55,
      heatingValvePct: 40,
      coolingValvePct: 0,
      districtTr002ValvePct: 30,
      districtTr003ValvePct: 35,
    },
    ...partial,
  };
}

describe("advancePlantHorizonState", () => {
  it("propagerer både extract og varmegjenvinner-tilstand", () => {
    const train = Array.from({ length: 80 }, (_, i) =>
      step({
        t: new Date(Date.parse("2026-06-20T06:00:00.000Z") + i * 15 * 60_000).toISOString(),
        tMs: Date.parse("2026-06-20T06:00:00.000Z") + i * 15 * 60_000,
        extractTempC: 21 + (i % 5) * 0.1,
        heatRecoveryAfterTempC: 13 + (i % 4) * 0.1,
      }),
    );
    const plant = fitPlantModel(train);
    expect(plant?.heatRecoveryState).toBeDefined();
    if (!plant?.heatRecoveryState) return;

    const rolled = advancePlantHorizonState({
      plant,
      state: { tExt: 21.5, tRec: 13.2 },
      u: train[0]!.uMeas!,
      step: train[0]!,
    });

    expect(rolled.extractPred).not.toBeNull();
    expect(rolled.heatRecoveryPred).not.toBeNull();
    expect(rolled.state.tExt).not.toBe(21.5);
    expect(rolled.state.tRec).not.toBe(13.2);
  });
});
