import { describe, expect, it } from "bun:test";
import { buildMpcTimeGrid } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { fillMpcStepGaps } from "@/lib/sd-anlegg/mpc/dataset/fill-step-gaps";

describe("fillMpcStepGaps", () => {
  const grid = buildMpcTimeGrid(
    new Date("2026-06-16T10:00:00.000Z"),
    new Date("2026-06-16T11:15:00.000Z"),
  );

  it("forward-filler korte hull innen maxForwardSteps", () => {
    const series = new Map<string, number>([
      [grid[0]!, 17],
      [grid[4]!, 18],
    ]);
    const { filled, filledStepCount } = fillMpcStepGaps(grid, series, {
      maxForwardSteps: 4,
    });
    expect(filled.get(grid[0]!)).toBe(17);
    expect(filled.get(grid[1]!)).toBe(17);
    expect(filled.get(grid[2]!)).toBe(17);
    expect(filled.get(grid[3]!)).toBe(17);
    expect(filled.get(grid[4]!)).toBe(18);
    expect(filledStepCount).toBe(3);
  });

  it("filler ikke hull utover maxForwardSteps", () => {
    const series = new Map<string, number>([[grid[0]!, 17]]);
    const { filled } = fillMpcStepGaps(grid, series, { maxForwardSteps: 2 });
    expect(filled.get(grid[1]!)).toBe(17);
    expect(filled.get(grid[2]!)).toBe(17);
    expect(filled.has(grid[3]!)).toBe(false);
  });

  it("backward-filler ledende hull fra første måling", () => {
    const series = new Map<string, number>([[grid[3]!, 19]]);
    const { filled } = fillMpcStepGaps(grid, series, {
      maxForwardSteps: 0,
      maxBackwardSteps: 3,
    });
    expect(filled.get(grid[0]!)).toBe(19);
    expect(filled.get(grid[2]!)).toBe(19);
    expect(filled.get(grid[3]!)).toBe(19);
  });
});
