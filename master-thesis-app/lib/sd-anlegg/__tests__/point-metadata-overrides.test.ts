import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  applyPointMetadataOverride,
  applyPointMetadataOverridesToList,
  buildSchemaSlotOverrideMap,
  parsePointMetadataOverrides,
  resolveEffectiveAnleggsenhetAssignments,
  resolvePointMetadataOverrideRemoval,
  upsertPointMetadataOverride,
} from "@/lib/sd-anlegg/point-metadata-overrides";

function point(
  partial: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectId">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "360.102",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 21.5,
    lastSampledAt: "2026-06-20T10:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...partial,
  };
}

describe("parsePointMetadataOverrides", () => {
  test("parser gyldige overrides — siste vinner ved duplikat", () => {
    expect(
      parsePointMetadataOverrides([
        {
          sourceId: "src-1",
          objectId: "AI_1",
          objectName: "360102_RT401_PV",
        },
        {
          sourceId: "src-1",
          objectId: "AI_1",
          description: "Temp. tilluft",
        },
      ]),
    ).toEqual([
      {
        sourceId: "src-1",
        objectId: "AI_1",
        description: "Temp. tilluft",
      },
    ]);
  });
});

describe("applyPointMetadataOverride", () => {
  test("sticky per felt — kun satt felt overstyres", () => {
    const base = point({
      objectId: "AI_1",
      objectName: "AI_SupplyAirTemp",
      description: "Flat BACnet",
    });

    const merged = applyPointMetadataOverride(base, {
      sourceId: "src-1",
      objectId: "AI_1",
      objectName: "360102_RT401_PV",
    });

    expect(merged.objectName).toBe("360102_RT401_PV");
    expect(merged.description).toBe("Flat BACnet");
  });
});

describe("applyPointMetadataOverridesToList", () => {
  test("merger overrides på riktig punkt", () => {
    const points = [
      point({ objectId: "AI_1", objectName: "AI_SupplyAirTemp" }),
      point({ objectId: "AI_2", objectName: "AI_ExhaustTemp" }),
    ];

    const result = applyPointMetadataOverridesToList(points, [
      {
        sourceId: "src-1",
        objectId: "AI_1",
        objectName: "360102_RT401_PV",
        description: "Temp. tilluft",
      },
    ]);

    expect(result[0]?.objectName).toBe("360102_RT401_PV");
    expect(result[0]?.description).toBe("Temp. tilluft");
    expect(result[1]?.objectName).toBe("AI_ExhaustTemp");
  });
});

describe("resolveEffectiveAnleggsenhetAssignments", () => {
  test("scopeId i metadata-override vinner", () => {
    const effective = resolveEffectiveAnleggsenhetAssignments(
      [
        {
          sourceId: "src-1",
          objectId: "AI_1",
          scopeId: "src-1:360101",
        },
      ],
      [
        {
          sourceId: "src-1",
          objectId: "AI_1",
          scopeId: "src-1:360102",
        },
      ],
    );

    expect(effective).toEqual([
      {
        sourceId: "src-1",
        objectId: "AI_1",
        scopeId: "src-1:360102",
      },
    ]);
  });
});

describe("upsertPointMetadataOverride", () => {
  test("bevarer andre felt ved delvis oppdatering", () => {
    const next = upsertPointMetadataOverride(
      [
        {
          sourceId: "src-1",
          objectId: "AI_1",
          objectName: "360102_RT401_PV",
          description: "Temp. tilluft",
        },
      ],
      {
        sourceId: "src-1",
        objectId: "AI_1",
        subCentral: "CPU1003",
      },
    );

    expect(next).toEqual([
      {
        sourceId: "src-1",
        objectId: "AI_1",
        objectName: "360102_RT401_PV",
        description: "Temp. tilluft",
        subCentral: "CPU1003",
      },
    ]);
  });
});

describe("buildSchemaSlotOverrideMap", () => {
  test("bygger map for eksplisitte slotter", () => {
    const map = buildSchemaSlotOverrideMap([
      {
        sourceId: "src-1",
        objectId: "AI_1",
        schemaSlotId: "supply.temp_out",
      },
    ]);

    expect(map.get("src-1:AI_1")).toBe("supply.temp_out");
  });
});

describe("resolvePointMetadataOverrideRemoval", () => {
  test("fjerner scope-assignment når override hadde scopeId", () => {
    const result = resolvePointMetadataOverrideRemoval(
      [
        {
          sourceId: "src-1",
          objectId: "AI_1",
          objectName: "360102_RT401_PV",
          scopeId: "src-1:360102",
        },
      ],
      [
        {
          sourceId: "src-1",
          objectId: "AI_1",
          scopeId: "src-1:360102",
        },
      ],
      "src-1",
      "AI_1",
    );

    expect(result.pointMetadataOverrides).toEqual([]);
    expect(result.anleggsenhetPointAssignments).toEqual([]);
  });

  test("bevarer assignment når override ikke hadde scopeId", () => {
    const assignments = [
      {
        sourceId: "src-1",
        objectId: "AI_1",
        scopeId: "src-1:360102",
      },
    ];
    const result = resolvePointMetadataOverrideRemoval(
      [
        {
          sourceId: "src-1",
          objectId: "AI_1",
          objectName: "360102_RT401_PV",
        },
      ],
      assignments,
      "src-1",
      "AI_1",
    );

    expect(result.pointMetadataOverrides).toEqual([]);
    expect(result.anleggsenhetPointAssignments).toEqual(assignments);
  });
});
