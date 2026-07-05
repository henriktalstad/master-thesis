import { describe, expect, it } from "bun:test";
import { buildMpcTimeGrid } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { fillCoordinatedMpcChannelGaps } from "@/lib/sd-anlegg/mpc/dataset/fill-coordinated-channels";

describe("fillCoordinatedMpcChannelGaps", () => {
  const grid = buildMpcTimeGrid(
    new Date("2026-06-16T10:00:00.000Z"),
    new Date("2026-06-16T11:15:00.000Z"),
  );
  const keys = ["a", "b"] as const;

  it("fyller kun når alle kanaler kan fylles sammen", () => {
    const channels = new Map<string, ReadonlyMap<string, number>>([
      ["a", new Map([[grid[0]!, 17], [grid[4]!, 18]])],
      ["b", new Map([[grid[0]!, 30], [grid[4]!, 35]])],
    ]);

    const filled = fillCoordinatedMpcChannelGaps(grid, channels, keys, {
      maxForwardSteps: 4,
    });

    expect(filled.get("a")?.get(grid[1]!)).toBe(17);
    expect(filled.get("b")?.get(grid[1]!)).toBe(30);
    expect(filled.get("a")?.has(grid[3]!)).toBe(true);
    expect(filled.get("b")?.has(grid[3]!)).toBe(true);
  });

  it("fyller ikke når én kanal mangler anker for koordinert fill", () => {
    const channels = new Map<string, ReadonlyMap<string, number>>([
      ["a", new Map([[grid[0]!, 17], [grid[4]!, 18]])],
      ["b", new Map([[grid[4]!, 35]])],
    ]);

    const filled = fillCoordinatedMpcChannelGaps(grid, channels, keys, {
      maxForwardSteps: 4,
    });

    expect(filled.get("a")?.has(grid[1]!)).toBe(false);
    expect(filled.get("b")?.has(grid[1]!)).toBe(false);
  });
});
