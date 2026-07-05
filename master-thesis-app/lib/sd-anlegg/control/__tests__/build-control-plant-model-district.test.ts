import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildControlPlantModel, flattenPlantSignals } from "../build-control-plant-model";

function mockPoint(
  overrides: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectName">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Nærbyen",
    objectId: overrides.objectName,
    description: null,
    unit: "°C",
    lastValue: 42,
    lastSampledAt: "2026-06-29T12:00:00.000Z",
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("buildControlPlantModel district heating", () => {
  test("inkluderer Fjernvarme (TR) i delsystemer", () => {
    const model = buildControlPlantModel({
      buildingId: "b1",
      buildingName: "Test",
      points: [
        mockPoint({ objectName: "320.002RT402_MV" }),
        mockPoint({ objectName: "320.002SB502_C", unit: "%" }),
      ],
      dataQuality: {
        energyHourCount: 48,
        weatherHourCount: 48,
        priceHourCount: 48,
        historyDays: 7,
      },
    });

    const district = model.subsystems.find((s) => s.id === "district_heating");
    expect(district).toBeDefined();
    expect(district?.label).toBe("Fjernvarme (TR)");

    const signals = flattenPlantSignals(model);
    const supplyTemp = signals.find(
      (s) => s.catalog.canonicalId === "district.tr002.supply.temp",
    );
    expect(supplyTemp?.availability).toBe("available");
    expect(supplyTemp?.lastValue).toBe(42);
  });
});
