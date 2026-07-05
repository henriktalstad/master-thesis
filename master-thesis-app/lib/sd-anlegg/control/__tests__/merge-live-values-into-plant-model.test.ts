import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildControlPlantModel } from "@/lib/sd-anlegg/control/build-control-plant-model";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import {
  mergeLiveValuesIntoPlantModel,
  resolveControlPlantLatestSampleAt,
} from "@/lib/sd-anlegg/control/merge-live-values-into-plant-model";
import { flattenPlantSignals } from "@/lib/sd-anlegg/control/build-control-plant-model";

function mockPoint(
  overrides: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectName">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Nærbyen",
    objectId: "AV-1",
    description: null,
    unit: "°C",
    lastValue: 21.5,
    lastSampledAt: "2026-06-20T12:00:00.000Z",
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("mergeLiveValuesIntoPlantModel", () => {
  test("oppdaterer lastValue fra live poll", () => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "supply.setpoint",
    )!;
    const ssrPoints = [
      mockPoint({
        objectName: "SupplySetpoint",
        lastValue: 18,
        lastSampledAt: "2026-06-20T10:00:00.000Z",
      }),
    ];
    const plantModel = buildControlPlantModel({
      buildingId: "b1",
      buildingName: "Test",
      points: ssrPoints,
      dataQuality: {
        energyHourCount: 48,
        weatherHourCount: 48,
        priceHourCount: 48,
        historyDays: 7,
      },
    });

    const livePoints = [
      mockPoint({
        objectName: "SupplySetpoint",
        lastValue: 22.5,
        lastSampledAt: "2026-06-29T12:00:00.000Z",
      }),
    ];

    const merged = mergeLiveValuesIntoPlantModel(plantModel, livePoints);
    const signal = flattenPlantSignals(merged).find(
      (s) => s.catalog.canonicalId === entry.canonicalId,
    );
    expect(signal?.lastValue).toBe(22.5);
    expect(signal?.lastSampledAt).toBe("2026-06-29T12:00:00.000Z");
  });

  test("resolveControlPlantLatestSampleAt returnerer nyeste tidsstempel", () => {
    const plantModel = buildControlPlantModel({
      buildingId: "b1",
      buildingName: "Test",
      points: [
        mockPoint({
          objectName: "SupplySetpoint",
          lastSampledAt: "2026-06-29T11:00:00.000Z",
        }),
        mockPoint({
          objectName: "SupplyPID_SetP",
          objectId: "SPK-1",
          lastSampledAt: "2026-06-29T12:30:00.000Z",
        }),
      ],
      dataQuality: {
        energyHourCount: 48,
        weatherHourCount: 48,
        priceHourCount: 48,
        historyDays: 7,
      },
    });

    expect(resolveControlPlantLatestSampleAt(plantModel)).toBe(
      "2026-06-29T12:30:00.000Z",
    );
  });
});
