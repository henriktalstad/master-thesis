import { describe, expect, test } from "bun:test";
import { parseInfraspawnPointIdentity } from "@/lib/infraspawn/parse-infraspawn-point-identity";

describe("parseInfraspawnPointIdentity", () => {
  test("er canonical entry for kompakt utstyrstag", () => {
    const identity = parseInfraspawnPointIdentity({
      objectName: "320.002RT402_MV",
      description: "Temperatur turvann",
    });

    expect(identity).toMatchObject({
      elementKey: "320002",
      equipmentCode: "RT402",
      signalSuffix: "MV",
      matchKind: "equipment-compact",
    });
  });

  test("parser PA-format uten utstyrskode", () => {
    const identity = parseInfraspawnPointIdentity({
      objectName: "=3200.001.04",
    });

    expect(identity).toMatchObject({
      elementKey: "3200001",
      equipmentCode: null,
      isEnergyMeter: false,
      matchKind: "pa-normal",
    });
  });

  test("bruker sourceLabel som kandidat", () => {
    const identity = parseInfraspawnPointIdentity({
      sourceLabel: "320.001-3 Fjernvarme",
    });

    expect(identity?.elementKey).toBe("320001");
    expect(identity?.equipmentCode).toBeNull();
  });
});
