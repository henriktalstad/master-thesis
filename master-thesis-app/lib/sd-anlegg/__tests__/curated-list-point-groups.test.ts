import { describe, expect, test } from "bun:test";
import { buildTemplatePointClassification } from "@/lib/infraspawn/domain-point-list-filters";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { NAERBYEN_AUDIT_FIXTURES } from "../fixtures/naerbyen-audit-fixtures";
import {
  classifyTemplatePoint,
  buildTemplatePointLaneMap,
  groupTemplatePointsIntoSections,
  listVisibleTemplatePointGroups,
  VENTILATION_AHU_DUAL_DUCT_HRU,
} from "@/lib/sd-anlegg/schema-templates";

function fixturePoint(
  fixture: (typeof NAERBYEN_AUDIT_FIXTURES)[number],
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
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

describe("template list point groups", () => {
  test("plasserer tilluft og avtrekk etter skjema-mal", () => {
    const supplyFan = fixturePoint({
      ...NAERBYEN_AUDIT_FIXTURES[0]!,
      objectId: "AO-401",
      objectName: "JV401",
      description: "Tilluftsvifte",
    });
    const exhaustFan = fixturePoint({
      ...NAERBYEN_AUDIT_FIXTURES[1]!,
      objectId: "AO-501",
      objectName: "JV501",
      description: "Avtrekksvifte",
    });
    const points = [
      ...NAERBYEN_AUDIT_FIXTURES.filter(
        (fixture) =>
          !["JV501", "JV502", "AI_EAFPressure"].includes(fixture.objectName ?? ""),
      ).map(fixturePoint),
      supplyFan,
      exhaustFan,
    ];
    const laneByKey = buildTemplatePointLaneMap(
      VENTILATION_AHU_DUAL_DUCT_HRU,
      points,
      "360102",
    );

    expect(classifyTemplatePoint(supplyFan, laneByKey)).toBe("supply");
    expect(classifyTemplatePoint(exhaustFan, laneByKey)).toBe("exhaust");
  });

  test("grupperer audit-fixtures i skjemaseksjoner", () => {
    const points = NAERBYEN_AUDIT_FIXTURES.map(fixturePoint);
    const sections = groupTemplatePointsIntoSections(
      points,
      VENTILATION_AHU_DUAL_DUCT_HRU,
      "360102",
    );
    const labels = sections.map((section) => section.label);

    expect(labels).toContain("Tilluft");
    expect(labels).toContain("Avtrekk");
    expect(labels).toContain("Varmegjenvinner");
    expect(labels).toContain("Drift");
  });

  test("viser kun grupper med signaler", () => {
    const points = [
      fixturePoint(NAERBYEN_AUDIT_FIXTURES[0]!),
      fixturePoint(NAERBYEN_AUDIT_FIXTURES[1]!),
    ];

    expect(
      listVisibleTemplatePointGroups(
        points,
        VENTILATION_AHU_DUAL_DUCT_HRU,
        "360102",
      ),
    ).toEqual(["all", "supply", "exhaust"]);
  });

  test("domain-fasade eksporterer klassifisering uten rekursjon", () => {
    const points = NAERBYEN_AUDIT_FIXTURES.map(fixturePoint);
    const result = buildTemplatePointClassification(
      points,
      VENTILATION_AHU_DUAL_DUCT_HRU,
      "360102",
    );

    expect(result.visibleGroups.length).toBeGreaterThan(1);
    expect(result.counts.all).toBe(points.length);
  });
});
