import { describe, expect, test } from "bun:test";
import {
  formatInfraspawnKsElementForDisplay,
  parseInfraspawnPointKsTag,
} from "@/lib/infraspawn/parse-point-ks-tag";

describe("parseInfraspawnPointKsTag", () => {
  test("parser kompakt utstyrstag i objectName", () => {
    const parsed = parseInfraspawnPointKsTag({
      objectName: "320.002RT402_MV",
      description: "Temperatur turvann",
    });

    expect(parsed).toMatchObject({
      element: "320.002",
      elementKey: "320002",
      equipmentCode: "RT402",
      signalSuffix: "MV",
      isEnergyMeter: false,
    });
  });

  test("parser underscore energimåler-signaler", () => {
    const parsed = parseInfraspawnPointKsTag({
      objectName: "320001OE001_turtemp",
    });

    expect(parsed).toMatchObject({
      element: "320.001",
      elementKey: "320001",
      equipmentCode: "OE001",
      signalSuffix: "turtemp",
      isEnergyMeter: true,
    });
  });

  test("parser kilde-label som KS-element", () => {
    const parsed = parseInfraspawnPointKsTag({
      sourceLabel: "320.001-3 Fjernvarme",
    });

    expect(parsed?.element).toBe("320.001");
    expect(parsed?.elementKey).toBe("320001");
    expect(parsed?.equipmentCode).toBeNull();
    expect(parsed?.isEnergyMeter).toBe(false);
  });

  test("formaterer elementKey for visning", () => {
    expect(formatInfraspawnKsElementForDisplay("320002")).toBe("320.002");
  });
});
