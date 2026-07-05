import { describe, expect, test } from "bun:test";
import {
  inferVentilationUnitKeyFromEquipmentDigits,
  inferVentilationUnitKeyFromEquipmentPoint,
  inferVentilationUnitKeyFromBacnetPoint,
  inferVentilationBootstrapUnitKey,
  extractVentilationUnitKeyFromSourceLabel,
} from "@/lib/sd-anlegg/infer-ventilation-unit-from-equipment";

describe("inferVentilationUnitKeyFromEquipmentDigits", () => {
  test("mapper utstyrsbånd til ventilasjonsanlegg", () => {
    expect(inferVentilationUnitKeyFromEquipmentDigits("401")).toBe("360101");
    expect(inferVentilationUnitKeyFromEquipmentDigits("501")).toBe("360102");
    expect(inferVentilationUnitKeyFromEquipmentDigits("601")).toBe("362001");
  });
});

describe("inferVentilationUnitKeyFromEquipmentPoint", () => {
  test("trekker ut 360102 fra JV501", () => {
    expect(
      inferVentilationUnitKeyFromEquipmentPoint({
        objectName: "JV501",
        description: "Tilluftsvifte",
      }),
    ).toEqual({ unitKey: "360102", method: "equipment_band" });
  });

  test("310.001SB501 returnerer null (tappevann, ikke AHU-bånd)", () => {
    expect(
      inferVentilationUnitKeyFromEquipmentPoint({
        objectName: "310.001SB501_C",
        description: "Ventilstilling tappevann",
      }),
    ).toBeNull();
  });
});

describe("inferVentilationUnitKeyFromBacnetPoint", () => {
  test("bruker kildelabel for AI_FilterGuard", () => {
    expect(
      inferVentilationUnitKeyFromBacnetPoint(
        {
          objectId: "AV-40323",
          objectName: "AI_FilterGuard1",
          description: "Ana. filter 1 value",
          unit: "pascals",
        },
        { sourceLabel: "360.102 Næringsdel blokk A" },
      ),
    ).toEqual({ unitKey: "360102", method: "source_label" });
  });

  test("returnerer null for SAF-signaler uten label eller dominant enhet", () => {
    expect(
      inferVentilationUnitKeyFromBacnetPoint({
        objectId: "AI-1",
        objectName: "AI_SAFFlow",
        description: "Supply air flow",
        unit: "cubic-meters-per-hour",
      }),
    ).toBeNull();
  });

  test("bruker dominant enhet for flate BACnet-signaler", () => {
    expect(
      inferVentilationUnitKeyFromBacnetPoint(
        {
          objectId: "AI-1",
          objectName: "AI_SAFFlow",
          description: "Supply air flow",
          unit: "cubic-meters-per-hour",
        },
        { dominantVentilationUnitKey: "360101" },
      ),
    ).toEqual({ unitKey: "360101", method: "bacnet_role" });
  });
});

describe("inferVentilationBootstrapUnitKey", () => {
  test("returnerer 360102 når 320003 og avtrekkssignaler finnes uten 360 i label", () => {
    expect(
      inferVentilationBootstrapUnitKey({
        keyedUnitKeys: ["320001", "320003"],
        orphanPoints: [
          {
            objectId: "1",
            objectName: "AI_SAFFLOW",
            description: "Supply air flow",
            unit: "cubic-meters-per-hour",
          },
          {
            objectId: "2",
            objectName: "AI_EAFFLOW",
            description: "Extract air flow",
            unit: "cubic-meters-per-hour",
          },
          {
            objectId: "3",
            objectName: "Efficiency",
            description: "Virkningsgrad",
            unit: "percent",
          },
        ],
      }),
    ).toBe("360102");
  });

  test("returnerer 360101 når bare 320002 og tilluftssignaler finnes", () => {
    expect(
      inferVentilationBootstrapUnitKey({
        keyedUnitKeys: ["320002"],
        orphanPoints: [
          {
            objectId: "1",
            objectName: "AI_SAFFLOW",
            description: "Supply air flow",
            unit: "cubic-meters-per-hour",
          },
          {
            objectId: "2",
            objectName: "AI_SupplyAirTemp",
            description: "Temp tilluft",
            unit: "degrees-celsius",
          },
        ],
      }),
    ).toBe("360101");
  });

  test("velger 360102 ved både 320002 og 320003 når avtrekk dominerer", () => {
    expect(
      inferVentilationBootstrapUnitKey({
        keyedUnitKeys: ["320002", "320003"],
        orphanPoints: [
          { objectId: "1", objectName: "AI_SAFFLOW" },
          { objectId: "2", objectName: "AI_EAFFLOW" },
          { objectId: "3", objectName: "AI_ExtractAirTemp" },
        ],
      }),
    ).toBe("360102");
  });

  test("returnerer null uten varme-søsken (kun 320001)", () => {
    expect(
      inferVentilationBootstrapUnitKey({
        keyedUnitKeys: ["320001"],
        orphanPoints: [
          { objectId: "1", objectName: "AI_SAFFLOW" },
          { objectId: "2", objectName: "AI_EAFFLOW" },
        ],
      }),
    ).toBeNull();
  });
});

describe("extractVentilationUnitKeyFromSourceLabel", () => {
  test("henter 360102 fra kildelabel", () => {
    expect(
      extractVentilationUnitKeyFromSourceLabel("360.102 Næringsdel blokk A"),
    ).toBe("360102");
  });
});
