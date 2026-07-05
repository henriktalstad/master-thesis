import { describe, expect, test } from "bun:test";
import {
  emulateBaselineControl,
  fitBaselineEmulator,
} from "../fit-baseline-emulator";
import { validateBaselineEmulator } from "../validate-baseline-emulator";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function syntheticStep(i: number): MpcTimestep {
  const hour = 6 + (i % 12);
  return {
    t: new Date(Date.UTC(2026, 5, 16, hour, (i % 4) * 15)).toISOString(),
    tMs: 0,
    dowUtc: 1,
    hourUtc: hour,
    quarterUtc: i % 4,
    hourLocal: hour,
    uMeas: {
      supplySetpointC: 18 + (hour - 6) * 0.1,
      supplyFanPct: 35,
      exhaustFanPct: 33,
      heatingValvePct: hour < 8 ? 40 : 5,
      coolingValvePct: 0,
    },
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    extractTempC: 21,
    outdoorTempC: 5,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1.5,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 10,
    buildingDistrictHeatingKwh: 5,
    heatingActive: hour < 8,
    coolingActive: false,
  };
}

describe("baseline emulator", () => {
  test("lav MAE på syntetisk treningsdata", () => {
    const steps = Array.from({ length: 80 }, (_, i) => syntheticStep(i));
    const params = fitBaselineEmulator(steps);
    const validation = validateBaselineEmulator(steps.slice(60), params);
    expect(validation.comparedSteps).toBeGreaterThan(0);
    expect(validation.mae.supplySetpointC ?? 99).toBeLessThan(1);
    const sim = emulateBaselineControl(params, steps[0]!, { fallback: steps[0]!.uMeas });
    expect(sim.supplyFanPct).toBeGreaterThan(0);
  });
});
