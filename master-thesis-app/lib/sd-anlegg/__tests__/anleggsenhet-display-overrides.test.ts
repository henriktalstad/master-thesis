import { describe, expect, test } from "bun:test";
import {
  applyAnleggsenhetDisplayOverridesToDomainEntries,
  parseAnleggsenhetDisplayOverrides,
  resolveAnleggsenhetDisplayName,
  upsertAnleggsenhetDisplayOverride,
} from "@/lib/sd-anlegg/anleggsenhet-display-overrides";
import type { SdAnleggsenhet } from "@/lib/sd-anlegg/infer-anleggsenheter";

function unit(overrides: Partial<SdAnleggsenhet> = {}): SdAnleggsenhet {
  return {
    id: "src-1:360101",
    unitKey: "360101",
    sourceId: "src-1",
    sourceLabel: "Vent anlegg",
    displayName: "360.101 · Vent anlegg",
    slug: "360101",
    pointCount: 12,
    primaryDomain: "VENTILATION",
    detectionConfidence: "high",
    detectionMethod: "prefix",
    objectIds: ["AI-1"],
    ...overrides,
  };
}

describe("parseAnleggsenhetDisplayOverrides", () => {
  test("filtrerer ugyldige og duplikater", () => {
    expect(
      parseAnleggsenhetDisplayOverrides([
        { scopeId: "src-1:360101", displayName: "Boligdel blokk A" },
        { scopeId: "src-1:360101", displayName: "Duplikat" },
        { scopeId: "", displayName: "Tom" },
        { scopeId: "src-1:360102", displayName: "  " },
      ]),
    ).toEqual([{ scopeId: "src-1:360101", displayName: "Boligdel blokk A" }]);
  });
});

describe("resolveAnleggsenhetDisplayName", () => {
  test("bruker override når den finnes", () => {
    expect(
      resolveAnleggsenhetDisplayName("src-1:360101", "360.101 · Vent anlegg", [
        { scopeId: "src-1:360101", displayName: "360.101 Boligdel blokk A" },
      ]),
    ).toBe("360.101 Boligdel blokk A");
  });
});

describe("upsertAnleggsenhetDisplayOverride", () => {
  test("fjerner override når navn tømmes", () => {
    expect(
      upsertAnleggsenhetDisplayOverride(
        [{ scopeId: "src-1:360101", displayName: "Gammelt navn" }],
        "src-1:360101",
        "   ",
      ),
    ).toEqual([]);
  });
});

describe("applyAnleggsenhetDisplayOverridesToDomainEntries", () => {
  test("oppdaterer displayName på enheter", () => {
    const entries = applyAnleggsenhetDisplayOverridesToDomainEntries(
      [{ unit: unit(), domainPoints: [] }],
      [{ scopeId: "src-1:360101", displayName: "360.101 Boligdel blokk A" }],
    );

    expect(entries[0]?.unit.displayName).toBe("360.101 Boligdel blokk A");
  });
});
