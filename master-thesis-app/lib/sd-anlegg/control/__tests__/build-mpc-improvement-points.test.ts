import { describe, expect, test } from "bun:test";
import { buildMpcImprovementPoints } from "../build-mpc-improvement-points";
import type { MpcHourTableRow } from "../control-types";

describe("buildMpcImprovementPoints", () => {
  test("returnerer topp 3 timer sortert etter besparelse vs emulert", () => {
    const rows: MpcHourTableRow[] = [
      {
        hour: "2026-06-24T10:00:00.000Z",
        observedCostKr: 5,
        emulatedCostKr: 5,
        mpcCostKr: 4,
        deltaCostKr: -1,
      },
      {
        hour: "2026-06-24T11:00:00.000Z",
        observedCostKr: 8,
        emulatedCostKr: 8,
        mpcCostKr: 5,
        deltaCostKr: -3,
      },
      {
        hour: "2026-06-24T12:00:00.000Z",
        observedCostKr: 3,
        emulatedCostKr: 3,
        mpcCostKr: 2.5,
        deltaCostKr: -0.5,
      },
      {
        hour: "2026-06-24T13:00:00.000Z",
        observedCostKr: 2,
        emulatedCostKr: 2,
        mpcCostKr: 2,
        deltaCostKr: 0,
      },
    ];

    const points = buildMpcImprovementPoints(rows);
    expect(points).toHaveLength(3);
    expect(points[0]?.severity).toBe("opportunity");
    expect(points[0]?.detail).toContain("3");
    expect(points[1]?.detail).toContain("1");
  });

  test("returnerer tom liste uten meningsfulle rader", () => {
    expect(buildMpcImprovementPoints([])).toEqual([]);
  });
});
