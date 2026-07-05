import { describe, expect, test } from "bun:test";
import { assessControlTickTrigger } from "../live/assess-control-tick-trigger";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

const u = (partial: Partial<MpcControlVector> = {}): MpcControlVector => ({
  supplySetpointC: 18,
  supplyFanPct: 40,
  exhaustFanPct: 40,
  heatingValvePct: 10,
  coolingValvePct: 0,
  ...partial,
});

const comfort = { min: 20, max: 24 };

describe("assessControlTickTrigger", () => {
  test("kjører ved første tick", () => {
    const result = assessControlTickTrigger({
      triggerSource: "post_sync",
      lastControlTickAt: null,
      activeCommand: null,
      uMeas: u(),
      extractTempMeasC: 21,
      extractTempPredC: 21,
      comfortBand: comfort,
    });
    expect(result.shouldRun).toBe(true);
    expect(result.reason).toBe("initial");
  });

  test("skipper cron når nylig tick uten avvik", () => {
    const result = assessControlTickTrigger({
      triggerSource: "cron",
      lastControlTickAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      activeCommand: u(),
      uMeas: u(),
      extractTempMeasC: 21,
      extractTempPredC: 21,
      comfortBand: comfort,
      nowMs: Date.now(),
    });
    expect(result.shouldRun).toBe(false);
    expect(result.reason).toBe("skipped_recent");
  });

  test("kjører ved kontrollavvik", () => {
    const result = assessControlTickTrigger({
      triggerSource: "cron",
      lastControlTickAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      activeCommand: u({ supplyFanPct: 40 }),
      uMeas: u({ supplyFanPct: 50 }),
      extractTempMeasC: 21,
      extractTempPredC: 21,
      comfortBand: comfort,
      nowMs: Date.now(),
    });
    expect(result.shouldRun).toBe(true);
    expect(result.reason).toBe("measurement_deviation");
  });

  test("kjører ved komfortbrudd", () => {
    const result = assessControlTickTrigger({
      triggerSource: "post_sync",
      lastControlTickAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      activeCommand: u(),
      uMeas: u(),
      extractTempMeasC: 19,
      extractTempPredC: 21,
      comfortBand: comfort,
      nowMs: Date.now(),
    });
    expect(result.shouldRun).toBe(true);
    expect(result.reason).toBe("comfort_deviation");
  });

  test("kjører ved værprognose-drift", () => {
    const result = assessControlTickTrigger({
      triggerSource: "cron",
      lastControlTickAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      activeCommand: u(),
      uMeas: u(),
      extractTempMeasC: 21,
      extractTempPredC: 21,
      comfortBand: comfort,
      outdoorTempMeasC: 18,
      outdoorTempForecastC: 14,
      nowMs: Date.now(),
    });
    expect(result.shouldRun).toBe(true);
    expect(result.reason).toBe("weather_forecast_drift");
  });

  test("kjører ved prisspike", () => {
    const result = assessControlTickTrigger({
      triggerSource: "cron",
      lastControlTickAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      activeCommand: u(),
      uMeas: u(),
      extractTempMeasC: 21,
      extractTempPredC: 21,
      comfortBand: comfort,
      currentMarginalKrPerKwh: 2.1,
      recentMarginalKrPerKwh: [1.0, 1.1, 1.0, 0.9, 1.05],
      nowMs: Date.now(),
    });
    expect(result.shouldRun).toBe(true);
    expect(result.reason).toBe("price_spike");
  });
});
