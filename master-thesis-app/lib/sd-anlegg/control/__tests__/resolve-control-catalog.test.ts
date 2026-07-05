import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { CONTROL_SIGNAL_CATALOG_360102 } from "@/lib/sd-anlegg/control/control-signal-catalog";
import type { ControlSignalBinding } from "@/lib/sd-anlegg/control/control-signal-bindings";
import {
  filterPointsByUnitKey,
  resolvePointForCatalogEntryInContext,
} from "@/lib/sd-anlegg/control/resolve-control-catalog";

function mockPoint(
  overrides: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectName">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Nærbyen",
    objectId: "AV-1",
    description: null,
    unit: "%",
    lastValue: 50,
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

describe("resolve-control-catalog", () => {
  test("filterPointsByUnitKey begrenser til AHU-element", () => {
    const points = [
      mockPoint({
        objectName: "AO_3",
        objectId: "310.001SB501_C",
        description: "360102 kjøleventil",
      }),
      mockPoint({
        objectName: "AO_99",
        objectId: "310.001SB999_C",
        description: "999999 annet anlegg",
      }),
    ];

    const filtered = filterPointsByUnitKey(points, "360102");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.objectId).toBe("310.001SB501_C");
  });

  test("binding overstyrer globalt mønstermatch", () => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (row) => row.canonicalId === "cooling.valve.command",
    )!;
    const wrongGlobal = mockPoint({
      objectName: "AO_wrong",
      objectId: "310.001SB501_C",
    });
    const correctBound = mockPoint({
      objectName: "AO_4",
      objectId: "310.001SB502_C",
    });
    const points = [wrongGlobal, correctBound];
    const bindings: ControlSignalBinding[] = [
      {
        sourceId: "src-1",
        objectId: "310.001SB502_C",
        canonicalId: "cooling.valve.command",
        unitKey: "360102",
        source: "manual",
        confidence: "high",
      },
    ];

    const resolved = resolvePointForCatalogEntryInContext({
      points,
      entry,
      context: { sourceId: "src-1", bindings, unitKey: "360102" },
    });

    expect(resolved?.objectId).toBe("310.001SB502_C");
  });

  test("scoped mønstermatch unngår feil enhet uten binding", () => {
    const entry = CONTROL_SIGNAL_CATALOG_360102.find(
      (row) => row.canonicalId === "heating.valve.command",
    )!;
    const points = [
      mockPoint({
        objectName: "AO_3",
        objectId: "AO-360102",
        description: "360102 varmebatteri",
      }),
      mockPoint({
        objectName: "AO_3",
        objectId: "AO-999999",
        description: "999999 varmebatteri",
      }),
    ];

    const resolved = resolvePointForCatalogEntryInContext({
      points,
      entry,
      context: { sourceId: "src-1", unitKey: "360102" },
    });

    expect(resolved?.objectId).toBe("AO-360102");
  });
});
