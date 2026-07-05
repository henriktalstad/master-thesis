import { describe, expect, test } from "bun:test";
import {
  alreadyExistsInfraspawnSourceResult,
  infraspawnDuplicateSourceMessage,
} from "@/lib/infraspawn/create-source-outcome";

describe("infraspawnDuplicateSourceMessage", () => {
  test("inkluderer byggnavn når det finnes", () => {
    expect(
      infraspawnDuplicateSourceMessage("Nærbyen Næring", "Sorgenfriveien 32B"),
    ).toBe(
      "Dette anlegget er allerede koblet til som «Nærbyen Næring» (Sorgenfriveien 32B).",
    );
  });

  test("fungerer uten byggnavn", () => {
    expect(infraspawnDuplicateSourceMessage("Nærbyen Næring", null)).toBe(
      "Dette anlegget er allerede koblet til som «Nærbyen Næring».",
    );
  });
});

describe("alreadyExistsInfraspawnSourceResult", () => {
  test("returnerer already_exists-outcome", () => {
    expect(
      alreadyExistsInfraspawnSourceResult({
        label: "Nærbyen Næring",
        buildingName: "Sorgenfriveien 32B",
      }),
    ).toEqual({
      outcome: "already_exists",
      message:
        "Dette anlegget er allerede koblet til som «Nærbyen Næring» (Sorgenfriveien 32B).",
    });
  });
});
