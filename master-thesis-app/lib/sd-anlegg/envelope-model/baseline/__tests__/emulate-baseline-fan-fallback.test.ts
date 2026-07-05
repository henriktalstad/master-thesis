import { describe, expect, test } from "bun:test";
import { emulateBaselineControl } from "@/lib/sd-anlegg/envelope-model/baseline/fit-emulator";
import type { BaselineEmulatorParams, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

const weekdayStep: MpcTimestep = {
  t: "2026-07-01T12:00:00.000Z",
  tMs: 0,
  dowUtc: 2,
  hourUtc: 12,
  quarterUtc: 0,
  hourLocal: 14,
  uMeas: {
    supplySetpointC: 18,
    supplyFanPct: 67,
    exhaustFanPct: 65,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  },
  supplySetpointOperatorC: null,
  supplySetpointCalcC: null,
  extractTempC: 22,
  outdoorTempC: 15,
  spotKrPerKwh: 1,
  effectiveMarginalKrPerKwh: 1.2,
  heatKrPerKwh: 0.5,
  buildingElectricityKwh: 0.5,
  buildingDistrictHeatingKwh: 0.2,
  heatingActive: false,
  coolingActive: false,
};

const saturdayStep: MpcTimestep = {
  ...weekdayStep,
  t: "2026-07-04T07:45:00.000Z",
  dowUtc: 6,
  hourUtc: 7,
  hourLocal: 9,
  uMeas: {
    supplySetpointC: 17,
    supplyFanPct: 0,
    exhaustFanPct: 0,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  },
};

describe("emulateBaselineControl", () => {
  test("respekterer lært helg-mal med 0 % vifter", () => {
    const params: BaselineEmulatorParams = {
      version: "bms-emulator-v1.2-plant-aware",
      templates: {
        "6:7:3": {
          supplyFanPct: 0,
          exhaustFanPct: 0,
          supplySetpointC: 17,
        },
      },
      weatherSlopes: {},
      globalMedians: {
        supplySetpointC: 18.1,
        supplyFanPct: 65,
        exhaustFanPct: 62,
        heatingValvePct: 0,
        coolingValvePct: 0,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 0,
      },
    };
    const sim = emulateBaselineControl(params, saturdayStep, {
      fallback: saturdayStep.uMeas!,
    });
    expect(sim.supplyFanPct).toBe(0);
    expect(sim.exhaustFanPct).toBe(0);
  });

  test("bruker global median når mal mangler for vifter", () => {
    const params: BaselineEmulatorParams = {
      version: "bms-emulator-v1.2-plant-aware",
      templates: {
        "2:12:0": {
          supplySetpointC: 18.1,
        },
      },
      weatherSlopes: {},
      globalMedians: {
        supplySetpointC: 18.1,
        supplyFanPct: 65,
        exhaustFanPct: 62,
        heatingValvePct: 0,
        coolingValvePct: 0,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 0,
      },
    };
    const sim = emulateBaselineControl(params, weekdayStep);
    expect(sim.supplyFanPct).toBe(65);
    expect(sim.exhaustFanPct).toBe(62);
  });

  test("bruker time-mal fra andre ukedager når eksakt (ukedag, time, kvarter) mangler helt", () => {
    const params: BaselineEmulatorParams = {
      version: "bms-emulator-v1.3-hourly-fallback",
      templates: {
        "0:5:0": { supplyFanPct: 68, exhaustFanPct: 64 },
        "1:5:0": { supplyFanPct: 66, exhaustFanPct: 63 },
      },
      hourlyTemplates: {
        "5:0": { supplyFanPct: 67, exhaustFanPct: 63.5 },
      },
      weatherSlopes: {},
      globalMedians: {
        supplySetpointC: 18.1,
        supplyFanPct: 30,
        exhaustFanPct: 30,
        heatingValvePct: 0,
        coolingValvePct: 0,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 0,
      },
    };
    const wednesdayGapStep: MpcTimestep = {
      ...weekdayStep,
      t: "2026-07-01T05:00:00.000Z",
      dowUtc: 2,
      hourUtc: 5,
      quarterUtc: 0,
    };
    const sim = emulateBaselineControl(params, wednesdayGapStep);
    expect(sim.supplyFanPct).toBe(67);
    expect(sim.exhaustFanPct).toBe(63.5);
  });

  test("nullstiller kjøling når BMS-modus er av", () => {
    const params: BaselineEmulatorParams = {
      version: "bms-emulator-v1.2-plant-aware",
      templates: {
        "2:12:0": {
          supplyFanPct: 68,
          exhaustFanPct: 63,
          supplySetpointC: 20,
          coolingValvePct: 85,
        },
      },
      weatherSlopes: { coolingValvePct: 2.5 },
      globalMedians: {
        supplySetpointC: 20,
        supplyFanPct: 68,
        exhaustFanPct: 63,
        heatingValvePct: 0,
        coolingValvePct: 85,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 0,
      },
    };
    const hotDay: MpcTimestep = {
      ...weekdayStep,
      outdoorTempC: 28,
      coolingActive: false,
      uMeas: { ...weekdayStep.uMeas!, coolingValvePct: 0 },
    };
    const sim = emulateBaselineControl(params, hotDay, { fallback: hotDay.uMeas! });
    expect(sim.coolingValvePct).toBe(0);
  });
});
