import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  SD_ANLEGG_SOURCE_UNIT_KEY,
  SD_ANLEGG_UNGROUPED_UNIT_KEY,
  anleggsenhetSlug,
  buildAnleggsenhetScopeId,
  extractAnleggsenhetUnitKeyFromPoint,
  filterPointsForAnleggsenhet,
  formatAnleggsenhetUnitKeyForDisplay,
  inferAnleggsenheterFromPoints,
  normalizeAnleggsenhetUnitKey,
  parseAnleggsenhetScopeId,
} from "@/lib/sd-anlegg/infer-anleggsenheter";
import { NAERBYEN_AUDIT_FIXTURES } from "../fixtures/naerbyen-audit-fixtures";
import { NAERBYEN_HEATING_FIXTURES } from "./fixtures/naerbyen-heating-fixtures";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "src-naerbyen",
    sourceLabel: "360.102 Næringsdel blokk A",
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

describe("extractAnleggsenhetUnitKeyFromPoint", () => {
  test("trekker ut 360102 fra underscore-prefix", () => {
    expect(
      extractAnleggsenhetUnitKeyFromPoint({
        objectId: "AO-501",
        objectName: "360102_JV501",
        description: "Tilluftsvifte",
        unit: null,
      }),
    ).toBe("360102");
  });

  test("ignorerer utstyrsprefix som 310.001", () => {
    expect(
      extractAnleggsenhetUnitKeyFromPoint({
        objectId: "AI-402",
        objectName: "310.001RT402_SP",
        description: "Setpunkt retur",
        unit: null,
      }),
    ).toBeNull();
  });

  test("returnerer null for vanlige ventilasjonstagger uten blokk", () => {
    expect(
      extractAnleggsenhetUnitKeyFromPoint({
        objectId: "AO-501",
        objectName: "JV501",
        description: "Tilluftsvifte",
        unit: null,
      }),
    ).toBeNull();
  });

  test("trekker ut 320002 fra kompakt varmekode", () => {
    expect(
      extractAnleggsenhetUnitKeyFromPoint({
        objectId: "AI-402",
        objectName: "320.002RT402_MV",
        description: "Temperatur turvann",
        unit: null,
      }),
    ).toBe("320002");
  });

  test("trekker ut 320001 fra energimåler-underscore", () => {
    expect(
      extractAnleggsenhetUnitKeyFromPoint({
        objectId: "AI-001",
        objectName: "320001OE001_turtemp",
        description: "Turtemperatur inn",
        unit: null,
      }),
    ).toBe("320001");
  });
});

