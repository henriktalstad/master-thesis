import { describe, expect, test } from "bun:test";
import {
  controlComparisonDeviation,
  roundControlComparisonValue,
} from "@/lib/sd-anlegg/control/control-comparison-precision";

describe("control-comparison-precision", () => {
  test("avrunder prosent til 1 desimal", () => {
    expect(roundControlComparisonValue(67.55, "%")).toBe(67.6);
    expect(roundControlComparisonValue(68, "%")).toBe(68);
  });

  test("beregner avvik på normaliserte verdier", () => {
    expect(controlComparisonDeviation(67.6, 68, "%")).toBe(0.4);
    expect(controlComparisonDeviation(67.56, 68, "%")).toBe(0.4);
  });
});
