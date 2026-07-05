import { describe, expect, it } from "vitest";
import {
  formatSdAnleggContactPhoneDisplay,
  formatSdAnleggContactTelHref,
} from "../format-contact-phone";

describe("formatSdAnleggContactPhoneDisplay", () => {
  it("formaterer 8-sifret mobilnummer", () => {
    expect(formatSdAnleggContactPhoneDisplay("91775125")).toBe("917 75 125");
  });

  it("formaterer +47-prefiks", () => {
    expect(formatSdAnleggContactPhoneDisplay("+4791775125")).toBe("+47 917 75 125");
  });

  it("beholder ukjent format", () => {
    expect(formatSdAnleggContactPhoneDisplay("123")).toBe("123");
  });
});

describe("formatSdAnleggContactTelHref", () => {
  it("legger til +47 for 8 siffer", () => {
    expect(formatSdAnleggContactTelHref("91775125")).toBe("tel:+4791775125");
  });
});
