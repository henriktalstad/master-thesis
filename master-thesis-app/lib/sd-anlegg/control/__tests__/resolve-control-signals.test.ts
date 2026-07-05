import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  catalogCoveragePct,
  resolveControlSignal,
  resolvePointForCatalogEntry,
} from "@/lib/sd-anlegg/control/resolve-control-signals";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";

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

describe("resolve-control-signals", () => {
  test("matcher SupplySetpoint til supply.setpoint", () => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "supply.setpoint",
    )!;
    const points = [mockPoint({ objectName: "SupplySetpoint" })];
    const resolved = resolveControlSignal(points, entry);
    expect(resolved.availability).toBe("available");
    expect(resolved.point?.objectName).toBe("SupplySetpoint");
  });

  test("markerer forventet hull for gjenvinner-pådrag", () => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "heat_recovery.command",
    )!;
    const resolved = resolveControlSignal([], entry);
    expect(resolved.availability).toBe("expected_missing");
  });

  test("beregner katalogdekning uten forventede hull", () => {
    const availableEntries = CONTROL_SIGNAL_CATALOG_360102.filter(
      (e) => !e.expectedMissing,
    );
    const points = availableEntries.flatMap((entry) => {
      const pattern = entry.influxPatterns[0];
      if (!pattern) return [];
      return [mockPoint({ objectName: pattern, objectId: pattern })];
    });

    const signals = availableEntries.map((entry) =>
      resolveControlSignal(points, entry),
    );
    expect(catalogCoveragePct(signals)).toBe(100);
  });

  test("resolvePointForCatalogEntry finner AO_3 varmebatteri", () => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "heating.valve.command",
    )!;
    const point = resolvePointForCatalogEntry(
      [mockPoint({ objectName: "AO_3", unit: "%" })],
      entry,
    );
    expect(point?.objectName).toBe("AO_3");
  });

  test("skiller Efficiency og AI_EfficiencyTemp uten kryssmapping", () => {
    const efficiencyEntry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "heat_recovery.efficiency",
    )!;
    const afterTempEntry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "heat_recovery.after_temp",
    )!;
    const points = [
      mockPoint({
        objectName: "Efficiency",
        objectId: "AV-40395",
        description: "Efficiency for exchanger",
        unit: "percent",
        lastValue: 72,
      }),
      mockPoint({
        objectName: "AI_EfficiencyTemp",
        objectId: "AV-40325",
        description: "temp. efficiency sensor",
        unit: "°C",
        lastValue: 18.2,
      }),
    ];

    expect(
      resolvePointForCatalogEntry(points, efficiencyEntry)?.objectName,
    ).toBe("Efficiency");
    expect(
      resolvePointForCatalogEntry(points, afterTempEntry)?.objectName,
    ).toBe("AI_EfficiencyTemp");
  });

  test("mapper Lowefficiency til constraint og ikke pådrag", () => {
    const commandEntry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "heat_recovery.command",
    )!;
    const lowEffEntry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "constraint.low_efficiency",
    )!;
    const point = mockPoint({
      objectName: "Lowefficiency",
      objectId: "BV-20075",
      description: "Low efficiency",
      unit: "boolean",
      lastValue: 0,
    });

    expect(resolvePointForCatalogEntry([point], commandEntry)).toBeUndefined();
    expect(resolvePointForCatalogEntry([point], lowEffEntry)?.objectName).toBe(
      "Lowefficiency",
    );
  });

  test("unngår AO-3 FJV-kollisjon for varmebatteri", () => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (e) => e.canonicalId === "heating.valve.command",
    )!;
    const points = [
      mockPoint({
        objectName: "320.003SB502_C",
        objectId: "AO-3",
        description: "Varmeventil",
      }),
      mockPoint({
        objectName: "AO_3",
        objectId: "AV-40372",
        description: "AO3",
      }),
    ];

    expect(resolvePointForCatalogEntry(points, entry)?.objectId).toBe(
      "AV-40372",
    );
  });
});
