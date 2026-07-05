import { describe, expect, test } from "bun:test";
import { normalizeControlPercent } from "@/lib/sd-anlegg/control/normalize-control-percent";

describe("normalizeControlPercent", () => {
  test("holder gyldig prosent uendret", () => {
    expect(normalizeControlPercent(67.6)).toEqual({
      pct: 67.6,
      suspectMisMap: false,
    });
  });

  test("klamper marginale avvik over 100 %", () => {
    expect(normalizeControlPercent(105)).toEqual({
      pct: 100,
      suspectMisMap: false,
    });
  });

  test("markerer luftmengde (m³/h) som feilkoblet pådrag", () => {
    expect(normalizeControlPercent(3011.47)).toEqual({
      pct: 0,
      suspectMisMap: true,
    });
  });
});
