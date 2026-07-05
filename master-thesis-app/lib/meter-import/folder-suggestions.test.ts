import { describe, expect, it } from "vitest";

import { generateMeterFolderSuggestions } from "./folder-suggestions";

describe("generateMeterFolderSuggestions", () => {
  it("grupperer importerte målere på utfylt Blokk-kontekst", () => {
    const suggestions = generateMeterFolderSuggestions([
      {
        tempId: "m1",
        type: "ELECTRICITY",
        block: "1. etg.",
      },
      {
        tempId: "m2",
        type: "ELECTRICITY",
        block: "1. etg.",
      },
      {
        tempId: "m3",
        type: "HEAT",
        block: "Felles Varme",
      },
      {
        tempId: "m4",
        type: "ELECTRICITY",
        groupBlock: "Heis",
      },
      {
        tempId: "m5",
        type: "WATER",
        block: null,
      },
    ]);

    expect(suggestions).toEqual([
      {
        tempId: "mfi_0_1-etg",
        name: "1. etg.",
        icon: "bolt",
        sortOrder: 0,
        isPrimary: true,
        meterTempIds: ["m1", "m2"],
        source: "import",
      },
      {
        tempId: "mfi_1_felles-varme",
        name: "Felles Varme",
        icon: "flame",
        sortOrder: 1,
        isPrimary: true,
        meterTempIds: ["m3"],
        source: "import",
      },
      {
        tempId: "mfi_2_heis",
        name: "Heis",
        icon: "bolt",
        sortOrder: 2,
        isPrimary: true,
        meterTempIds: ["m4"],
        source: "import",
      },
    ]);
  });

  it("normaliserer mappenavn og dedupliserer medlemmer", () => {
    const suggestions = generateMeterFolderSuggestions([
      {
        tempId: "m1",
        type: "ELECTRICITY",
        block: "  2.   etg. ",
      },
      {
        tempId: "m1",
        type: "HEAT",
        block: "2. etg.",
      },
    ]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      name: "2. etg.",
      icon: "folder",
      meterTempIds: ["m1"],
    });
  });
});
