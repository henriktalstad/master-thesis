import { describe, expect, test } from "bun:test";
import {
  buildHourlyLoadProfile,
  buildPeakAnalysis,
  buildSignalImpactAnalysis,
} from "@/lib/sd-anlegg/control/build-control-effect-analysis";
import {
  buildRunTrackingSeries,
  trackingAccuracySummary,
} from "@/lib/sd-anlegg/control/build-control-run-tracking";
import type { ControlHourlyEnergy } from "@/lib/sd-anlegg/control/control-types";
import type { ControlSdHourlyProfile } from "@/lib/sd-anlegg/control/control-sd-calibration";

function energyRow(hour: number, kwh: number, cost: number): ControlHourlyEnergy {
  const d = new Date(Date.UTC(2026, 5, 20, hour, 0, 0, 0));
  return {
    hour: d.toISOString(),
    electricityKwh: kwh,
    districtHeatingKwh: 0,
    electricityCostKr: cost,
    districtHeatingCostKr: 0,
    totalCostKr: cost,
  };
}

describe("build-control-effect-analysis", () => {
  test("finner effekttopp i lastprofil", () => {
    const rows = [
      energyRow(8, 40, 40),
      energyRow(9, 55, 55),
      energyRow(10, 30, 30),
    ];
    const profile = buildHourlyLoadProfile(rows, []);
    const peak = buildPeakAnalysis(profile);
    expect(peak.actualPeakKw).toBe(55);
    expect(peak.actualPeakHour).toBe(rows[1]!.hour);
  });

  test("korrelasjon mellom vifte-pådrag og forbruk", () => {
    const rows = Array.from({ length: 12 }, (_, h) =>
      energyRow(h, 10 + h * 2, 10 + h * 2),
    );
    const profiles: ControlSdHourlyProfile[] = rows.map((row, h) => ({
      hour: row.hour,
      supplyFanPct: 20 + h * 5,
    }));
    const impacts = buildSignalImpactAnalysis(rows, profiles);
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts[0]!.correlationKwh).toBeGreaterThan(0.9);
  });
});

describe("build-control-run-tracking", () => {
  test("beregner faktisk delta etter kjøring", () => {
    const runAt = new Date(Date.UTC(2026, 5, 18, 12, 0, 0, 0));
    const runs = [
      {
        id: "run-1",
        createdAt: runAt.toISOString(),
        horizonHours: 168,
        modelVersion: "shadow-v2",
        recommendedScenarioId: "mpc_weather_price_48h",
        recommendedSummary: { deltaPctCostKr: -5 },
        baselineSummary: { totalCostKr: 1000 },
        sdSignalCoveragePct: 80,
        metadata: null,
      },
    ];
    const hourly: ControlHourlyEnergy[] = [];
    for (let h = 0; h < 72; h++) {
      const d = new Date(runAt.getTime() + (h - 36) * 3_600_000);
      const isAfter = d.getTime() >= runAt.getTime();
      hourly.push({
        hour: d.toISOString(),
        electricityKwh: isAfter ? 8 : 12,
        districtHeatingKwh: 0,
        electricityCostKr: isAfter ? 8 : 12,
        districtHeatingCostKr: 0,
        totalCostKr: isAfter ? 8 : 12,
      });
    }

    const points = buildRunTrackingSeries(runs, hourly);
    expect(points[0]!.predictedDeltaPctCostKr).toBe(-5);
    expect(points[0]!.actualDeltaPctCostKr).toBeLessThan(0);

    const summary = trackingAccuracySummary(points);
    expect(summary.comparedRuns).toBe(1);
    expect(summary.meanAbsErrorPct).not.toBeNull();
  });
});
