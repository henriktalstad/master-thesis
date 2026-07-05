import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildNaerbyenSdAnleggSeedLayout } from "@/lib/sd-anlegg/naerbyen-seed-layout";
import { resolveSdAnleggBindingPoint } from "@/lib/sd-anlegg/resolve-binding-point";

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

describe("applySdAnleggAutoLayout", () => {
  test("spreder noder uten overlappende x/y for samme kolonne", () => {
    const layout = buildNaerbyenSdAnleggSeedLayout("source-1");
    const positions = layout.nodes.map((node) => node.position);
    const keys = positions.map((p) => `${p.x}:${p.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(layout.nodes.find((n) => n.id === "supply.fan")?.position.y).toBe(200);
    const exhaustY = layout.nodes.find((n) => n.id === "exhaust.fan")?.position.y;
    const supplyY = layout.nodes.find((n) => n.id === "supply.fan")?.position.y;
    expect(exhaustY).toBeDefined();
    expect(exhaustY).not.toBe(supplyY);
  });
});

describe("resolveSdAnleggBindingPoint", () => {
  test("matcher objectName når binding bruker KA501", () => {
    const resolved = resolveSdAnleggBindingPoint(
      { objectId: "KA501", sourceId: "s1" },
      [
        point({
          objectId: "BO-501",
          objectName: "KA501",
        }),
      ],
    );
    expect(resolved?.objectName).toBe("KA501");
  });
});
