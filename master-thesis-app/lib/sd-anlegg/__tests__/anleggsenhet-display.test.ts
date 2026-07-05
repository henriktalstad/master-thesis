import { describe, expect, test } from "bun:test";
import type { SdAnleggsenhet } from "@/lib/sd-anlegg/infer-anleggsenheter";
import {
  anleggsenhetDisplayNeedsManualName,
  extractDescriptiveNameFromSourceLabel,
  formatAnleggsenhetDisplay,
} from "@/lib/sd-anlegg/anleggsenhet-display";
import { upsertAnleggsenhetDisplayOverride } from "@/lib/sd-anlegg/anleggsenhet-display-overrides";

function unit(
  overrides: Partial<SdAnleggsenhet> & Pick<SdAnleggsenhet, "unitKey">,
): SdAnleggsenhet {
  return {
    id: overrides.id ?? `src-1:${overrides.unitKey}`,
    unitKey: overrides.unitKey,
    sourceId: overrides.sourceId ?? "src-1",
    sourceLabel: overrides.sourceLabel ?? "Nærbyen",
    displayName: overrides.displayName ?? "",
    slug: overrides.slug ?? overrides.unitKey,
    pointCount: overrides.pointCount ?? 1,
    primaryDomain: overrides.primaryDomain ?? "VENTILATION",
    detectionConfidence: overrides.detectionConfidence ?? "high",
    detectionMethod: overrides.detectionMethod ?? "prefix",
    objectIds: overrides.objectIds ?? ["AI-1"],
  };
}

describe("extractDescriptiveNameFromSourceLabel", () => {
  test("henter navn etter kode i kildelabel", () => {
    expect(
      extractDescriptiveNameFromSourceLabel(
        "360.102 Næringsdel blokk A",
        "360102",
      ),
    ).toBe("Næringsdel blokk A");
  });

  test("returnerer null når kilden bare er byggnavn", () => {
    expect(extractDescriptiveNameFromSourceLabel("Nærbyen", "360102")).toBeNull();
  });
});

describe("formatAnleggsenhetDisplay", () => {
  test("viser kode og navn med mellomrom", () => {
    expect(formatAnleggsenhetDisplay("360102", "Næringsdel blokk A")).toBe(
      "360.102 Næringsdel blokk A",
    );
  });

  test("viser kun kode uten navn", () => {
    expect(formatAnleggsenhetDisplay("360101", null)).toBe("360.101");
  });
});

describe("anleggsenhetDisplayNeedsManualName", () => {
  test("flagger manglende navn for manuell enhet", () => {
    const entry = unit({ unitKey: "360101", sourceLabel: "Nærbyen" });
    expect(anleggsenhetDisplayNeedsManualName(entry, [])).toBe(true);
    expect(
      anleggsenhetDisplayNeedsManualName(entry, [
        { scopeId: entry.id, displayName: "360.101 Boligdel blokk A" },
      ]),
    ).toBe(false);
  });
});

describe("upsertAnleggsenhetDisplayOverride", () => {
  test("oppdaterer og fjerner override", () => {
    const initial = [{ scopeId: "src-1:360101", displayName: "Gammelt navn" }];
    expect(
      upsertAnleggsenhetDisplayOverride(
        initial,
        "src-1:360101",
        "360.101 Boligdel blokk A",
      ),
    ).toEqual([
      { scopeId: "src-1:360101", displayName: "360.101 Boligdel blokk A" },
    ]);
    expect(
      upsertAnleggsenhetDisplayOverride(initial, "src-1:360101", ""),
    ).toEqual([]);
  });
});
