import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { NAERBYEN_AUDIT_FIXTURES } from "../fixtures/naerbyen-audit-fixtures";
import { NAERBYEN_HEATING_FIXTURES } from "./fixtures/naerbyen-heating-fixtures";
import {
  equipmentCodeMatchesLane,
  findBestBindingRuleMatch,
  groupTemplatePointsIntoSections,
  inferElementKeyFromUnitKey,
  resolveSchemaTemplateForScope,
  resolveTemplateBindings,
  scoreBindingRuleMatch,
  HEATING_DISTRICT_SECONDARY_CIRCUIT,
  VENTILATION_AHU_DUAL_DUCT_HRU,
} from "@/lib/sd-anlegg/schema-templates";

function fixturePoint(
  fixture: {
    objectId: string;
    objectName: string | null;
    description: string | null;
    unit: string | null;
  },
  sourceId = "s1",
): InfraspawnPointListItem {
  return {
    sourceId,
    sourceLabel: "360.102",
    objectId: fixture.objectId,
    objectName: fixture.objectName,
    description: fixture.description,
    unit: fixture.unit,
    lastValue: 1,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("schema templates", () => {
  test("velger kurerte varme-maler etter unitKey", () => {
    expect(
      resolveSchemaTemplateForScope({
        domain: InfraspawnSystemDomain.VENTILATION,
        unitKey: "360102",
      })?.id,
    ).toBe("ventilation.ahu.dual_duct_hru");

    expect(
      resolveSchemaTemplateForScope({
        domain: InfraspawnSystemDomain.HEATING,
        unitKey: "3200013",
      })?.id,
    ).toBe("heating.district.combined");

    expect(
      resolveSchemaTemplateForScope({
        domain: InfraspawnSystemDomain.HEATING,
        unitKey: "310001",
      })?.id,
    ).toBe("heating.tapwater.dhw");

    expect(
      resolveSchemaTemplateForScope({
        domain: InfraspawnSystemDomain.HEATING,
        unitKey: "310010",
      })?.id,
    ).toBe("heating.sump_pits");

    expect(
      resolveSchemaTemplateForScope({
        domain: InfraspawnSystemDomain.HEATING,
        unitKey: "320002",
      })?.id,
    ).toBe("heating.district.secondary_circuit");
  });

  test("beholder combined-mal når punkter har 320002/320003 elementKey", () => {
    const points = [
      fixturePoint({
        objectId: "oe-bolig",
        objectName: "320001OE001_turtemp",
        description: "Tur",
        unit: "degrees-celsius",
      }),
      fixturePoint({
        objectId: "oe-naering",
        objectName: "320003OE001_turtemp",
        description: "Tur næring",
        unit: "degrees-celsius",
      }),
    ];

    expect(
      resolveSchemaTemplateForScope(
        {
          domain: InfraspawnSystemDomain.HEATING,
          unitKey: "3200013",
        },
        points,
      )?.id,
    ).toBe("heating.district.combined");
  });

  test("infererer elementKey fra unitKey", () => {
    expect(inferElementKeyFromUnitKey("360102")).toBe("360102");
    expect(inferElementKeyFromUnitKey("320002")).toBe("320002");
    expect(inferElementKeyFromUnitKey("3200013")).toBeNull();
    expect(inferElementKeyFromUnitKey("3200001")).toBe("3200001");
    expect(inferElementKeyFromUnitKey("3600001")).toBe("3600001");
  });

  test("equipment lane policy skiller tilluft og avtrekk", () => {
    expect(equipmentCodeMatchesLane("JV401", "supply")).toBe(true);
    expect(equipmentCodeMatchesLane("JV501", "exhaust")).toBe(true);
    expect(equipmentCodeMatchesLane("KA401", "supply")).toBe(true);
    expect(equipmentCodeMatchesLane("KA501", "exhaust")).toBe(true);
    expect(equipmentCodeMatchesLane("LX471", "heat_recovery")).toBe(true);
  });

  test("binder BACnet SAFFlow når JV mangler", () => {
    const points = [
      {
        sourceId: "src-1",
        sourceLabel: "360.102 Næringsdel",
        objectId: "AI-SAF-1",
        objectName: "AI_SAFFlow",
        description: "Supply air flow",
        unit: "cubic-meters-per-hour",
        lastValue: 1200,
        lastSyncedAt: null,
      },
    ] as const;

    const { layout } = resolveTemplateBindings(
      VENTILATION_AHU_DUAL_DUCT_HRU,
      points,
      "360102",
    );

    expect(layout.nodes.some((node) => node.id === "supply.fan")).toBe(true);
  });

  test("binder ventilasjonsroller mot audit-fixtures", () => {
    const points = NAERBYEN_AUDIT_FIXTURES.map((f) => fixturePoint(f));
    const { layout, result } = resolveTemplateBindings(
      VENTILATION_AHU_DUAL_DUCT_HRU,
      points,
      "360102",
    );

    expect(result.boundRoleCount).toBeGreaterThanOrEqual(10);
    expect(layout.nodes.some((node) => node.id === "supply.fan")).toBe(true);
    expect(layout.nodes.some((node) => node.id === "exhaust.fan")).toBe(true);
    expect(layout.nodes.every((node) => node.lane != null)).toBe(true);

    const jv501 = points.find((p) => p.objectName === "JV501")!;
    expect(
      findBestBindingRuleMatch(
        points,
        { kind: "equipmentCode", prefix: "JV", lane: "exhaust" },
      )?.objectName,
    ).toBe(jv501.objectName);
  });

  test("grupperer ventilasjonspunkter i mal-lanes", () => {
    const points = NAERBYEN_AUDIT_FIXTURES.map((f) => fixturePoint(f));
    const sections = groupTemplatePointsIntoSections(
      points,
      VENTILATION_AHU_DUAL_DUCT_HRU,
      "360102",
    );
    const labels = sections.map((section) => section.label);

    expect(labels).toContain("Tilluft");
    expect(labels).toContain("Avtrekk");
    expect(labels).toContain("Varmegjenvinner");
  });

  test("skiller 320.002 og 320.003 varmepunkter med elementKey", () => {
    const points = NAERBYEN_HEATING_FIXTURES.map((f) => fixturePoint(f));

    const bolig = points.filter((p) => p.objectName?.includes("320.002"));
    const naring = points.filter((p) => p.objectName?.includes("320.003"));

    const boligLayout = resolveTemplateBindings(
      HEATING_DISTRICT_SECONDARY_CIRCUIT,
      bolig,
      "320002",
    ).layout;
    const naringLayout = resolveTemplateBindings(
      HEATING_DISTRICT_SECONDARY_CIRCUIT,
      naring,
      "320003",
    ).layout;

    expect(boligLayout.nodes.length).toBeGreaterThan(0);
    expect(naringLayout.nodes.length).toBeGreaterThan(0);
    expect(boligLayout.nodes.some((n) => n.id === "secondary.valve")).toBe(true);
    expect(naringLayout.nodes.some((n) => n.id === "secondary.valve")).toBe(true);
  });

  test("matcher KS-tag suffix for varme", () => {
    const point = fixturePoint(
      NAERBYEN_HEATING_FIXTURES.find(
        (fixture) => fixture.objectName === "320.002RT402_MV",
      )!,
    );
    expect(
      scoreBindingRuleMatch(
        point,
        { kind: "signalRole", equipmentPrefix: "RT", suffix: "MV" },
        "320002",
      ),
    ).toBeGreaterThan(90);
  });

  test("filtrerer PA elementKey ved binding", () => {
    const bolig = fixturePoint({
      objectId: "pa-bolig",
      objectName: "=3200.002.04RT402_MV",
      description: "Temperatur turvann",
      unit: "°C",
    });
    const fjernvarme = fixturePoint({
      objectId: "pa-fv",
      objectName: "=3200.001.04RT402_MV",
      description: "Temperatur turvann",
      unit: "°C",
    });
    const rule = {
      kind: "signalRole" as const,
      equipmentPrefix: "RT",
      suffix: "MV",
    };

    expect(scoreBindingRuleMatch(bolig, rule, "3200002")).toBeGreaterThan(0);
    expect(scoreBindingRuleMatch(bolig, rule, "3200001")).toBe(0);
    expect(scoreBindingRuleMatch(fjernvarme, rule, "3200001")).toBeGreaterThan(
      0,
    );
  });
});
