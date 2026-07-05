import { describe, expect, test } from "bun:test";
import { estimateCoolingActive } from "@/lib/sd-anlegg/control/control-sd-calibration";

describe("estimateCoolingActive", () => {
  test("inaktiv under min-terskel", () => {
    expect(
      estimateCoolingActive({ hour: "", coolingValvePct: 5 }, 18),
    ).toBe(false);
  });

  test("krever utetemp >= 16 °C", () => {
    expect(
      estimateCoolingActive({ hour: "", coolingValvePct: 50 }, 14),
    ).toBe(false);
    expect(
      estimateCoolingActive({ hour: "", coolingValvePct: 50 }, 16),
    ).toBe(true);
  });

  test("aktiv med lav feedback etter trust-resolve", () => {
    expect(
      estimateCoolingActive({ hour: "", coolingValvePct: 3.4 }, 12),
    ).toBe(false);
  });
});
