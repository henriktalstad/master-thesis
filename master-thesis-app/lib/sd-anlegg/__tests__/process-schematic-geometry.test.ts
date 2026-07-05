import { describe, expect, test } from "bun:test";
import { AHU_BLUEPRINT_PROCESS_SLOTS } from "@/lib/sd-anlegg/ahu-blueprint";
import {
  PROCESS_DUCT_GEOMETRY,
  PROCESS_FILTER_SLOT_X,
  PROCESS_SCHEMATIC_VIEWBOX,
  processSchematicPercentX,
  resolveBlueprintSlotLayoutX,
} from "@/lib/sd-anlegg/process-schematic-geometry";

describe("process-schematic-geometry", () => {
  test("filter-slotter deler x med filterhatch", () => {
    const filterSvgX =
      PROCESS_DUCT_GEOMETRY.filterX + PROCESS_DUCT_GEOMETRY.filterWidth / 2;
    expect(PROCESS_FILTER_SLOT_X).toBeCloseTo(
      processSchematicPercentX(filterSvgX),
      1,
    );
    const filters = AHU_BLUEPRINT_PROCESS_SLOTS.filter((slot) => slot.role === "filter");
    expect(filters.every((slot) => slot.x === PROCESS_FILTER_SLOT_X)).toBe(true);
  });

  test("varmerør-ankre er prosent av trimmet viewBox", () => {
    expect(processSchematicPercentX(584)).toBeCloseTo(58.4, 1);
    expect(processSchematicPercentX(756)).toBeCloseTo(75.6, 1);
  });

  test("resolveBlueprintSlotLayoutX skiller layout-% og canvas-%", () => {
    expect(
      resolveBlueprintSlotLayoutX({
        slotId: "heating.valve",
        lane: "heating",
        role: "valve",
        x: 75.6,
      }),
    ).toBe(75.6);
    expect(
      resolveBlueprintSlotLayoutX({
        slotId: "supply.fan",
        lane: "supply",
        role: "fan",
        x: 86,
      }),
    ).toBeCloseTo(86, 0);
  });

  test("viewBox dekker hele kanalbredden inkl. utløp", () => {
    const ductRight =
      PROCESS_DUCT_GEOMETRY.left + PROCESS_DUCT_GEOMETRY.width + 10;
    const viewBoxRight =
      PROCESS_SCHEMATIC_VIEWBOX.x + PROCESS_SCHEMATIC_VIEWBOX.width;

    expect(PROCESS_SCHEMATIC_VIEWBOX.x).toBeLessThanOrEqual(
      PROCESS_DUCT_GEOMETRY.left,
    );
    expect(viewBoxRight).toBeGreaterThanOrEqual(ductRight);
  });

  test("viewBox har minimal vertikal dødflate og plass under tilluft", () => {
    const supplyBottom =
      PROCESS_DUCT_GEOMETRY.supplyY + PROCESS_DUCT_GEOMETRY.height;
    const viewBoxBottom =
      PROCESS_SCHEMATIC_VIEWBOX.y + PROCESS_SCHEMATIC_VIEWBOX.height;

    expect(PROCESS_SCHEMATIC_VIEWBOX.y).toBeLessThanOrEqual(
      PROCESS_DUCT_GEOMETRY.topY - 24,
    );
    expect(viewBoxBottom - supplyBottom).toBeGreaterThanOrEqual(20);
    expect(viewBoxBottom - supplyBottom).toBeLessThanOrEqual(40);
  });
});
