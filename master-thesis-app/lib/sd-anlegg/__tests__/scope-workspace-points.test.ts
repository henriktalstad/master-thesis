import { describe, expect, test } from "bun:test";
import { InfraspawnSystemDomain } from "@/generated/client/enums";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { parseInfraspawnPointKsTag } from "@/lib/infraspawn/parse-point-ks-tag";
import { HEATING_DISTRICT_SECONDARY_CIRCUIT } from "@/lib/sd-anlegg/schema-templates";
import { VENTILATION_AHU_DUAL_DUCT_HRU } from "@/lib/sd-anlegg/schema-templates/templates/ventilation.ahu.dual_duct_hru";
import {
  expandPointsWithSharedEquipment,
  expandPointsWithTapWaterCircuit,
  expandPointsWithAhuProcessSettingsSignals,
  expandPointsWithAhuTemplateSchemaSignals,
  expandPointsWithVentilationUnitScope,
  resolveSdAnleggWorkspacePoints,
} from "@/lib/sd-anlegg/scope-workspace-points";
import { resolveAhuProcessSettingsItems } from "@/lib/sd-anlegg/ahu-process-settings";
import { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";
import { NAERBYEN_AUDIT_FIXTURES } from "../fixtures/naerbyen-audit-fixtures";
import { NAERBYEN_HEATING_FIXTURES } from "./fixtures/naerbyen-heating-fixtures";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "src-varme",
    sourceLabel: "320.002 Næringsdel",
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

describe("parseInfraspawnPointKsTag for 310.001RT402_SP", () => {
  test("parser settpunkt med utstyr RT402", () => {
    const parsed = parseInfraspawnPointKsTag({
      objectName: "310.001RT402_SP",
    });

    expect(parsed).toMatchObject({
      systemCode: "310",
      element: "310.001",
      elementKey: "310001",
      equipmentCode: "RT402",
      signalSuffix: "SP",
    });
  });
});

describe("expandPointsWithSharedEquipment", () => {
  test("tar med 310.001RT402_SP når enheten har 320.002RT402_MV", () => {
    const all = [
      point({
        objectId: "mv",
        objectName: "320.002RT402_MV",
        description: "Temperatur turvann",
      }),
      point({
        objectId: "sp",
        objectName: "310.001RT402_SP",
        description: "Setpunkt retur",
      }),
    ];

    const expanded = expandPointsWithSharedEquipment(all, [all[0]!]);

    expect(expanded.map((entry) => entry.objectName).sort()).toEqual([
      "310.001RT402_SP",
      "320.002RT402_MV",
    ]);
  });
});

describe("resolveSdAnleggWorkspacePoints", () => {
  test("inkluderer setpunkt i varme-enhet 320002", () => {
    const all = NAERBYEN_HEATING_FIXTURES.map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );
    all.push(
      point({
        objectId: "setpoint",
        objectName: "310.001RT402_SP",
        description: "Setpunkt retur",
        unit: "degrees-celsius",
      }),
    );

    const unitObjectIds = all
      .filter((entry) => entry.objectName?.startsWith("320.002"))
      .map((entry) => entry.objectId);

    const scoped = resolveSdAnleggWorkspacePoints(all, {
      domain: InfraspawnSystemDomain.HEATING,
      unitObjectIds,
      schemaTemplate: HEATING_DISTRICT_SECONDARY_CIRCUIT,
      elementKey: "320002",
    });

    expect(scoped.some((entry) => entry.objectName === "310.001RT402_SP")).toBe(
      true,
    );
    expect(scoped.some((entry) => entry.objectName === "320.002RT402_MV")).toBe(
      true,
    );
    expect(scoped.some((entry) => entry.objectName === "310.001JP501_A")).toBe(
      true,
    );
  });

  test("expandPointsWithTapWaterCircuit legger til 310.001 for boligdel", () => {
    const all = NAERBYEN_HEATING_FIXTURES.map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );
    const anchor = all.filter((p) => p.objectName === "320.002RT402_MV");
    const expanded = expandPointsWithTapWaterCircuit(all, anchor, "320002");
    expect(expanded.some((p) => p.objectName === "310.001SB501_C")).toBe(true);
  });

  test("expandPointsWithTapWaterCircuit legger til 310.001 for samlet fjernvarme", () => {
    const all = NAERBYEN_HEATING_FIXTURES.map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );
    const anchor = all.filter((p) => /^320\.00[123]/i.test(p.objectName ?? ""));

    const expanded = expandPointsWithTapWaterCircuit(all, anchor, {
      unitKey: "3200013",
    });

    expect(expanded.some((p) => p.objectName === "310.001RT402_MV")).toBe(true);
    expect(expanded.some((p) => p.objectName === "310.001SB501_C")).toBe(true);
    expect(expanded.some((p) => p.objectName === "310.001JP501_A")).toBe(true);
  });

  test("ventilasjon-workspace ekskluderer varme/tappevann selv om mal matcher", () => {
    const all = [
      point({
        sourceId: "src-vent",
        sourceLabel: "360.102",
        objectId: "saf",
        objectName: "AI_SAFFLOW",
        unit: "cubic-meters-per-hour",
      }),
      point({
        sourceId: "src-vent",
        sourceLabel: "360.102",
        objectId: "tap",
        objectName: "310.001SB501_C",
        unit: "percent",
      }),
    ];

    const scoped = resolveSdAnleggWorkspacePoints(all, {
      domain: InfraspawnSystemDomain.VENTILATION,
      unitObjectIds: ["saf"],
      schemaTemplate: VENTILATION_AHU_DUAL_DUCT_HRU,
      elementKey: "360102",
    });

    expect(scoped.map((entry) => entry.objectName)).toEqual(["AI_SAFFLOW"]);
  });

  test("prefix-only unitObjectIds får med flate BACnet-signaler for 360102", () => {
    const all = [
      ...NAERBYEN_AUDIT_FIXTURES.map((fixture) =>
        point({
          sourceId: "src-vent",
          sourceLabel: "360.102 Næringsdel Blokk A",
          objectId: fixture.objectId,
          objectName: fixture.objectName,
          description: fixture.description,
          unit: fixture.unit,
        }),
      ),
      point({
        sourceId: "src-vent",
        sourceLabel: "360.102 Næringsdel Blokk A",
        objectId: "av-6",
        objectName: "AI_SupplyAirTemp",
        unit: "degrees-celsius",
      }),
      point({
        sourceId: "src-vent",
        sourceLabel: "360.102 Næringsdel Blokk A",
        objectId: "av-4",
        objectName: "AI_SAFFLOW",
        unit: "cubic-meters-per-hour",
      }),
      point({
        sourceId: "src-vent",
        sourceLabel: "360.102 Næringsdel Blokk A",
        objectId: "bo-601",
        objectName: "Systemstatus",
        unit: "boolean",
      }),
    ];

    const prefixOnlyIds = all
      .filter((entry) => entry.objectName && !/^AI_/.test(entry.objectName))
      .map((entry) => entry.objectId);

    const expanded = expandPointsWithVentilationUnitScope(
      all,
      all.filter((entry) => prefixOnlyIds.includes(entry.objectId)),
      "360102",
    );

    expect(expanded.map((entry) => entry.objectName).sort()).toEqual(
      expect.arrayContaining(["AI_SAFFLOW", "AI_SupplyAirTemp", "JV501"]),
    );

    const scoped = resolveSdAnleggWorkspacePoints(all, {
      domain: InfraspawnSystemDomain.VENTILATION,
      unitObjectIds: prefixOnlyIds,
      schemaTemplate: VENTILATION_AHU_DUAL_DUCT_HRU,
      elementKey: "360102",
    });

    expect(scoped.some((entry) => entry.objectName === "AI_SupplyAirTemp")).toBe(
      true,
    );
    expect(scoped.some((entry) => entry.objectName === "Systemstatus")).toBe(true);
    expect(scoped.some((entry) => entry.objectName === "DO_SeqPumpY1")).toBe(
      false,
    );
  });

  test("Nærbyen-lignende status-signaler inkluderes uten varmepumpe-lekkasje", () => {
    const sourceId = "src-naerbyen";
    const sourceLabel = "Nærbyen Næring";
    const vent360102 = [
      "AI_SAFFlow",
      "AI_SupplyAirTemp",
      "AI_EAFFlow",
      "EAFAutoMode",
    ].map((name, index) =>
      point({
        sourceId,
        sourceLabel,
        objectId: `vent-${index}`,
        objectName: name,
        unit: "degrees-celsius",
      }),
    );
    const status = ["Frostrisk", "SFP", "SupplySetpoint", "AirUnitAutoMode"].map(
      (name, index) =>
        point({
          sourceId,
          sourceLabel,
          objectId: `status-${index}`,
          objectName: name,
          unit: name === "SFP" ? "generic" : "boolean",
        }),
    );
    const hx = ["Efficiency", "Lowefficiency", "Rotationguardexchanger"].map(
      (name, index) =>
        point({
          sourceId,
          sourceLabel,
          objectId: `hx-${index}`,
          objectName: name,
          unit: name === "Efficiency" ? "percent" : "boolean",
        }),
    );
    const heating = [
      point({
        sourceId,
        sourceLabel,
        objectId: "pump-select-y1",
        objectName: "DOSelect_SeqPumpY1",
        unit: "boolean",
        lastValue: 2,
      }),
      point({
        sourceId,
        sourceLabel,
        objectId: "pump-select-y2",
        objectName: "DOSelect_SeqPumpY2",
        unit: "boolean",
        lastValue: 2,
      }),
      point({
        sourceId,
        sourceLabel,
        objectId: "pump-y1",
        objectName: "DO_SeqPumpY1",
        unit: "boolean",
      }),
      point({
        sourceId,
        sourceLabel,
        objectId: "jp401",
        objectName: "320.002JP401_A",
        unit: "boolean",
      }),
    ];

    const all = [...vent360102, ...status, ...hx, ...heating];
    const unitObjectIds = vent360102.map((entry) => entry.objectId);

    const scoped = resolveSdAnleggWorkspacePoints(all, {
      domain: InfraspawnSystemDomain.VENTILATION,
      unitObjectIds,
      schemaTemplate: VENTILATION_AHU_DUAL_DUCT_HRU,
      elementKey: "360102",
    });

    const names = scoped.map((entry) => entry.objectName).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        "AI_SAFFlow",
        "AI_SupplyAirTemp",
        "EAFAutoMode",
        "Frostrisk",
        "SFP",
        "SupplySetpoint",
        "AirUnitAutoMode",
      ]),
    );
    expect(names).not.toContain("DO_SeqPumpY1");
    expect(names).not.toContain("320.002JP401_A");
    expect(names).toContain("DOSelect_SeqPumpY1");
    expect(names).toContain("DOSelect_SeqPumpY2");
    expect(names).toContain("Efficiency");
    expect(names).toContain("Lowefficiency");
    expect(names).toContain("Rotationguardexchanger");

    const ao3 = point({
      sourceId,
      sourceLabel,
      objectId: "ao-3",
      objectName: "AO_3",
      unit: "volts",
    });
    const ao5 = point({
      sourceId,
      sourceLabel,
      objectId: "ao-5",
      objectName: "AO_5",
      unit: "volts",
    });
    const withValves = resolveSdAnleggWorkspacePoints([...all, ao3, ao5], {
      domain: InfraspawnSystemDomain.VENTILATION,
      unitObjectIds,
      schemaTemplate: VENTILATION_AHU_DUAL_DUCT_HRU,
      elementKey: "360102",
    });
    expect(withValves.map((entry) => entry.objectName)).toEqual(
      expect.arrayContaining(["AO_3", "AO_5"]),
    );

    const settingsModel = buildAhuPresentationModel(scoped, { elementKey: "360102" });
    const settings = resolveAhuProcessSettingsItems(settingsModel, scoped);
    expect(settings.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Kommando pumpe varmebatteri"]),
    );
  });

  test("ExtractSetpoint beholdes for Innstillinger etter mal-scope", () => {
    const sourceId = "src-naerbyen";
    const sourceLabel = "360.102 Næringsdel";
    const vent360102 = [
      point({
        sourceId,
        sourceLabel,
        objectId: "saf-flow",
        objectName: "AI_SAFFlow",
        unit: "cubic-meters-per-hour",
        lastValue: 0,
      }),
    ];
    const all = [
      ...vent360102,
      point({
        sourceId,
        sourceLabel,
        objectId: "ext-sp",
        objectName: "ExtractSetpoint",
        unit: "degrees-celsius",
        lastValue: 23,
      }),
      point({
        sourceId,
        sourceLabel,
        objectId: "pump-y1",
        objectName: "DOSelect_SeqPumpY1",
        unit: "boolean",
        lastValue: 2,
      }),
    ];

    const scoped = resolveSdAnleggWorkspacePoints(all, {
      domain: InfraspawnSystemDomain.VENTILATION,
      unitObjectIds: vent360102.map((entry) => entry.objectId),
      schemaTemplate: VENTILATION_AHU_DUAL_DUCT_HRU,
      elementKey: "360102",
    });

    expect(scoped.map((entry) => entry.objectName)).toContain("ExtractSetpoint");

    const settingsModel = buildAhuPresentationModel(scoped, { elementKey: "360102" });
    const settings = resolveAhuProcessSettingsItems(settingsModel, scoped);
    expect(settings.map((item) => item.id)).toContain("setpoint.extract");
    expect(settings.find((item) => item.id === "setpoint.extract")?.displayValue).toMatch(
      /23.*°C/,
    );
  });

  test("expandPointsWithAhuProcessSettingsSignals tar med DOSelect fra samme kilde", () => {
    const anchor = [
      point({
        sourceId: "src-vent",
        sourceLabel: "Nærbyen Næring",
        objectId: "av-1",
        objectName: "AI_SAFFlow",
      }),
    ];
    const all = [
      ...anchor,
      point({
        sourceId: "src-vent",
        sourceLabel: "Nærbyen Næring",
        objectId: "sel-1",
        objectName: "DOSelect_SeqPumpY1",
        lastValue: 2,
      }),
      point({
        sourceId: "src-vent",
        sourceLabel: "Nærbyen Næring",
        objectId: "sel-2",
        objectName: "DOSelect_SeqPumpY2",
        lastValue: 2,
      }),
    ];

    const expanded = expandPointsWithAhuProcessSettingsSignals(all, anchor, "360102");
    const names = expanded.map((entry) => entry.objectName);

    expect(names).toContain("DOSelect_SeqPumpY1");
    expect(names).toContain("DOSelect_SeqPumpY2");
  });

  test("expandPointsWithAhuTemplateSchemaSignals tar med ugruppert status", () => {
    const anchor = [
      point({
        sourceId: "src-vent",
        sourceLabel: "Nærbyen Næring",
        objectId: "av-1",
        objectName: "AI_SAFFlow",
      }),
    ];
    const all = [
      ...anchor,
      point({
        sourceId: "src-vent",
        sourceLabel: "Nærbyen Næring",
        objectId: "sfp",
        objectName: "SFP",
        unit: "generic",
      }),
    ];

    const expanded = expandPointsWithAhuTemplateSchemaSignals(
      all,
      anchor,
      VENTILATION_AHU_DUAL_DUCT_HRU,
      "360102",
    );

    expect(expanded.map((entry) => entry.objectName)).toEqual(
      expect.arrayContaining(["AI_SAFFlow", "SFP"]),
    );
  });

  test("mal-scope tar med flate alarmer for 360102", () => {
    const anchor = [
      point({
        sourceId: "src-vent",
        sourceLabel: "360.102 Næringsdel",
        objectId: "saf-flow",
        objectName: "AI_SAFFlow",
        unit: "cubic-meters-per-hour",
      }),
    ];
    const all = [
      ...anchor,
      point({
        sourceId: "src-vent",
        sourceLabel: "360.102 Næringsdel",
        objectId: "fire",
        objectName: "Firealarm",
        unit: "boolean",
      }),
      point({
        sourceId: "src-vent",
        sourceLabel: "360.102 Næringsdel",
        objectId: "sum-a",
        objectName: "SumAlarmA",
        unit: "boolean",
      }),
    ];

    const expanded = expandPointsWithAhuTemplateSchemaSignals(
      all,
      anchor,
      VENTILATION_AHU_DUAL_DUCT_HRU,
      "360102",
    );

    expect(expanded.map((entry) => entry.objectName).sort()).toEqual(
      ["AI_SAFFlow", "Firealarm", "SumAlarmA"].sort(),
    );

    const scoped = resolveSdAnleggWorkspacePoints(all, {
      domain: InfraspawnSystemDomain.VENTILATION,
      unitObjectIds: anchor.map((entry) => entry.objectId),
      schemaTemplate: VENTILATION_AHU_DUAL_DUCT_HRU,
      elementKey: "360102",
    });

    expect(scoped.some((entry) => entry.objectName === "Firealarm")).toBe(true);
    expect(scoped.some((entry) => entry.objectName === "SumAlarmA")).toBe(true);
  });
});
