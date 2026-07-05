import { describe, expect, test } from "bun:test";
import {
  emulateBaselineControl,
  fitBaselineEmulator,
} from "@/lib/sd-anlegg/envelope-model/baseline/fit-emulator";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(i: number, extractTempC: number, heatingValvePct: number): MpcTimestep {
  const hour = 6 + (i % 8);
  return {
    t: new Date(Date.UTC(2026, 5, 16, hour, (i % 4) * 15)).toISOString(),
    tMs: 0,
    dowUtc: 1,
    hourUtc: hour,
    quarterUtc: i % 4,
    hourLocal: hour,
    uMeas: {
      supplySetpointC: 18,
      supplyFanPct: 35,
      exhaustFanPct: 33,
      heatingValvePct,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    },
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    extractTempC,
    extractSetpointC: 21,
    outdoorTempC: 5,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1.5,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 10,
    buildingDistrictHeatingKwh: 5,
    heatingActive: heatingValvePct > 8,
    coolingActive: false,
  };
}

describe("plant-aware baseline emulator", () => {
  test("øker varmebatteri når avtrekk er kaldere enn SP", () => {
    const train = [
      ...Array.from({ length: 40 }, (_, i) => step(i, 19.5, 45)),
      ...Array.from({ length: 40 }, (_, i) => step(i + 40, 22.5, 5)),
    ];
    const params = fitBaselineEmulator(train);
    expect(params.version).toBe("bms-emulator-v1.3-hourly-fallback");
    expect(params.comfortErrorSlopes?.heatingValvePct).toBeGreaterThan(0);

    const cold = step(0, 19, 0);
    const warm = step(0, 23, 0);
    const coldSim = emulateBaselineControl(params, cold, { tExtPrev: 19 });
    const warmSim = emulateBaselineControl(params, warm, { tExtPrev: 23 });
    expect(coldSim.heatingValvePct).toBeGreaterThan(warmSim.heatingValvePct);
  });

  test("ikke kopier målt u uten eksplisitt fallback", () => {
    const train = Array.from({ length: 60 }, (_, i) => step(i, 21, 20));
    const params = fitBaselineEmulator(train);
    const probe = step(0, 21, 99);
    const sim = emulateBaselineControl(params, probe, { tExtPrev: 21 });
    expect(sim.heatingValvePct).toBeLessThan(50);
  });
});
