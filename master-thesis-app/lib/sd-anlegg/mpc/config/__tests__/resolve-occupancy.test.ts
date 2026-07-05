import { describe, expect, it } from "bun:test";
import {
  isNorwegianPublicHoliday,
  norwegianPublicHolidaysForYear,
} from "@/lib/calendar/norwegian-public-holidays";
import {
  NAERBYEN_OFFICE_OPERATING_PROFILE,
  alignEmulatedControlWithMeasured,
  applyOccupancyAnchorHorizon,
  applyOccupancyToControlAnchor,
  applyOffStateControl,
  fitOccupancyCalibrationFromSteps,
  measuredOccupancyFromControl,
  rampScalarToward,
  resolveOccupancyForStep,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(partial: Partial<MpcTimestep> & Pick<MpcTimestep, "t" | "hourLocal">): MpcTimestep {
  return {
    tMs: Date.parse(partial.t),
    dowUtc: 0,
    hourUtc: 0,
    quarterUtc: 0,
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    extractTempC: null,
    outdoorTempC: 15,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 0.5,
    buildingDistrictHeatingKwh: 0.2,
    heatingActive: false,
    coolingActive: false,
    ...partial,
  };
}

describe("resolveOccupancyForStep", () => {
  it("gir q=0 på lørdag morgen fra schedule", () => {
    const result = resolveOccupancyForStep(
      step({
        t: "2026-07-04T07:45:00.000Z",
        hourLocal: 9,
        uMeas: null,
      }),
      NAERBYEN_OFFICE_OPERATING_PROFILE,
    );
    expect(result.q).toBe(0);
    expect(result.source).toBe("schedule");
  });

  it("gir q=0 fra målt av-pådrag", () => {
    const result = resolveOccupancyForStep(
      step({
        t: "2026-06-24T12:00:00.000Z",
        hourLocal: 14,
        uMeas: {
          supplySetpointC: 18,
          supplyFanPct: 0,
          exhaustFanPct: 0,
          heatingValvePct: 0,
          coolingValvePct: 0,
          districtTr002ValvePct: 0,
          districtTr003ValvePct: 0,
        },
      }),
      NAERBYEN_OFFICE_OPERATING_PROFILE,
    );
    expect(result.q).toBe(0);
    expect(result.source).toBe("measured");
  });

  it("gir q=1 på ukedag i åpningstid", () => {
    const result = resolveOccupancyForStep(
      step({
        t: "2026-06-24T12:00:00.000Z",
        hourLocal: 14,
        uMeas: null,
      }),
      NAERBYEN_OFFICE_OPERATING_PROFILE,
    );
    expect(result.q).toBe(1);
  });
});

describe("applyOffStateControl", () => {
  it("nullstiller vifter og batterier men beholder FV-ventiler", () => {
    const off = applyOffStateControl({
      supplySetpointC: 20,
      supplyFanPct: 65,
      exhaustFanPct: 60,
      heatingValvePct: 10,
      coolingValvePct: 35,
      districtTr002ValvePct: 5,
      districtTr003ValvePct: 12,
    });
    expect(off.supplyFanPct).toBe(0);
    expect(off.coolingValvePct).toBe(0);
    expect(off.districtTr003ValvePct).toBe(12);
  });
});

const sampleU = {
  supplySetpointC: 20,
  supplyFanPct: 65,
  exhaustFanPct: 60,
  heatingValvePct: 10,
  coolingValvePct: 35,
  districtTr002ValvePct: 5,
  districtTr003ValvePct: 5,
};

describe("applyOccupancyToControlAnchor setpoint ramp", () => {
  it("ramper tilluft-SP mot setback ved lavt belegg", () => {
    const prev = { ...sampleU, supplySetpointC: 21.5 };
    const result = applyOccupancyToControlAnchor(sampleU, 0, {
      previousU: prev,
      setpointMaxDeltaPerStep: 1.5,
    });
    expect(result.supplySetpointC).toBe(20);
    expect(result.supplyFanPct).toBe(0);
  });

  it("kjeder flere steg mot 16 °C setback", () => {
    const ramped = applyOccupancyAnchorHorizon(
      [sampleU, sampleU, sampleU, sampleU],
      [0, 0, 0, 0],
      {
        previousU: { ...sampleU, supplySetpointC: 21.5 },
        setpointMaxDeltaPerStep: 1.5,
      },
    );
    expect(ramped.map((u) => u.supplySetpointC)).toEqual([20, 18.5, 17, 16]);
  });

  it("rampScalarToward stopper på mål", () => {
    expect(rampScalarToward(17, 16, 1.5)).toBe(16);
  });
});

describe("measuredOccupancyFromControl", () => {
  it("klassifiserer ikke kun FV-aktiv drift som helt av", () => {
    const q = measuredOccupancyFromControl({
      supplySetpointC: 18,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 12,
    });
    expect(q).not.toBeNull();
    expect(q!).toBeGreaterThanOrEqual(0.15);
  });
});

describe("alignEmulatedControlWithMeasured", () => {
  it("trekker TR003 mot målt når emulatoren underpredikerer", () => {
    const aligned = alignEmulatedControlWithMeasured(
      {
        supplySetpointC: 18,
        supplyFanPct: 0,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 0,
      },
      {
        supplySetpointC: 18,
        supplyFanPct: 0,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 12,
      },
    );
    expect(aligned.districtTr003ValvePct).toBe(12);
  });

  it("trekker kjøleventil mot målt når emulatoren underpredikerer", () => {
    const aligned = alignEmulatedControlWithMeasured(
      {
        supplySetpointC: 18,
        supplyFanPct: 40,
        exhaustFanPct: 40,
        heatingValvePct: 0,
        coolingValvePct: 0,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 0,
      },
      {
        supplySetpointC: 18,
        supplyFanPct: 40,
        exhaustFanPct: 40,
        heatingValvePct: 0,
        coolingValvePct: 35,
        districtTr002ValvePct: 0,
        districtTr003ValvePct: 0,
      },
    );
    expect(aligned.coolingValvePct).toBe(35);
  });
});

describe("fitOccupancyCalibrationFromSteps", () => {
  it("lager historisk q per dow×time", () => {
    const calibration = fitOccupancyCalibrationFromSteps([
      step({
        t: "2026-07-04T07:45:00.000Z",
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
      }),
    ]);
    expect(Object.keys(calibration.historicalQByDowHour).length).toBeGreaterThan(0);
  });
});

describe("norwegianPublicHolidays", () => {
  it("markerer 17. mai som helligdag", () => {
    expect(isNorwegianPublicHoliday("2026-05-17T10:00:00.000Z")).toBe(true);
  });

  it("inkluderer påske i 2026", () => {
    const holidays = norwegianPublicHolidaysForYear(2026);
    expect(holidays.has("2026-04-05")).toBe(true);
  });
});
