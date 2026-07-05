import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  hasHeatingCircuitMeterSignals,
  resolveHeatingSlotStyringHref,
} from "@/lib/sd-anlegg/heating-slot-control-links";
import { resolveSchemaContextUi } from "@/lib/sd-anlegg/resolve-schema-context-ui";
import { HEATING_DISTRICT_COMBINED_ID } from "@/lib/sd-anlegg/schema-template-ids";
import { VENTILATION_AHU_DUAL_DUCT_HRU_ID } from "@/lib/sd-anlegg/schema-template-ids";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "360.102",
    objectId: "p1",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 0,
    lastSampledAt: "2026-06-20T09:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

const MPC_AHU_POINTS: InfraspawnPointListItem[] = [
  point({ objectName: "SupplySetpoint", unit: "degrees-celsius", lastValue: 18 }),
  point({ objectName: "AO_SAF", unit: "percent", lastValue: 40 }),
  point({ objectName: "AO_EAF", unit: "percent", lastValue: 38 }),
  point({ objectName: "AO_3", unit: "percent", lastValue: 12 }),
];

const FV_OE_POINTS: InfraspawnPointListItem[] = [
  point({ objectName: "320001OE001_effekt", lastValue: 28.9 }),
  point({ objectName: "320001OE001_energi", lastValue: 2764946 }),
  point({ objectName: "320.002SB502_C", unit: "percent", lastValue: 5 }),
];

describe("heating-slot-control-links", () => {
  test("OE effekt lenker til analyse energi", () => {
    expect(
      resolveHeatingSlotStyringHref("sorgenfriveien-32ab", "res.oe.power")?.tab,
    ).toBe("analyse");
  });

  test("lokal ventil har ingen styring-lenke", () => {
    expect(resolveHeatingSlotStyringHref("x", "res.valve")).toBeNull();
  });

  test("detekterer kretssnitt-signaler", () => {
    expect(hasHeatingCircuitMeterSignals(FV_OE_POINTS)).toBe(true);
    expect(hasHeatingCircuitMeterSignals([point({ objectName: "320.002SB502_C" })])).toBe(
      false,
    );
  });
});

describe("resolveSchemaContextUi", () => {
  test("ukjent bygg → ingen lenker", () => {
    expect(
      resolveSchemaContextUi({
        buildingSlug: "unknown",
        schemaTemplateId: VENTILATION_AHU_DUAL_DUCT_HRU_ID,
        points: MPC_AHU_POINTS,
      }).links,
    ).toEqual([]);
  });

  test("AHU med u_k → MPC-signaler og fjernvarme", () => {
    const ui = resolveSchemaContextUi({
      buildingSlug: "sorgenfriveien-32ab",
      schemaTemplateId: VENTILATION_AHU_DUAL_DUCT_HRU_ID,
      points: MPC_AHU_POINTS,
    });
    expect(ui.links.some((l) => l.label === "MPC-signaler")).toBe(true);
    expect(ui.links.some((l) => l.label === "Fjernvarme")).toBe(true);
  });

  test("AHU uten u_k → kun delvis styring-lenke", () => {
    const ui = resolveSchemaContextUi({
      buildingSlug: "sorgenfriveien-32ab",
      schemaTemplateId: VENTILATION_AHU_DUAL_DUCT_HRU_ID,
      points: [point({ objectName: "AO_SAF", lastValue: 10 })],
    });
    expect(ui.links.some((l) => l.label === "MPC-signaler")).toBe(false);
    expect(ui.links.some((l) => l.label === "Styring")).toBe(true);
  });

  test("fjernvarme med OE → energi-lenke og AHU", () => {
    const ui = resolveSchemaContextUi({
      buildingSlug: "sorgenfriveien-32ab",
      schemaTemplateId: HEATING_DISTRICT_COMBINED_ID,
      points: FV_OE_POINTS,
    });
    expect(ui.links.some((l) => l.label === "Energi i simulering")).toBe(true);
    expect(ui.links.some((l) => l.label === "AHU 360.102")).toBe(true);
    expect(ui.caption).toContain("kretssnitt");
  });

  test("fjernvarme uten OE → ingen energi-lenke", () => {
    const ui = resolveSchemaContextUi({
      buildingSlug: "sorgenfriveien-32ab",
      schemaTemplateId: HEATING_DISTRICT_COMBINED_ID,
      points: [point({ objectName: "320.002SB502_C", lastValue: 5 })],
    });
    expect(ui.links.some((l) => l.label === "Energi i simulering")).toBe(false);
    expect(ui.links.some((l) => l.label === "AHU 360.102")).toBe(true);
  });
});
