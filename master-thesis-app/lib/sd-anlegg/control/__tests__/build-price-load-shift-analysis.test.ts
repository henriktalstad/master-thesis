import { describe, expect, it } from "bun:test";
import { buildPriceLoadShiftAnalysis } from "../build-price-load-shift-analysis";
import {
  buildDailyPriceThresholdsFromSteps,
  buildHourPriceBandsFromSteps,
  classifyHourPriceBand,
} from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function makeStep(partial: Partial<MpcReplayStep> & { t: string }): MpcReplayStep {
  return {
    t: partial.t,
    uBmsMeas: partial.uBmsMeas ?? null,
    uBmsSim: partial.uBmsSim ?? {
      supplySetpointC: 20,
      supplyFanPct: 50,
      exhaustFanPct: 50,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    uMpc: partial.uMpc ?? {
      supplySetpointC: 20,
      supplyFanPct: 50,
      exhaustFanPct: 50,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    deltaU: partial.deltaU ?? {
      supplySetpointC: 0,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
    },
    extractTempMeasC: partial.extractTempMeasC ?? 21,
    extractTempPredC: partial.extractTempPredC ?? 21,
    electricKw: partial.electricKw ?? 0.5,
    heatKw: partial.heatKw ?? 0.1,
    marginalKrPerKwh: partial.marginalKrPerKwh ?? 1,
    spotKrPerKwh: partial.spotKrPerKwh ?? partial.marginalKrPerKwh ?? 1,
    outdoorTempC: partial.outdoorTempC ?? 10,
    costBaselineKr: partial.costBaselineKr ?? 0.1,
    costEmulatedKr: partial.costEmulatedKr ?? partial.costBaselineKr ?? 0.1,
    costMpcKr: partial.costMpcKr ?? 0.1,
    comfortViolation: partial.comfortViolation ?? false,
    usedFallback: partial.usedFallback ?? false,
    proxyElKwhEmulated: partial.proxyElKwhEmulated,
    proxyElKwhMpc: partial.proxyElKwhMpc,
    proxyHeatKwhEmulated: partial.proxyHeatKwhEmulated,
    proxyHeatKwhMpc: partial.proxyHeatKwhMpc,
  };
}

describe("buildDailyPriceThresholdsFromSteps", () => {
  it("bruker daglig P75/P25 per dato", () => {
    const steps = [
      { t: "2026-06-24T08:00:00.000Z", spotKrPerKwh: 1, effectiveMarginalKrPerKwh: 1 },
      { t: "2026-06-24T09:00:00.000Z", spotKrPerKwh: 2, effectiveMarginalKrPerKwh: 2 },
      { t: "2026-06-24T10:00:00.000Z", spotKrPerKwh: 3, effectiveMarginalKrPerKwh: 3 },
      { t: "2026-06-24T11:00:00.000Z", spotKrPerKwh: 4, effectiveMarginalKrPerKwh: 4 },
    ];
    const thresholds = buildDailyPriceThresholdsFromSteps(steps);
    const day = thresholds.get("2026-06-24");
    expect(day).toBeDefined();
    expect(day!.high).toBe(4);
    expect(day!.low).toBe(2);
  });
});

describe("buildPriceLoadShiftAnalysis", () => {
  it("beregner reduksjon i høypris-timer", () => {
    const steps: MpcReplayStep[] = [];
    for (let h = 0; h < 4; h += 1) {
      const price = h === 3 ? 4 : 1;
      steps.push(
        makeStep({
          t: `2026-06-24T${String(h + 8).padStart(2, "0")}:00:00.000Z`,
          spotKrPerKwh: price,
          marginalKrPerKwh: price,
          proxyElKwhEmulated: 0.2,
          proxyHeatKwhEmulated: 0.05,
          proxyElKwhMpc: h === 3 ? 0.15 : 0.2,
          proxyHeatKwhMpc: h === 3 ? 0.03 : 0.05,
          costEmulatedKr: 0.25,
          costMpcKr: h === 3 ? 0.18 : 0.25,
        }),
        makeStep({
          t: `2026-06-24T${String(h + 8).padStart(2, "0")}:15:00.000Z`,
          spotKrPerKwh: price,
          marginalKrPerKwh: price,
          proxyElKwhEmulated: 0.2,
          proxyHeatKwhEmulated: 0.05,
          proxyElKwhMpc: h === 3 ? 0.15 : 0.2,
          proxyHeatKwhMpc: h === 3 ? 0.03 : 0.05,
          costEmulatedKr: 0.25,
          costMpcKr: h === 3 ? 0.18 : 0.25,
        }),
      );
    }

    const analysis = buildPriceLoadShiftAnalysis(steps);
    expect(analysis).not.toBeNull();
    expect(analysis!.highPriceHours).toBe(1);
    expect(analysis!.deltaE_hp_kwh).toBeGreaterThan(0);
    expect(analysis!.bands.high.deltaKwh).toBeGreaterThan(0);
    expect(analysis!.interpretation).toContain("mindre");
  });

  it("returnerer null for tom liste", () => {
    expect(buildPriceLoadShiftAnalysis([])).toBeNull();
  });
});

describe("classifyHourPriceBand", () => {
  it("klassifiserer medium mellom P25 og P75", () => {
    const thresholds = new Map([
      ["2026-06-24", { high: 3, low: 1 }],
    ]);
    expect(classifyHourPriceBand("2026-06-24T10", 2, thresholds)).toBe("medium");
    expect(classifyHourPriceBand("2026-06-24T10", 3, thresholds)).toBe("high");
    expect(classifyHourPriceBand("2026-06-24T10", 1, thresholds)).toBe("low");
  });
});

describe("buildHourPriceBandsFromSteps", () => {
  it("produserer band per time", () => {
    const steps = [
      { t: "2026-06-24T08:00:00.000Z", spotKrPerKwh: 1, effectiveMarginalKrPerKwh: 1 },
      { t: "2026-06-24T09:00:00.000Z", spotKrPerKwh: 4, effectiveMarginalKrPerKwh: 4 },
    ];
    const bands = buildHourPriceBandsFromSteps(steps);
    expect(bands.get("2026-06-24T08")).toBe("low");
    expect(bands.get("2026-06-24T09")).toBe("high");
  });
});
