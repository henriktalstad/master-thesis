import { describe, expect, test } from "bun:test";
import {
  buildScopedSignalComparison,
} from "@/lib/sd-anlegg/control/build-control-signal-comparison";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import type { ControlHourlyEnergy } from "@/lib/sd-anlegg/control/control-types";
import type { ControlSdHourlyProfile } from "@/lib/sd-anlegg/control/control-sd-calibration";
import { computeScopedShadowFactors } from "@/lib/sd-anlegg/control/shadow-control-policy";

function energyRow(hour: number, day = 20): ControlHourlyEnergy {
  const d = new Date(Date.UTC(2026, 5, day, hour, 0, 0, 0));
  return {
    hour: d.toISOString(),
    electricityKwh: 12,
    districtHeatingKwh: 5,
    electricityCostKr: 10,
    districtHeatingCostKr: 4,
    totalCostKr: 14,
  };
}

function sdRow(
  hour: number,
  overrides: Partial<Omit<ControlSdHourlyProfile, "hour">> = {},
): ControlSdHourlyProfile {
  const d = new Date(Date.UTC(2026, 5, 20, hour, 0, 0, 0));
  return {
    hour: d.toISOString(),
    supplySetpointC: 18,
    supplySetpointCalcC: 20,
    extractSetpointC: 21,
    supplyTempC: 17.5,
    extractTempC: 22,
    supplyFanPct: 50,
    heatingValvePct: 30,
    ...overrides,
  };
}

describe("buildScopedSignalComparison", () => {
  test("bygger settpunkt vs målt-serier", () => {
    const hourlyEnergy = Array.from({ length: 24 }, (_, h) => energyRow(h));
    const sdProfiles = Array.from({ length: 24 }, (_, h) => sdRow(h));
    const gjeldendeByHour = new Map(
      sdProfiles.map((p) => [controlHourKeyFromIso(p.hour), p]),
    );

    const result = buildScopedSignalComparison({
      hourlyEnergy,
      gjeldendeByHour,
      scopedByHour: gjeldendeByHour,
      factorsByHour: new Map(),
    });

    expect(result.series.length).toBeGreaterThanOrEqual(2);
    const supply = result.series.find((s) => s.id === "supply_setpoint_vs_measured");
    expect(supply).toBeDefined();
    expect(supply!.summary.sampleHours).toBe(24);
    expect(supply!.summary.meanAbsError).toBe(0.5);
  });

  test("gjeldende vs scoped-serie ved avvik", () => {
    const hourlyEnergy = Array.from({ length: 24 }, (_, h) => energyRow(h));
    const gjeldende = Array.from({ length: 24 }, (_, h) =>
      sdRow(h, { supplyFanPct: 70, exhaustFanPct: 65 }),
    );
    const scoped = Array.from({ length: 24 }, (_, h) =>
      sdRow(h, { supplyFanPct: 50, exhaustFanPct: 45 }),
    );
    const gjeldendeByHour = new Map(
      gjeldende.map((p) => [controlHourKeyFromIso(p.hour), p]),
    );
    const scopedByHour = new Map(
      scoped.map((p) => [controlHourKeyFromIso(p.hour), p]),
    );
    const factorsByHour = new Map(
      gjeldende.map((p) => [
        controlHourKeyFromIso(p.hour),
        computeScopedShadowFactors({
          hourIso: p.hour,
          hourUtc: new Date(p.hour).getUTCHours(),
          hourLocal: 23,
          spotKrPerKwh: 0.5,
          effectiveMarginalKrPerKwh: 0.6,
          outdoorTempC: 10,
          profile: p,
          inForecastWindow: false,
          highPriceThreshold: 2,
          lowPriceThreshold: 0.3,
        }),
      ]),
    );

    const result = buildScopedSignalComparison({
      hourlyEnergy,
      gjeldendeByHour,
      scopedByHour,
      factorsByHour,
    });

    expect(result.adjustedControlHours).toBeGreaterThan(0);
    const fanScoped = result.series.find((s) => s.id === "supply_fan_scoped");
    expect(fanScoped).toBeDefined();
    expect(fanScoped!.summary.hoursWithDeviation).toBeGreaterThan(0);
  });
});
