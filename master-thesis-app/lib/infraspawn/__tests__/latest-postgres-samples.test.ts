import { describe, expect, test } from "bun:test";
import {
  INFRASPAWN_RESOLUTION_15M,
  INFRASPAWN_RESOLUTION_DAY,
  INFRASPAWN_RESOLUTION_HOUR,
  infraspawnSampleResolutionRank,
} from "@/lib/infraspawn/resolution";

describe("infraspawnSampleResolutionRank", () => {
  test("15m er finest, deretter hour og day", () => {
    expect(infraspawnSampleResolutionRank(INFRASPAWN_RESOLUTION_15M)).toBe(0);
    expect(infraspawnSampleResolutionRank(INFRASPAWN_RESOLUTION_HOUR)).toBe(1);
    expect(infraspawnSampleResolutionRank(INFRASPAWN_RESOLUTION_DAY)).toBe(2);
    expect(infraspawnSampleResolutionRank("unknown")).toBe(3);
  });
});

describe("loadLatestPostgresSamplesByPoint ordering", () => {
  test("velger finest oppløsning ved lik sampledAt", () => {
    const rows = [
      {
        resolution: INFRASPAWN_RESOLUTION_HOUR,
        sampledAt: new Date("2026-06-20T10:00:00Z"),
        valueNum: 1,
      },
      {
        resolution: INFRASPAWN_RESOLUTION_15M,
        sampledAt: new Date("2026-06-20T10:00:00Z"),
        valueNum: 2,
      },
    ];

    const best = [...rows].sort((a, b) => {
      const rank =
        infraspawnSampleResolutionRank(a.resolution) -
        infraspawnSampleResolutionRank(b.resolution);
      if (rank !== 0) return rank;
      return b.sampledAt.getTime() - a.sampledAt.getTime();
    })[0];

    expect(best.valueNum).toBe(2);
  });
});
