import { describe, expect, test } from "bun:test";
import {
  mergeSiteProfileMetadata,
  parseSiteProfileMetadata,
} from "@/lib/sd-anlegg/site-profile-metadata";

describe("parseSiteProfileMetadata", () => {
  test("leser contactUserId og contactEmail", () => {
    expect(
      parseSiteProfileMetadata({
        contactUserId: "user-1",
        contactEmail: "kontakt@example.com",
      }),
    ).toEqual({
      contactUserId: "user-1",
      contactEmail: "kontakt@example.com",
      pointDisplayOverrides: [],
      anleggsenhetDisplayOverrides: [],
      anleggsenhetPointAssignments: [],
      pointMetadataOverrides: [],
      controlSignalBindings: [],
    });
  });

  test("returnerer null for tom metadata", () => {
    expect(parseSiteProfileMetadata(null)).toEqual({
      contactUserId: null,
      contactEmail: null,
      pointDisplayOverrides: [],
      anleggsenhetDisplayOverrides: [],
      anleggsenhetPointAssignments: [],
      pointMetadataOverrides: [],
      controlSignalBindings: [],
    });
  });
});

describe("mergeSiteProfileMetadata", () => {
  test("bevarer eksisterende felt ved delvis patch", () => {
    expect(
      mergeSiteProfileMetadata({ contactUserId: "user-1" }, {
        contactUserId: "user-2",
      }).contactUserId,
    ).toBe("user-2");
  });
});
