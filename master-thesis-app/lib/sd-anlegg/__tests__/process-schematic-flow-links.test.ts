import { describe, expect, test } from "bun:test";
import { AHU_BLUEPRINT_PROCESS_SLOTS } from "@/lib/sd-anlegg/ahu-blueprint";
import {
  buildProcessFlowLinkSegments,
  buildProcessFlowChevrons,
  PROCESS_EXHAUST_DUCT_CENTER_Y,
  PROCESS_HX_CENTER_X,
} from "@/lib/sd-anlegg/process-schematic-flow-links";

describe("process-schematic-flow-links", () => {
  test("genererer koblinger for alle prosess-slotter unntatt VGX", () => {
    const links = buildProcessFlowLinkSegments();
    const linkedIds = new Set(links.map((link) => link.slotId));
    const expected = AHU_BLUEPRINT_PROCESS_SLOTS.filter(
      (slot) => slot.slotId !== "heat_recovery.unit",
    ).map((slot) => slot.slotId);

    for (const slotId of expected) {
      expect(linkedIds.has(slotId)).toBe(true);
    }
  });

  test("vifte og spjeld har in-duct kobling", () => {
    const links = buildProcessFlowLinkSegments();
    expect(links.find((link) => link.slotId === "supply.fan")?.kind).toBe("in-duct");
    expect(links.find((link) => link.slotId === "exhaust.damper")?.kind).toBe("in-duct");
  });

  test("temperatur har probe inn i kanal", () => {
    const links = buildProcessFlowLinkSegments();
    expect(links.find((link) => link.slotId === "supply.temp_out")?.kind).toBe("probe");
  });

  test("flytpiler går begge retninger", () => {
    const chevrons = buildProcessFlowChevrons();
    expect(chevrons.some((c) => c.direction === "left" && c.cy === PROCESS_EXHAUST_DUCT_CENTER_Y)).toBe(
      true,
    );
    expect(chevrons.some((c) => c.direction === "right")).toBe(true);
  });

  test("LX471 er sentrert på VGX-kolonne", () => {
    const hx = AHU_BLUEPRINT_PROCESS_SLOTS.find((slot) => slot.slotId === "heat_recovery.unit");
    expect(hx?.x).toBeCloseTo((PROCESS_HX_CENTER_X / 1000) * 100, 0);
  });
});
