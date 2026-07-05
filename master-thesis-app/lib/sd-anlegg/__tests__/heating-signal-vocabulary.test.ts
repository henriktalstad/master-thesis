import { describe, expect, test } from "bun:test";
import { formatHeatingCirculationPumpMode } from "@/lib/sd-anlegg/heating-signal-vocabulary";

describe("formatHeatingCirculationPumpMode", () => {
  test("KOM gir MODUS n", () => {
    expect(
      formatHeatingCirculationPumpMode({
        objectName: "320.002JP401_KOM",
        lastValue: 4,
      }),
    ).toBe("MODUS 4");
  });

  test("S gir AUTO ved verdi 3", () => {
    expect(
      formatHeatingCirculationPumpMode({
        objectName: "320.002JP401_S",
        lastValue: 3,
      }),
    ).toBe("AUTO");
  });
});