describe("inferAnleggsenheterFromPoints", () => {
  test("Nærbyen uten blokk-prefix grupperer vent-utstyr på 360102", () => {
    const points = NAERBYEN_AUDIT_FIXTURES.filter(
      (fixture) => !fixture.objectName?.startsWith("320"),
    ).map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );

    const { units, ungroupedPointCount } = inferAnleggsenheterFromPoints(points, [
      { id: "src-naerbyen", label: "360.102 Næringsdel blokk A" },
    ]);

    expect(units.some((unit) => unit.unitKey === "360102")).toBe(true);
    expect(ungroupedPointCount).toBeLessThanOrEqual(5);
  });

  test("skiller 360101 og 360102 i samme kilde", () => {
    const points = [
      point({
        objectId: "1",
        objectName: "360102_JV501",
        description: "Tilluftsvifte næring",
      }),
      point({
        objectId: "2",
        objectName: "360102_KA501",
        description: "Tilluftspjeld næring",
      }),
      point({
        objectId: "3",
        objectName: "360101_JV401",
        description: "Tilluftsvifte bolig",
      }),
      point({
        objectId: "4",
        objectName: "360101_KA401",
        description: "Tilluftspjeld bolig",
      }),
    ];

    const { units } = inferAnleggsenheterFromPoints(points, [
      { id: "src-multi", label: "Nærbyen" },
    ]);

    expect(units).toHaveLength(2);
    expect(units.map((unit) => unit.unitKey).sort()).toEqual(["360101", "360102"]);
    expect(units.every((unit) => unit.detectionMethod === "prefix")).toBe(true);
  });

  test("legger få ugrupperte punkter på største enhet", () => {
    const points = [
      point({ objectId: "1", objectName: "360102_JV501" }),
      point({ objectId: "2", objectName: "360102_KA501" }),
      point({ objectId: "3", objectName: "360101_JV401" }),
      point({ objectId: "4", objectName: "Systemstatus" }),
    ];

    const { units, ungroupedPointCount } = inferAnleggsenheterFromPoints(points, [
      { id: "src-multi", label: "Nærbyen" },
    ]);

    expect(units).toHaveLength(2);
    expect(ungroupedPointCount).toBe(0);
    expect(units.find((unit) => unit.unitKey === "360102")?.pointCount).toBe(3);
  });

  test("grupperer rene vent-tagger uten utstyrsprefix på utstyrsbånd", () => {
    const points = [
      point({ sourceId: "src-multi", objectId: "1", objectName: "JV502" }),
      point({ sourceId: "src-multi", objectId: "2", objectName: "KA502" }),
      point({ sourceId: "src-multi", objectId: "3", objectName: "Systemstatus" }),
    ];

    const { units } = inferAnleggsenheterFromPoints(points, [
      { id: "src-multi", label: "Nærbyen Næring" },
    ]);

    expect(units.some((unit) => unit.unitKey === "360102")).toBe(true);
    expect(
      units.find((unit) => unit.unitKey === "360102")?.objectIds,
    ).toEqual(expect.arrayContaining(["1", "2", "3"]));
  });

  test("legger systemstatus på dominerende vent-enhet", () => {
    const points = [
      point({ sourceId: "src-multi", objectId: "1", objectName: "360102_JV501" }),
      point({ sourceId: "src-multi", objectId: "2", objectName: "JV502" }),
      point({ sourceId: "src-multi", objectId: "3", objectName: "KA502" }),
      point({ sourceId: "src-multi", objectId: "4", objectName: "Systemstatus" }),
    ];

    const { units, ungroupedPointCount } = inferAnleggsenheterFromPoints(points, [
      { id: "src-multi", label: "Nærbyen" },
    ]);

    expect(units.some((unit) => unit.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY)).toBe(
      false,
    );
    expect(ungroupedPointCount).toBe(0);
    expect(units.find((unit) => unit.unitKey === "360102")?.pointCount).toBeGreaterThan(
      1,
    );
  });

  test("slår drift-stripe-signaler inn i 360102 uten ugruppert-bøtte", () => {
    const flatSignals = [
      "AI_SAFFLOW",
      "AI_EAFFLOW",
      "AI_SupplyAirTemp",
      "AI_ExtractAirTemp",
      "AI_FilterGuard1",
      "AI_EAFPressure",
      "AI_EfficiencyTemp",
      "AI_IntakeAirTemp",
      "AO_SAF",
      "AO_EAF",
      "DO_SAFStart",
      "DO_EAFStart",
      "AO_3",
      "AO_5",
      "DO_SeqPumpY1",
      "Efficiency",
      "AI_FilterGuard2",
      "UnitMode",
      "Systemstatus",
      "SupplySetpoint",
      "SFP",
    ];

    const points = [
      ...flatSignals.map((objectName, index) =>
        point({
          sourceId: "src-multi",
          sourceLabel: "Nærbyen Næring",
          objectId: `flat-${index}`,
          objectName,
        }),
      ),
      point({
        sourceId: "src-multi",
        sourceLabel: "Nærbyen Næring",
        objectId: "AM-1",
        objectName: "AirUnitAutoMode",
        description: "Running mode air unit",
        unit: "boolean",
      }),
      point({
        sourceId: "src-multi",
        sourceLabel: "Nærbyen Næring",
        objectId: "BO-602",
        objectName: "Frostrisk",
        description: "Romtemperatur",
        unit: "boolean",
      }),
      point({
        sourceId: "src-multi",
        sourceLabel: "Nærbyen Næring",
        objectId: "AV-PID",
        objectName: "SupplyPID_SetP",
        description: "Turtemperatur",
        unit: "degrees-celsius",
      }),
    ];

    const { units, ungroupedPointCount } = inferAnleggsenheterFromPoints(points, [
      { id: "src-multi", label: "360.102 Næringsdel blokk A" },
    ]);

    expect(units.some((unit) => unit.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY)).toBe(
      false,
    );
    expect(ungroupedPointCount).toBe(0);
    expect(units.find((unit) => unit.unitKey === "360102")?.pointCount).toBe(
      points.length,
    );
  });

  test("bootstrapper vent via varme-søsken for flate BACnet uten 360 i kildelabel", () => {
    const flatVentSignals = [
      "AI_SAFFLOW",
      "AI_EAFFLOW",
      "AI_SupplyAirTemp",
      "AI_ExtractAirTemp",
      "UnitMode",
      "Systemstatus",
    ];
    const heatingPoints = NAERBYEN_HEATING_FIXTURES.filter(
      (fixture) => fixture.objectId === "AI-320003-OE-effekt",
    ).map((fixture) =>
      point({
        sourceId: "src-multi",
        sourceLabel: "Nærbyen Næring",
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );
    const ventPoints = flatVentSignals.map((objectName, index) =>
      point({
        sourceId: "src-multi",
        sourceLabel: "Nærbyen Næring",
        objectId: `vent-${index}`,
        objectName,
      }),
    );

    const { units, ungroupedPointCount } = inferAnleggsenheterFromPoints(
      [...heatingPoints, ...ventPoints],
      [{ id: "src-multi", label: "Nærbyen Næring" }],
    );

    expect(units.some((unit) => unit.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY)).toBe(
      false,
    );
    expect(ungroupedPointCount).toBe(0);
    expect(units.find((unit) => unit.unitKey === "360102")?.pointCount).toBe(
      ventPoints.length,
    );
  });

  test("skiller 320002 og 320003 som varmeanlegg", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map((fixture) =>
      point({
        objectId: fixture.objectId,
        objectName: fixture.objectName,
        description: fixture.description,
        unit: fixture.unit,
      }),
    );

    const { units } = inferAnleggsenheterFromPoints(points, [
      { id: "src-varme", label: "320.001-3 Fjernvarme" },
    ]);

    expect(units.map((unit) => unit.unitKey).sort()).toEqual([
      "320001",
      "320002",
      "320003",
    ]);
    expect(
      units.find((unit) => unit.unitKey === "320002")?.objectIds,
    ).toEqual(
      expect.arrayContaining([
        "AI-310001-RT402-MV",
        "AO-310001-SB501",
        "BI-310001-JP501-A",
      ]),
    );
    expect(units.find((unit) => unit.unitKey === "320002")?.displayName).toContain(
      "Boligdel",
    );
    expect(units.find((unit) => unit.unitKey === "320003")?.displayName).toContain(
      "Næringsdel",
    );
  });

  test("klassifiserer Nærbyen BACnet-filter til 360102", () => {
    const points = [
      point({
        sourceId: "src-multi",
        objectId: "AV-40323",
        objectName: "AI_FilterGuard1",
        description: "Ana. filter 1 value",
        unit: "pascals",
      }),
      point({
        sourceId: "src-multi",
        objectId: "AV-40324",
        objectName: "AI_FilterGuard2",
        description: "Ana. filter 2 value",
        unit: "pascals",
      }),
    ];

    const { units } = inferAnleggsenheterFromPoints(points, [
      { id: "src-multi", label: "360.102 Næringsdel blokk A" },
    ]);

    expect(units.some((unit) => unit.unitKey === "360102")).toBe(true);
    expect(
      units.find((unit) => unit.unitKey === "360102")?.objectIds,
    ).toEqual(expect.arrayContaining(["AV-40323", "AV-40324"]));
  });

  test("310.001SB501 er tappevann — ikke utstyrsbånd til 360102", () => {
    const points = [
      point({
        sourceId: "src-multi",
        objectId: "AG-1",
        objectName: "310.001SB501_C",
        description: "Ventilstilling tappevann",
        unit: "percent",
      }),
      point({
        sourceId: "src-multi",
        objectId: "AV-40323",
        objectName: "AI_FilterGuard1",
        description: "Ana. filter 1 value",
        unit: "pascals",
      }),
    ];

    const { units } = inferAnleggsenheterFromPoints(points, [
      { id: "src-multi", label: "360.102 Næringsdel blokk A" },
    ]);

    const ventUnit = units.find((unit) => unit.unitKey === "360102");
    expect(ventUnit?.objectIds).toEqual(expect.arrayContaining(["AV-40323"]));
    expect(ventUnit?.objectIds).not.toContain("AG-1");
  });
});

