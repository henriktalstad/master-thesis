import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  inferSdComponentInstances,
  inferSdComponentTypeForPoint,
  summarizeSdComponentInference,
} from "@/lib/sd-anlegg/infer-components";
import { parseSdLayout, sdLayoutSchema } from "@/lib/sd-anlegg/layout-schema";
import { resolveSdAnleggKpiSlots } from "@/lib/sd-anlegg/kpi-slots";
import { HEATING_DISTRICT_COMBINED_UNIT_KEY } from "@/lib/sd-anlegg/heating-process-units";
import { NAERBYEN_AUDIT_FIXTURES } from "../fixtures/naerbyen-audit-fixtures";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "360.102",
    objectId: "AI-1",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 1,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("inferSdComponentTypeForPoint", () => {
  test("klassifiserer prefiks fra Nærbyen-audit", () => {
    for (const fixture of NAERBYEN_AUDIT_FIXTURES) {
      expect(
        inferSdComponentTypeForPoint({
          objectId: fixture.objectId,
          objectName: fixture.objectName,
          description: fixture.description,
          unit: fixture.unit,
        }),
      ).toBe(fixture.expectedType);
    }
  });
});

describe("summarizeSdComponentInference", () => {
  test("oppnår minst 80 % dekning på ventilasjons-fixtures", () => {
    const points = NAERBYEN_AUDIT_FIXTURES.map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );
    const summary = summarizeSdComponentInference(points);
    expect(summary.coveragePct).toBeGreaterThanOrEqual(80);
  });
});

describe("sdLayoutSchema", () => {
  test("parser gyldig layout", () => {
    const layout = parseSdLayout({
      version: 1,
      nodes: [
        {
          id: "fan-1",
          componentType: "ventilation.fan",
          position: { x: 0, y: 0 },
          bindings: [{ objectId: "JV501", sourceId: "s1" }],
        },
      ],
      edges: [],
    });
    expect(layout).not.toBeNull();
    expect(sdLayoutSchema.parse(layout).nodes).toHaveLength(1);
  });
});

describe("resolveSdAnleggKpiSlots", () => {
  test("finner utetemp og systemstatus", () => {
    const slots = resolveSdAnleggKpiSlots([
      point({
        objectId: "AI-10",
        objectName: "320001OE001_utetemp",
        unit: "degrees-celsius",
      }),
      point({
        objectId: "BI-1",
        objectName: "Systemstatus",
        unit: "boolean",
      }),
    ]);
    expect(slots.map((slot) => slot.slotId)).toContain("outdoor_temp");
    expect(slots.map((slot) => slot.slotId)).toContain("system_status");
  });

  test("combined 3200013 bruker primær OE001 for tur/retur", () => {
    const slots = resolveSdAnleggKpiSlots(
      [
        point({
          objectId: "AI-1",
          objectName: "320001OE001_turtemp",
          unit: "degrees-celsius",
          lastValue: 72.4,
        }),
        point({
          objectId: "AI-2",
          objectName: "320001OE001_returtemp",
          unit: "degrees-celsius",
          lastValue: 38.1,
        }),
        point({
          objectId: "AI-3",
          objectName: "320.002RT402_MV",
          unit: "degrees-celsius",
          lastValue: 55,
        }),
        point({
          objectId: "AI-4",
          objectName: "320.001RT901_MV",
          unit: "degrees-celsius",
          lastValue: -2,
        }),
      ],
      HEATING_DISTRICT_COMBINED_UNIT_KEY,
    );

    expect(slots.map((s) => s.slotId)).toEqual([
      "outdoor_temp",
      "supply_temp",
      "return_temp",
    ]);
    expect(slots.find((s) => s.slotId === "supply_temp")?.point.objectName).toBe(
      "320001OE001_turtemp",
    );
    expect(slots.find((s) => s.slotId === "return_temp")?.detailLabel).toBe(
      "OE001 · Primær fjernvarme",
    );
  });
});

describe("inferSdComponentInstances", () => {
  test("returnerer score per punkt", () => {
    const instances = inferSdComponentInstances([
      point({ objectId: "AO-1", objectName: "JV501" }),
    ]);
    expect(instances[0]?.componentType).toBe("ventilation.fan");
    expect(instances[0]?.score).toBeGreaterThanOrEqual(2);
  });
});
