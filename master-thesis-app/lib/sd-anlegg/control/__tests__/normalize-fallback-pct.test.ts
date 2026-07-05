import { describe, expect, test } from "bun:test";
import {
  formatFallbackPctDisplay,
  normalizeFallbackPctFraction,
} from "@/lib/sd-anlegg/control/normalize-fallback-pct";

describe("normalizeFallbackPctFraction", () => {
  test("beholder brøk (0–1)", () => {
    expect(normalizeFallbackPctFraction(0.12)).toBe(0.12);
  });

  test("konverterer legacy prosent (0–100)", () => {
    expect(normalizeFallbackPctFraction(12)).toBe(0.12);
  });
});

describe("formatFallbackPctDisplay", () => {
  test("viser korrekt prosent fra legacy skala", () => {
    expect(formatFallbackPctDisplay(12)).toBe("12 %");
  });

  test("viser korrekt prosent fra brøk", () => {
    expect(formatFallbackPctDisplay(0.12)).toBe("12 %");
  });
});
