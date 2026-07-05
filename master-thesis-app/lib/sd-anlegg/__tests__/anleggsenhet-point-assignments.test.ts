import { describe, expect, test } from "bun:test";
import {
  applyAnleggsenhetPointAssignments,
  parseAnleggsenhetPointAssignments,
  upsertAnleggsenhetPointAssignment,
} from "@/lib/sd-anlegg/anleggsenhet-point-assignments";
import type { SdAnleggsenhet } from "@/lib/sd-anlegg/infer-anleggsenheter";
import { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";

function unit(partial: Partial<SdAnleggsenhet> & Pick<SdAnleggsenhet, "id" | "unitKey" | "objectIds">): SdAnleggsenhet {
  return {
    sourceId: "src-1",
    sourceLabel: "360.102 Næringsdel",
    displayName: partial.unitKey,
    slug: partial.unitKey,
    pointCount: partial.objectIds.length,
    primaryDomain: InfraspawnSystemDomain.VENTILATION,
    detectionConfidence: "high",
    detectionMethod: "equipment_band",
    ...partial,
  };
}

describe("anleggsenhet-point-assignments", () => {
  test("flytter punkt mellom enheter", () => {
    const units = [
      unit({
        id: "src-1:360101",
        unitKey: "360101",
        objectIds: ["JV401", "orphan-1"],
      }),
      unit({
        id: "src-1:360102",
        unitKey: "360102",
        objectIds: ["JV501"],
      }),
    ];

    const next = applyAnleggsenhetPointAssignments(units, [
      {
        sourceId: "src-1",
        objectId: "orphan-1",
        scopeId: "src-1:360102",
      },
    ]);

    const bolig = next.find((entry) => entry.unitKey === "360101");
    const naring = next.find((entry) => entry.unitKey === "360102");
    expect(bolig?.objectIds).toEqual(["JV401"]);
    expect(naring?.objectIds).toContain("orphan-1");
    expect(naring?.objectIds).toContain("JV501");
  });

  test("parser og upserter assignments", () => {
    const parsed = parseAnleggsenhetPointAssignments([
      { sourceId: "src-1", objectId: "AI-1", scopeId: "src-1:360102" },
      { sourceId: "", objectId: "bad", scopeId: "x" },
    ]);
    expect(parsed).toHaveLength(1);

    const next = upsertAnleggsenhetPointAssignment(parsed, {
      sourceId: "src-1",
      objectId: "AI-2",
      scopeId: "src-1:360101",
    });
    expect(next).toHaveLength(2);
  });
});
