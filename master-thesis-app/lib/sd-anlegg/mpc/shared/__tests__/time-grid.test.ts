import { describe, expect, test } from "bun:test";
import { buildMpcTimeGrid } from "../time-grid";

describe("buildMpcTimeGrid", () => {
  test("halvåpent intervall [start, end) — ekskluderer end-grense", () => {
    const grid = buildMpcTimeGrid(
      new Date("2026-06-24T00:00:00.000Z"),
      new Date("2026-06-27T00:00:00.000Z"),
    );
    expect(grid[0]).toBe("2026-06-24T00:00:00Z");
    expect(grid.at(-1)).toBe("2026-06-26T23:45:00Z");
    expect(grid).not.toContain("2026-06-27T00:00:00Z");
  });
});
