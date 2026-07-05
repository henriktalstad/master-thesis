import { describe, expect, it } from "vitest";
import { formatSdAnleggBuildingAddressLine } from "@/lib/sd-anlegg/format-building-address-line";

describe("formatSdAnleggBuildingAddressLine", () => {
  it("konsoliderer bokstavintervall på samme husnummer", () => {
    const line = formatSdAnleggBuildingAddressLine({
      address: "Sorgenfriveien 32A",
      postCode: "7031",
      postalPlace: "TRONDHEIM",
      addresses: [
        {
          address: "Sorgenfriveien 32A",
          postCode: "7031",
          postalPlace: "TRONDHEIM",
          numberFrom: 32,
          numberTo: 32,
          letterFrom: "A",
          letterTo: "A",
          isPrimary: true,
        },
        {
          address: "Sorgenfriveien 32B",
          postCode: "7031",
          postalPlace: "TRONDHEIM",
          numberFrom: 32,
          numberTo: 32,
          letterFrom: "B",
          letterTo: "B",
          isPrimary: false,
        },
      ],
    });

    expect(line).toBe("Sorgenfriveien 32A-32B, 7031 TRONDHEIM");
  });
});
