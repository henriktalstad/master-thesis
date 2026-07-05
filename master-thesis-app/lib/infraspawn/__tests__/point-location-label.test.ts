import { describe, expect, it } from "bun:test";
import {
  extractLocationPhraseFromText,
  findLocationFromRelatedPoints,
  resolveInfraspawnPointLocationLabel,
} from "../point-location-label";

describe("point-location-label", () => {
  it("parser heissjakt fra description", () => {
    expect(
      extractLocationPhraseFromText("Romtemperatur heissjakt", "B"),
    ).toBe("Heissjakt bygg B");
  });

  it("parser heissjakt med eksplisitt bygg-bokstav", () => {
    expect(extractLocationPhraseFromText("Heissjakt bygg B")).toBe(
      "Heissjakt bygg B",
    );
  });

  it("resolver lokasjon fra krysspunkt på samme utstyr", () => {
    expect(
      resolveInfraspawnPointLocationLabel({
        point: {
          objectId: "362.001RT601_MV",
          objectName: "362.001RT601_MV",
          description: null,
          sourceLabel: "Nærbyen Næring",
        },
        relatedPoints: [
          {
            objectId: "AI-20",
            objectName: "362.001RT601_MV",
            description: "Romtemperatur heissjakt bygg B",
            sourceLabel: "Nærbyen Næring",
          },
          {
            objectId: "362.001RT601_MV",
            objectName: "362.001RT601_MV",
            description: null,
            sourceLabel: "Nærbyen Næring",
          },
        ],
      }),
    ).toBe("Heissjakt bygg B");
  });

  it("finner lokasjon fra søskenpunkt via utstyrskode", () => {
    expect(
      findLocationFromRelatedPoints(
        {
          objectId: "362.001RT601_MV",
          objectName: "362.001RT601_MV",
          description: null,
          sourceLabel: "360.102 Næringsdel blokk B",
        },
        [
          {
            objectId: "362.001RT601_SP",
            objectName: "362.001RT601_SP",
            description: "Heissjakt bygg B",
            sourceLabel: "360.102 Næringsdel blokk B",
          },
        ],
        "B",
      ),
    ).toBe("Heissjakt bygg B");
  });
});
