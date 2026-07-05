import { describe, expect, it } from "vitest";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  parseWorkspacePointParam,
  resolveSignalDeepLink,
} from "@/lib/sd-anlegg/resolve-signal-deep-link";

const NAERBYEN_SOURCES = [{ id: "src-1", label: "Infraspawn Cloud" }] as const;

function point(
  partial: Partial<InfraspawnPointListItem> &
    Pick<InfraspawnPointListItem, "objectId" | "objectName">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Infraspawn Cloud",
    description: null,
    unit: "°C",
    lastValue: 20,
    lastSampledAt: null,
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...partial,
  };
}

describe("resolveSignalDeepLink", () => {
  const points = [
    point({ objectId: "ai-1", objectName: "360.102AI101_MV" }),
    point({ objectId: "rt-1", objectName: "320.002RT402_MV" }),
  ];

  it("bygger schema deep-link til ventilasjonsenhet", () => {
    const link = resolveSignalDeepLink({
      buildingSlug: "naerbyen",
      sourceId: "src-1",
      objectId: "ai-1",
      points,
      sources: NAERBYEN_SOURCES,
    });

    expect(link).not.toBeNull();
    expect(link!.href).toContain("/sd-anlegg/naerbyen/ventilasjon/");
    expect(link!.href).toContain("view=schema");
    expect(link!.href).toContain("point=src-1%3Aai-1");
  });

  it("bygger deep-link til varme når signal er varme", () => {
    const link = resolveSignalDeepLink({
      buildingSlug: "naerbyen",
      sourceId: "src-1",
      objectId: "rt-1",
      points,
      sources: NAERBYEN_SOURCES,
    });

    expect(link?.href).toContain("/sd-anlegg/naerbyen/varme/");
  });

  it("returnerer null for ukjent signal", () => {
    expect(
      resolveSignalDeepLink({
        buildingSlug: "naerbyen",
        sourceId: "src-1",
        objectId: "missing",
        points,
        sources: NAERBYEN_SOURCES,
      }),
    ).toBeNull();
  });
});

describe("parseWorkspacePointParam", () => {
  it("parser sourceId:objectId", () => {
    expect(parseWorkspacePointParam("src-1:obj-42")).toEqual({
      sourceId: "src-1",
      objectId: "obj-42",
    });
  });

  it("returnerer null for ugyldig format", () => {
    expect(parseWorkspacePointParam("")).toBeNull();
    expect(parseWorkspacePointParam("nocolon")).toBeNull();
  });
});
