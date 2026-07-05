import { describe, expect, test } from "bun:test";
import {
  buildMpcComfortSeries,
  summarizeExtractComfortMae,
} from "@/lib/sd-anlegg/control/summarize-comfort";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function step(partial: Partial<MpcReplayStep>): MpcReplayStep {
  return {
    t: "2026-06-24T10:00:00.000Z",
    uBmsMeas: null,
    uBmsSim: {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 0,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    },
    uMpc: {
      supplySetpointC: 18,
      supplyFanPct: 35,
      exhaustFanPct: 35,
      heatingValvePct: 0,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    },
    deltaU: {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 0,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    },
    extractTempMeasC: 22,
    extractTempPredC: 21,
    extractTempPredEmulatedC: 21.5,
    extractTempPredDemandC: 20.5,
    comfortBandMinC: 19,
    comfortBandMaxC: 23,
    electricKw: 0.5,
    heatKw: 0.2,
    marginalKrPerKwh: 1,
    costBaselineKr: 1,
    costEmulatedKr: 1,
    costMpcKr: 0.9,
    comfortViolation: false,
    usedFallback: false,
    outdoorTempC: 10,
    ...partial,
  };
}

describe("summarize-comfort", () => {
  test("beregner MAE for observert vs spor", () => {
    const mae = summarizeExtractComfortMae([
      step({ extractTempMeasC: 22, extractTempPredC: 21 }),
      step({
        t: "2026-06-24T10:15:00.000Z",
        extractTempMeasC: 20,
        extractTempPredC: 19,
        extractTempPredEmulatedC: 19.5,
      }),
    ]);
    expect(mae.comparedSteps).toBe(2);
    expect(mae.maeObservedVsMpcC).toBe(1);
    expect(mae.maeObservedVsEmulatedC).toBe(0.5);
  });

  test("bygger komfortserie med emulert og behov", () => {
    const series = buildMpcComfortSeries([step({})]);
    expect(series[0]).toMatchObject({
      measuredC: 22,
      mpcC: 21,
      emulatedC: 21.5,
      demandC: 20.5,
      comfortBandMinC: 19,
      comfortBandMaxC: 23,
    });
  });
});
