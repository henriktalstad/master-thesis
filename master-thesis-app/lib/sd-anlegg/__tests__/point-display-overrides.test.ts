import { describe, expect, test } from "bun:test";
import {
  findPointDisplayOverride,
  upsertPointDisplayOverride,
} from "@/lib/sd-anlegg/point-display-overrides";

describe("point-display-overrides", () => {
  test("matcher objectId med og uten punktum", () => {
    const overrides = [
      {
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        label: "Heissjakt bygg B",
      },
    ];

    expect(
      findPointDisplayOverride(overrides, "src-1", "362001RT601_MV")?.label,
    ).toBe("Heissjakt bygg B");
  });

  test("oppdaterer og fjerner override", () => {
    const initial = [
      {
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        label: "Gammel plassering",
      },
    ];

    expect(
      upsertPointDisplayOverride(
        initial,
        "src-1",
        "362.001RT601_MV",
        "Heissjakt bygg B",
      ),
    ).toEqual([
      {
        sourceId: "src-1",
        objectId: "362001RT601_MV",
        label: "Heissjakt bygg B",
      },
    ]);

    expect(
      upsertPointDisplayOverride(initial, "src-1", "362.001RT601_MV", ""),
    ).toEqual([]);
  });
});
