import { describe, expect, it } from "vitest";
import { naerbyenAuditFixturePoints } from "@/lib/sd-anlegg/naerbyen-seed-layout";
import {
  buildSdAnleggObjectCatalog,
  catalogEntryForPoint,
  catalogEntriesWithFdvDeviation,
} from "@/lib/sd-anlegg/build-sd-anlegg-object-catalog";

describe("buildSdAnleggObjectCatalog", () => {
  const sourceId = "src-naerbyen";
  const points = naerbyenAuditFixturePoints(sourceId);
  const sources = [{ id: sourceId, label: "360.102" }];

  const catalog = buildSdAnleggObjectCatalog({
    buildingName: "Sorgenfriveien 32B",
    buildingSlug: "sorgenfriveien-32ab",
    points,
    sources,
  });

  it("bygger én rad per live signal", () => {
    expect(catalog.entries).toHaveLength(points.length);
    expect(catalog.summary.total).toBe(points.length);
  });

  it("mapper ventilasjonssignal til UI-slot", () => {
    const jv501 = points.find((point) => point.objectName === "JV501");
    expect(jv501).toBeDefined();
    const entry = catalogEntryForPoint(catalog, jv501!);
    expect(entry?.uiSlot).toBe("JV501");
    expect(entry?.confidence).toBe("high");
  });

  it("mapper varmesignal til skjemarolle", () => {
    const tap = points.find((point) => point.objectName === "310.001RT402_SP");
    expect(tap).toBeDefined();
    const entry = catalogEntryForPoint(catalog, tap!);
    expect(entry?.fdvRole).toContain("TR001");
    expect(entry?.uiSlot).toBeTruthy();
  });

  it("eksponerer FDV-avvik der rolle finnes uten slot", () => {
    const deviations = catalogEntriesWithFdvDeviation(catalog);
    expect(Array.isArray(deviations)).toBe(true);
  });
});