describe("anleggsenhet helpers", () => {
  test("normaliserer og formaterer blokknummer", () => {
    expect(normalizeAnleggsenhetUnitKey("360.102")).toBe("360102");
    expect(formatAnleggsenhetUnitKeyForDisplay("360102")).toBe("360.102");
    expect(formatAnleggsenhetUnitKeyForDisplay("320002")).toBe("320.002");
  });

  test("scopeId kan parses og filtrerer punkter", () => {
    const unit = {
      sourceId: "src-1",
      objectIds: ["a", "b"],
    };
    const points = [
      point({ sourceId: "src-1", objectId: "a" }),
      point({ sourceId: "src-1", objectId: "b" }),
      point({ sourceId: "src-1", objectId: "c" }),
    ];

    const scopeId = buildAnleggsenhetScopeId("src-1", "360102");
    expect(parseAnleggsenhetScopeId(scopeId)).toEqual({
      sourceId: "src-1",
      unitKey: "360102",
    });
    expect(filterPointsForAnleggsenhet(points, unit)).toHaveLength(2);
    expect(anleggsenhetSlug("360102", "src-1")).toBe("360102");
    expect(anleggsenhetSlug(SD_ANLEGG_SOURCE_UNIT_KEY, "src-1")).toBe(
      "kilde-src-1",
    );
  });
});
