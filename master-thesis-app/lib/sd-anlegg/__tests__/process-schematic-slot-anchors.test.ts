import { describe, expect, test } from "bun:test";
import { AHU_BLUEPRINT_PROCESS_SLOTS } from "@/lib/sd-anlegg/ahu-blueprint";
import {
  PROCESS_HEATING_SLOT_ANCHORS,
  PROCESS_SCHEMATIC_VIEWBOX,
  processSchematicPercentY,
} from "@/lib/sd-anlegg/process-schematic-geometry";
import {
  resolveProcessEquipmentAnchorY,
  resolveProcessSymbolAnchorShiftY,
  resolveProcessSlotAnchorPercentY,
} from "@/lib/sd-anlegg/process-schematic-slot-anchors";

describe("process-schematic-slot-anchors", () => {
  test("varmeslinge-slotter bruker dedikerte rør-ankre", () => {
    expect(
      resolveProcessEquipmentAnchorY({
        slotId: "heating.pump",
        lane: "heating",
        role: "pump",
        blueprintY: 50,
      }),
    ).toBe(PROCESS_HEATING_SLOT_ANCHORS.pump.y);

    expect(
      resolveProcessEquipmentAnchorY({
        slotId: "heating.valve",
        lane: "heating",
        role: "valve",
        blueprintY: 50,
      }),
    ).toBe(PROCESS_HEATING_SLOT_ANCHORS.valve.y);
  });

  test("symbol-shift er lane-spesifikk for varmeslinge", () => {
    expect(resolveProcessSymbolAnchorShiftY("pump", "heating")).toBe(8);
    expect(resolveProcessSymbolAnchorShiftY("pump")).toBe(50);
    expect(resolveProcessSymbolAnchorShiftY("temp", "heating")).toBe(10);
    expect(resolveProcessSymbolAnchorShiftY("temp", "exhaust")).toBe(6);
  });

  test("prosess-slotter har stigende x langs hver kanal", () => {
    const toLayoutX = (blueprintX: number) =>
      ((blueprintX / 100) * 1000 - PROCESS_SCHEMATIC_VIEWBOX.x) /
      PROCESS_SCHEMATIC_VIEWBOX.width;

    const exhaustXs = AHU_BLUEPRINT_PROCESS_SLOTS.filter((s) => s.lane === "exhaust")
      .map((s) => toLayoutX(s.x))
      .filter((x) => x < 0.82);
    const supplyXs = AHU_BLUEPRINT_PROCESS_SLOTS.filter((s) => s.lane === "supply").map(
      (s) => toLayoutX(s.x),
    );

    for (let i = 1; i < exhaustXs.length; i++) {
      expect(exhaustXs[i]!).toBeGreaterThan(exhaustXs[i - 1]!);
    }
    for (let i = 1; i < supplyXs.length; i++) {
      expect(supplyXs[i]!).toBeGreaterThan(supplyXs[i - 1]!);
    }
  });

  test("kanal-ankre matcher prosent av duct-geometri", () => {
    expect(resolveProcessSlotAnchorPercentY("exhaust", "temp")).toBeCloseTo(
      processSchematicPercentY(34),
      1,
    );
    expect(resolveProcessSlotAnchorPercentY("supply", "temp")).toBeCloseTo(
      processSchematicPercentY(410),
      1,
    );
    expect(resolveProcessSlotAnchorPercentY("exhaust", "fan")).toBeCloseTo(
      processSchematicPercentY(100),
      1,
    );
  });

  test("avtrekk-temp og filter har luft mellom x-ankre", () => {
    const temp = AHU_BLUEPRINT_PROCESS_SLOTS.find((s) => s.slotId === "exhaust.temp");
    const filter = AHU_BLUEPRINT_PROCESS_SLOTS.find((s) => s.slotId === "exhaust.filter");
    expect(temp).toBeDefined();
    expect(filter).toBeDefined();
    expect(filter!.x - temp!.x).toBeGreaterThan(5);
  });
});
