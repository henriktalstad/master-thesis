import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { inferAnleggsenheterFromPoints } from "@/lib/sd-anlegg/infer-anleggsenheter";
import { inferSdComponentTypeForPoint } from "@/lib/sd-anlegg/infer-components";
import {
  expandPointsWithTapWaterCircuit,
  resolveSdAnleggWorkspacePoints,
} from "@/lib/sd-anlegg/scope-workspace-points";
import {
  findBestBindingRuleMatch,
  HEATING_DISTRICT_SECONDARY_CIRCUIT,
  resolveTemplateBindings,
} from "@/lib/sd-anlegg/schema-templates";
import {
  NAERBYEN_HEATING_FDV_CORE_EQUIPMENT,
  NAERBYEN_HEATING_FIXTURES,
} from "./fixtures/naerbyen-heating-fixtures";

function fixturePoint(
  fixture: (typeof NAERBYEN_HEATING_FIXTURES)[number],
  sourceId = "src-varme",
): InfraspawnPointListItem {
  return {
    sourceId,
    sourceLabel: "320.001-3 Fjernvarme",
    objectId: fixture.objectId,
    objectName: fixture.objectName,
    description: fixture.description,
    unit: fixture.unit,
    lastValue: 1,
    lastSampledAt: "2026-06-20T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("heating FDV 320.001 identification", () => {
  const allPoints = NAERBYEN_HEATING_FIXTURES.map((f) => fixturePoint(f));

  test("TR002: boligdel binder RT402, RT901 og SB502", () => {
    const boligPoints = allPoints.filter((p) =>
      p.objectName?.includes("320.002"),
    );
    const withOutdoor = [
      ...boligPoints,
      fixturePoint(
        NAERBYEN_HEATING_FIXTURES.find(
          (f) => f.objectName === "320.001RT901_MV",
        )!,
      ),
    ];

    const { layout } = resolveTemplateBindings(
      HEATING_DISTRICT_SECONDARY_CIRCUIT,
      withOutdoor,
      "320002",
    );

    const nodeIds = new Set(layout.nodes.map((node) => node.id));
    expect(nodeIds.has("secondary.supply_temp")).toBe(true);
    expect(nodeIds.has("secondary.valve")).toBe(true);
    expect(nodeIds.has("compensation.outdoor_temp")).toBe(true);
  });

  test("TR001: boligdel scope inkluderer 310.001 tappevann", () => {
    const boligAnchor = allPoints.filter(
      (p) => p.objectName === "320.002RT402_MV",
    );
    const expanded = expandPointsWithTapWaterCircuit(
      allPoints,
      boligAnchor,
      "320002",
    );
    const names = expanded.map((p) => p.objectName);
    expect(names).toContain("310.001RT402_MV");
    expect(names).toContain("310.001SB501_C");
    expect(names).toContain("310.001JP501_A");
  });

  test("310.001SB501 er ikke ventilasjon 360102", () => {
    const points = [
      {
        ...fixturePoint(
          NAERBYEN_HEATING_FIXTURES.find(
            (f) => f.objectName === "310.001SB501_C",
          )!,
        ),
        sourceId: "src-multi",
      },
      {
        ...fixturePoint(
          NAERBYEN_HEATING_FIXTURES.find(
            (f) => f.objectName === "320.002RT402_MV",
          )!,
        ),
        sourceId: "src-multi",
      },
    ];

    const { units } = inferAnleggsenheterFromPoints(points, [
      { id: "src-multi", label: "360.102 Næringsdel" },
    ]);

    expect(units.some((u) => u.unitKey === "360102")).toBe(false);
  });

  test("klassifiserer OE effekt og energi", () => {
    for (const name of [
      "320001OE001_effekt",
      "320001OE001_energi",
      "320001OE001_flow",
    ]) {
      const point = fixturePoint(
        NAERBYEN_HEATING_FIXTURES.find((f) => f.objectName === name)!,
      );
      expect(inferSdComponentTypeForPoint(point)).toBe("generic.signal");
    }
  });

  test("skiller SB501 tappevann fra SB502 samlestokk", () => {
    const tapValve = fixturePoint(
      NAERBYEN_HEATING_FIXTURES.find((f) => f.objectName === "310.001SB501_C")!,
    );
    const secValve = fixturePoint(
      NAERBYEN_HEATING_FIXTURES.find((f) => f.objectName === "320.002SB502_C")!,
    );

    const sb502Rule = {
      kind: "equipmentDigits" as const,
      prefix: "SB",
      digits: "502",
    };
    const sb501Rule = {
      kind: "equipmentDigits" as const,
      prefix: "SB",
      digits: "501",
      allowCrossElement: true,
    };

    expect(
      findBestBindingRuleMatch([tapValve], sb501Rule, "320002")?.objectName,
    ).toBe("310.001SB501_C");
    expect(findBestBindingRuleMatch([tapValve], sb502Rule, "320002")).toBeNull();
    expect(
      findBestBindingRuleMatch([secValve], sb502Rule, "320002")?.objectName,
    ).toBe("320.002SB502_C");
  });

  test("golden: ≥80 % FDV-kjerneutstyr bundet for bolig + kryss-element", () => {
    const boligPoints = allPoints.filter(
      (p) =>
        p.objectName?.includes("320.002") ||
        p.objectName?.startsWith("310.001") ||
        p.objectName === "320.001RT901_MV",
    );

    const { layout, result } = resolveTemplateBindings(
      HEATING_DISTRICT_SECONDARY_CIRCUIT,
      boligPoints,
      "320002",
    );

    const boundObjectIds = new Set(
      layout.nodes.flatMap((node) =>
        (node.bindings ?? []).map((b) => b.objectId),
      ),
    );
    const boundNames = new Set(
      boligPoints
        .filter((p) => boundObjectIds.has(p.objectId))
        .map((p) => p.objectName),
    );

    const boligCore = NAERBYEN_HEATING_FDV_CORE_EQUIPMENT.filter(
      (name) =>
        name.includes("320.002") ||
        name.startsWith("310.001") ||
        name === "320.001RT901_MV",
    );
    const boundCount = boligCore.filter((name) => boundNames.has(name)).length;
    const coveragePct = Math.round((boundCount / boligCore.length) * 100);

    expect(result.boundRoleCount).toBeGreaterThanOrEqual(8);
    expect(coveragePct).toBeGreaterThanOrEqual(80);
    expect(layout.nodes.some((n) => n.id === "tapwater.valve")).toBe(true);
    expect(layout.nodes.some((n) => n.id === "compensation.outdoor_temp")).toBe(
      true,
    );
  });

  test("skiller OE001 bolig fra næring ved elementKey", () => {
    const boligOe = fixturePoint(
      NAERBYEN_HEATING_FIXTURES.find((f) => f.objectName === "320001OE001_effekt")!,
    );
    const naeringOe = fixturePoint(
      NAERBYEN_HEATING_FIXTURES.find((f) => f.objectName === "320003OE001_effekt")!,
    );
    const rule = {
      kind: "oeSuffix" as const,
      suffix: "effekt",
      allowCrossElement: true,
    };

    expect(
      findBestBindingRuleMatch([boligOe, naeringOe], rule, "320002")?.objectName,
    ).toBe("320001OE001_effekt");
    expect(
      findBestBindingRuleMatch([boligOe, naeringOe], rule, "320003")?.objectName,
    ).toBe("320003OE001_effekt");
  });

  test("resolveSdAnleggWorkspacePoints inkluderer tappevann for boligdel", () => {
    const unitObjectIds = allPoints
      .filter((p) => p.objectName === "320.002RT402_MV")
      .map((p) => p.objectId);

    const scoped = resolveSdAnleggWorkspacePoints(allPoints, {
      domain: InfraspawnSystemDomain.HEATING,
      unitObjectIds,
      schemaTemplate: HEATING_DISTRICT_SECONDARY_CIRCUIT,
      elementKey: "320002",
    });

    expect(scoped.some((p) => p.objectName === "310.001JP501_A")).toBe(true);
  });
});
