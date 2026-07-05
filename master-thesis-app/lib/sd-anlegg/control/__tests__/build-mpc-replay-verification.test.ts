import { describe, expect, test } from "bun:test";
import { buildMpcReplayVerification } from "../build-mpc-replay-verification";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(partial: Partial<MpcReplayStep> & { t: string }): MpcReplayStep {
  return {
    uBmsMeas: null,
    uBmsSim: null,
    uMpc: null,
    deltaU: null,
    usedFallback: false,
    extractTempMeasC: 20,
    extractTempPredC: 20.5,
    extractTempPredEmulatedC: 20.2,
    marginalKrPerKwh: 1,
    proxyElKwhObserved: 1,
    proxyElKwhEmulated: 1,
    proxyElKwhMpc: 0.9,
    proxyHeatKwhObserved: 0.5,
    proxyHeatKwhEmulated: 0.5,
    proxyHeatKwhMpc: 0.4,
    proxyCostKrObserved: 2,
    proxyCostKrEmulated: 2,
    proxyCostKrMpc: 1.8,
    observedKw: 4,
    ...partial,
  } as MpcReplayStep;
}

describe("buildMpcReplayVerification", () => {
  test("feiler uten replay-steg", () => {
    const report = buildMpcReplayVerification({ steps: [] });
    expect(report.health).toBe("fail");
    expect(report.failures).toContain("Ingen replay-steg");
  });

  test("feiler når loadProfile mangler peak-felter", () => {
    const report = buildMpcReplayVerification({
      steps: [
        step({
          t: "2026-06-24T10:00:00.000Z",
          uBmsMeas: null,
          proxyElKwhBaseline: undefined,
          proxyElKwhEmulated: undefined,
          proxyElKwhMpc: undefined,
          costBaselineKr: 0,
          costEmulatedKr: 0,
          costMpcKr: 0,
          marginalKrPerKwh: null,
          electricKw: 0,
        }),
      ],
    });
    expect(report.peakFields.needsRerun).toBe(true);
    expect(report.health).toBe("fail");
  });

  test("passer med peak-felter og komfort", () => {
    const report = buildMpcReplayVerification({
      steps: [
        step({
          t: "2026-06-24T10:00:00.000Z",
          proxyElKwhBaseline: 1,
          proxyElKwhEmulated: 1,
          proxyElKwhMpc: 0.9,
        }),
      ],
      priceLoadShift: {
        bands: {
          high: { baselineKwh: 10, mpcKwh: 8, deltaKwh: -2, deltaPct: -20 },
          medium: { baselineKwh: 20, mpcKwh: 20, deltaKwh: 0, deltaPct: 0 },
          low: { baselineKwh: 30, mpcKwh: 32, deltaKwh: 2, deltaPct: 6.7 },
        },
        deltaE_hp_kwh: -2,
        deltaE_hp_pct: -20,
        highPriceHours: 4,
        highPriceCostDeltaKr: -5,
        highPriceCostDeltaPct: -10,
        highPriceCostBaselineKr: 50,
        highPriceCostMpcKr: 45,
        interpretation: "test",
      },
    });
    expect(report.health).toBe("pass");
    expect(report.comfort.maeObservedVsMpcC).not.toBeNull();
  });
});
