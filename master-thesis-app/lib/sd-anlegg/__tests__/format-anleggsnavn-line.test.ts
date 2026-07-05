import { describe, expect, it } from "vitest";
import { formatSdAnleggAnleggsnavnLine } from "@/lib/sd-anlegg/format-anleggsnavn-line";

describe("formatSdAnleggAnleggsnavnLine", () => {
  it("returnerer én kilde uendret", () => {
    expect(
      formatSdAnleggAnleggsnavnLine([{ label: "320.002 Næringsdel" }]),
    ).toBe("320.002 Næringsdel");
  });

  it("skiller flere kilder med mellomrom-prikk", () => {
    expect(
      formatSdAnleggAnleggsnavnLine([
        { label: "360.102 Vent" },
        { label: "320.001 Fjernvarme" },
      ]),
    ).toBe("360.102 Vent · 320.001 Fjernvarme");
  });

  it("returnerer null uten kilder", () => {
    expect(formatSdAnleggAnleggsnavnLine([])).toBeNull();
  });
});
