import { describe, expect, test } from "bun:test";
import { resolvePlantFeatureNames } from "../spec/resolve-features";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(partial: Partial<MpcTimestep> & Pick<MpcTimestep, "t">): MpcTimestep {
  return {
    tMs: Date.parse(partial.t),
    dowUtc: 1,
    hourUtc: 12,
    quarterUtc: 0,
    hourLocal: 12,
    uMeas: {
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 28,
      heatingValvePct: 0,
      coolingValvePct: 10,
    },
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    extractTempC: 23,
    outdoorTempC: 15,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 0.2,
    buildingDistrictHeatingKwh: 0.3,
    heatingActive: false,
    coolingActive: true,
    ...partial,
  };
}

describe("resolvePlantFeatureNames", () => {
  test("kjerne-features er alltid med", () => {
    const steps = [step({ t: "2026-06-01T10:00:00.000Z" }), step({ t: "2026-06-01T10:15:00.000Z" })];
    const { featureNames, featureScope } = resolvePlantFeatureNames(steps);
    expect(featureNames).toContain("t_ext_prev");
    expect(featureNames).toContain("outdoor_temp");
    expect(featureNames).toContain("solar_proxy");
    expect(
      featureScope.some(
        (f) => f.featureId === "solar_irradiance_measured" && !f.usedInModel,
      ),
    ).toBe(true);
  });

  test("valgfrie features aktiveres ved høy dekning", () => {
    const steps = Array.from({ length: 12 }, (_, i) =>
      step({
        t: new Date(Date.UTC(2026, 5, 1, 10, i * 15)).toISOString(),
        supplyTempMeasC: 17 + i * 0.01,
        intakeTempMeasC: 14,
        heatRecoveryAfterTempC: 16,
        extractSetpointC: 22,
      }),
    );
    const { featureNames } = resolvePlantFeatureNames(steps);
    expect(featureNames).toContain("supply_temp_meas");
    expect(featureNames).toContain("intake_temp_meas");
    expect(featureNames).toContain("heat_recovery_after_temp");
    expect(featureNames).toContain("extract_setpoint");
  });

  test("valgfrie features utelates ved lav dekning", () => {
    const steps = [
      step({ t: "2026-06-01T10:00:00.000Z", supplyTempMeasC: 17 }),
      step({ t: "2026-06-01T10:15:00.000Z" }),
      step({ t: "2026-06-01T10:30:00.000Z", supplyTempMeasC: 18 }),
      step({ t: "2026-06-01T10:45:00.000Z" }),
    ];
    const { featureNames, featureScope } = resolvePlantFeatureNames(steps);
    expect(featureNames).not.toContain("supply_temp_meas");
    const supplyScope = featureScope.find((f) => f.featureId === "supply_temp_meas");
    expect(supplyScope?.usedInModel).toBe(false);
    expect(supplyScope?.availability).toBe("partial");
  });
});
