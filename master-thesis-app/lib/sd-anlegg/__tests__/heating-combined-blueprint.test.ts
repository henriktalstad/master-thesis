import { describe, expect, test } from "bun:test";
import {
  buildHeatingCombinedPipeChevrons,
  buildHeatingCombinedPipeLabels,
  buildHeatingCombinedPipeSegments,
  buildHeatingCombinedPipeTaps,
  HEATING_COMBINED_PIPE_Y,
  HEATING_COMBINED_SLOT_X,
  HEATING_COMBINED_ZONE_DIVIDER_X,
} from "@/lib/sd-anlegg/heating-combined-blueprint";

describe("heating combined blueprint", () => {
  test("rør-segmenter kobler primær og sekundær ved veksler", () => {
    const segments = buildHeatingCombinedPipeSegments();

    expect(segments.length).toBeGreaterThanOrEqual(4);
    expect(segments.some((s) => s.circuit === "supply" && s.y1 === HEATING_COMBINED_PIPE_Y.supply)).toBe(true);
    expect(segments.some((s) => s.circuit === "return" && s.y1 === HEATING_COMBINED_PIPE_Y.return)).toBe(true);

    const hxBridge = segments.find(
      (s) => s.x1 === HEATING_COMBINED_ZONE_DIVIDER_X && s.x2 === s.x1,
    );
    expect(hxBridge).toBeDefined();
    expect(hxBridge?.y1).toBe(HEATING_COMBINED_PIPE_Y.supply);
    expect(hxBridge?.y2).toBe(HEATING_COMBINED_PIPE_Y.return);
  });

  test("tur-pipe går gjennom sekundær utstyr-posisjoner", () => {
    const supply = buildHeatingCombinedPipeSegments().filter((s) => s.circuit === "supply" && s.y1 === s.y2);
    const secondarySupply = supply.find(
      (s) => s.x1 === HEATING_COMBINED_ZONE_DIVIDER_X && s.x2 > HEATING_COMBINED_SLOT_X.valve,
    );

    expect(secondarySupply).toBeDefined();
  });

  test("chevrons peker i riktig retning per krets", () => {
    const chevrons = buildHeatingCombinedPipeChevrons();

    expect(chevrons.some((c) => c.circuit === "supply" && c.direction === "right")).toBe(true);
    expect(chevrons.some((c) => c.circuit === "return" && c.direction === "left")).toBe(true);
  });

  test("rørtapper kobler utstyr til tur/retur-linjer", () => {
    const taps = buildHeatingCombinedPipeTaps();

    expect(
      taps.some(
        (t) =>
          t.circuit === "supply" &&
          t.x === HEATING_COMBINED_SLOT_X.valve &&
          t.y1 === HEATING_COMBINED_PIPE_Y.supply,
      ),
    ).toBe(true);
    expect(
      taps.some(
        (t) =>
          t.circuit === "return" &&
          t.x === HEATING_COMBINED_SLOT_X.returnTemp &&
          t.y1 === HEATING_COMBINED_PIPE_Y.return,
      ),
    ).toBe(true);
  });

  test("rør-etiketter markerer tur og retur", () => {
    const labels = buildHeatingCombinedPipeLabels();

    expect(labels.map((l) => l.text)).toEqual(["Tur", "Retur"]);
  });
});
