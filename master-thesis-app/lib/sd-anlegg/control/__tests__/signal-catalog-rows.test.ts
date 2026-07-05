import { describe, expect, it } from "bun:test";
import { buildControlPlantModel } from "../build-control-plant-model";
import {
  buildSignalCatalogRows,
  summarizeSignalCatalog,
} from "../signal-catalog-rows";

function mockPoint(
  objectName: string,
  lastValue = 21,
): { objectName: string; objectId: string; sourceId: string; lastValue: number } {
  return {
    sourceId: "src-1",
    objectId: objectName,
    objectName,
    lastValue,
  };
}

describe("buildSignalCatalogRows", () => {
  it("lister alle katalogsignaler med MPC-roller", () => {
    const plantModel = buildControlPlantModel({
      buildingId: "b1",
      buildingName: "Test",
      points: [],
      dataQuality: {
        energyHourCount: 100,
        weatherHourCount: 100,
        priceHourCount: 100,
        historyDays: 7,
      },
    });
    const rows = buildSignalCatalogRows({ plantModel });
    const summary = summarizeSignalCatalog(rows);

    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(summary.mpcActuators).toBe(4);
    expect(summary.uMeasRequired).toBe(5);
    expect(rows.some((r) => r.spec.canonicalId === "cooling.valve.command")).toBe(
      true,
    );
    expect(
      rows.find((r) => r.spec.canonicalId === "cooling.valve.command")?.spec
        .inUMeasRequired,
    ).toBe(true);
  });

  it("viser live OK for TR-signaler i plant-modell", () => {
    const plantModel = buildControlPlantModel({
      buildingId: "b1",
      buildingName: "Test",
      points: [mockPoint("320.002RT402_MV", 55)],
      dataQuality: {
        energyHourCount: 100,
        weatherHourCount: 100,
        priceHourCount: 100,
        historyDays: 7,
      },
    });
    const row = buildSignalCatalogRows({ plantModel }).find(
      (r) => r.spec.canonicalId === "district.tr002.supply.temp",
    );
    expect(row?.availability).toBe("available");
    expect(row?.lastValue).toBe(55);
  });

  it("beregner replay-dekning fra evalCoverage", () => {
    const plantModel = buildControlPlantModel({
      buildingId: "b1",
      buildingName: "Test",
      points: [],
      dataQuality: {
        energyHourCount: 100,
        weatherHourCount: 100,
        priceHourCount: 100,
        historyDays: 7,
      },
    });
    const row = buildSignalCatalogRows({
      plantModel,
      evalCoverage: {
        evalStart: "2026-06-24T00:00:00.000Z",
        evalEnd: "2026-07-02T00:00:00.000Z",
        stepCount: 100,
        stepsWithUMeas: 95,
        stepsOptimizable: 90,
        optimizablePct: 0.9,
        uMeasPct: 0.95,
        extractTempPct: 0.8,
        thresholdPct: 0.85,
        needsMpcBackfill: false,
        needsPlantBackfill: false,
        needsBackfill: false,
        missingCanonicals: [],
        resolvedSignalCount: 1,
        signals: [
          {
            canonicalId: "district.tr002.supply.temp",
            sampleStepCount: 86,
            coveragePct: 0.86,
          },
        ],
        plantMirrorCoveragePct: 0.9,
        plantMirrorStart: "",
        plantMirrorEnd: "",
        plantSignals: [],
        canSimulate: true,
        blockReason: null,
        evalBeyondInfluxLookback: false,
        influxLookbackHours: 168,
        datasetProvenance: null,
      },
    }).find((r) => r.spec.canonicalId === "district.tr002.supply.temp");

    expect(row?.evalSamplePct).toBe(86);
  });
});
