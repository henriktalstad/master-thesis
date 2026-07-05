import { describe, expect, it } from "bun:test";
import {
  evaluatePreferenceCondition,
  mpcChannelEnabledForStep,
  zeroDisabledDeltaComponents,
} from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import {
  resolveMpcBuildingPreferences,
  solverConfigFromPreferences,
} from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import { NAERBYEN_BUILDING_SLUG } from "@/lib/sd-anlegg/mpc/config/buildings/naerbyen-360102-preferences";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function stubStep(
  partial: Partial<MpcTimestep> & Pick<MpcTimestep, "uMeas">,
): MpcTimestep {
  return {
    t: "2026-06-24T12:00:00.000Z",
    outdoorTempC: 15,
    extractTempC: 21,
    heatingActive: false,
    coolingActive: false,
    buildingElectricityKwh: 10,
    buildingDistrictHeatingKwh: 2,
    spotKrPerKwh: 1,
    heatKrPerKwh: 0.5,
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    extractSetpointC: 22,
    ...partial,
  };
}

describe("evaluatePreferenceCondition", () => {
  it("when_fan_on krever vifte over terskel", () => {
    const off = stubStep({
      uMeas: {
        supplySetpointC: 18,
        supplyFanPct: 0,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
    });
    const on = stubStep({
      uMeas: {
        supplySetpointC: 18,
        supplyFanPct: 20,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
    });
    expect(evaluatePreferenceCondition("when_fan_on", off)).toBe(false);
    expect(evaluatePreferenceCondition("when_fan_on", on)).toBe(true);
  });

  it("when_heating_active følger heatingActive", () => {
    const step = stubStep({
      heatingActive: true,
      uMeas: {
        supplySetpointC: 18,
        supplyFanPct: 30,
        exhaustFanPct: 30,
        heatingValvePct: 40,
        coolingValvePct: 0,
      },
    });
    expect(evaluatePreferenceCondition("when_heating_active", step)).toBe(true);
  });
  it("when_fan_on kan bruke referanse-u når uMeas mangler", () => {
    const off = stubStep({
      uMeas: null as unknown as MpcTimestep["uMeas"],
    });
    expect(
      evaluatePreferenceCondition("when_fan_on", off, {
        supplySetpointC: 18,
        supplyFanPct: 40,
        exhaustFanPct: 35,
        heatingValvePct: 0,
        coolingValvePct: 0,
      }),
    ).toBe(true);
  });

  it("when_demand og when_fan_on tillater forvarming (q=0.3)", () => {
    const step = stubStep({
      uMeas: {
        supplySetpointC: 18,
        supplyFanPct: 30,
        exhaustFanPct: 30,
        heatingValvePct: 40,
        coolingValvePct: 0,
      },
    });
    expect(evaluatePreferenceCondition("when_demand", step, null, 0.3)).toBe(
      true,
    );
    expect(evaluatePreferenceCondition("when_fan_on", step, null, 0.3)).toBe(
      true,
    );
  });

  it("when_demand og kanaler blokkeres ved q=0 (helg/off-state)", () => {
    const step = stubStep({
      uMeas: {
        supplySetpointC: 18,
        supplyFanPct: 30,
        exhaustFanPct: 30,
        heatingValvePct: 40,
        coolingValvePct: 0,
      },
    });
    expect(evaluatePreferenceCondition("when_demand", step, null, 0)).toBe(
      false,
    );
    expect(evaluatePreferenceCondition("when_fan_on", step, null, 0)).toBe(
      false,
    );
  });
});

describe("mpcChannelEnabledForStep", () => {
  it("slår av varmeventil når varme ikke er aktiv", () => {
    const prefs = resolveMpcBuildingPreferences({
      buildingSlug: NAERBYEN_BUILDING_SLUG,
    });
    expect(prefs).not.toBeNull();
    const step = stubStep({
      heatingActive: false,
      uMeas: {
        supplySetpointC: 18,
        supplyFanPct: 30,
        exhaustFanPct: 30,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
    });
    const enabled = mpcChannelEnabledForStep(prefs!, step);
    expect(enabled.heatingValvePct).toBe(false);
    expect(enabled.supplySetpointC).toBe(true);
  });

  it("supplySetpointC deaktiveres ved q=0", () => {
    const prefs = resolveMpcBuildingPreferences({
      buildingSlug: NAERBYEN_BUILDING_SLUG,
    })!;
    const step = stubStep({
      uMeas: {
        supplySetpointC: 18,
        supplyFanPct: 0,
        exhaustFanPct: 0,
        heatingValvePct: 0,
        coolingValvePct: 0,
      },
    });
    const enabled = mpcChannelEnabledForStep(prefs, step, null, 0);
    expect(enabled.supplySetpointC).toBe(false);
  });
});

describe("zeroDisabledDeltaComponents", () => {
  it("nullstiller deaktiverte kanaler", () => {
    const delta = {
      supplySetpointC: 1,
      supplyFanPct: 2,
      exhaustFanPct: 3,
      heatingValvePct: 4,
      coolingValvePct: 5,
    };
    const out = zeroDisabledDeltaComponents(delta, {
      supplySetpointC: true,
      supplyFanPct: false,
      exhaustFanPct: true,
      heatingValvePct: false,
      coolingValvePct: true,
    });
    expect(out.supplyFanPct).toBe(0);
    expect(out.heatingValvePct).toBe(0);
    expect(out.supplySetpointC).toBe(1);
  });
});

describe("resolveMpcBuildingPreferences", () => {
  it("inkluderer alle kanaler for Nærbyen", () => {
    const prefs = resolveMpcBuildingPreferences({
      buildingSlug: NAERBYEN_BUILDING_SLUG,
    });
    expect(prefs?.channels.length).toBe(9);
    expect(prefs?.channels.some((c) => c.id === "extractSetpointC")).toBe(true);
    expect(prefs?.channels.some((c) => c.id === "supplySetpointCalcC")).toBe(
      true,
    );
  });

  it("solverConfigFromPreferences bruker komfortband fra preferanser", () => {
    const prefs = resolveMpcBuildingPreferences({
      buildingSlug: NAERBYEN_BUILDING_SLUG,
      overrides: { comfortBandMinC: 19, comfortBandMaxC: 23 },
    })!;
    const solver = solverConfigFromPreferences(prefs);
    expect(solver.comfortBandC).toEqual({ min: 19, max: 23 });
  });

  it("leser komfortband fra Building.comfortTargets når overrides mangler", () => {
    const prefs = resolveMpcBuildingPreferences({
      buildingSlug: NAERBYEN_BUILDING_SLUG,
      comfortTargets: { min: 19, max: 23 },
    })!;
    expect(prefs.comfortBandC).toEqual({ min: 19, max: 23 });
  });
});
