import { describe, expect, it } from "bun:test";
import {
  classifyOverviewMeasurementFreshness,
  latestOverviewKeyPointSampleIso,
  resolveScopedLivePointsForFreshness,
} from "../overview-key-point-freshness";

describe("latestOverviewKeyPointSampleIso", () => {
  it("velger nyeste sampledAt", () => {
    expect(
      latestOverviewKeyPointSampleIso([
        { point: { lastSampledAt: "2026-06-20T08:00:00.000Z" } },
        { point: { lastSampledAt: "2026-06-20T10:00:00.000Z" } },
      ]),
    ).toBe("2026-06-20T10:00:00.000Z");
  });
});

describe("classifyOverviewMeasurementFreshness", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");

  it("regner ferske målinger som fresh", () => {
    expect(
      classifyOverviewMeasurementFreshness("2026-06-20T11:50:00.000Z", now),
    ).toBe("fresh");
  });

  it("regner eldre målinger som aging", () => {
    expect(
      classifyOverviewMeasurementFreshness("2026-06-20T10:00:00.000Z", now),
    ).toBe("aging");
  });

  it("regner svært gamle målinger som stale", () => {
    expect(
      classifyOverviewMeasurementFreshness("2026-06-19T12:00:00.000Z", now),
    ).toBe("stale");
  });
});

describe("resolveScopedLivePointsForFreshness", () => {
  const points = [
    { objectId: "a", lastSampledAt: "2026-06-20T10:00:00.000Z", objectName: "RT401" },
    { objectId: "b", lastSampledAt: "2026-06-20T11:00:00.000Z", objectName: "RT501" },
  ] as const;

  it("filtrerer på anleggsenhet objectIds", () => {
    const scoped = resolveScopedLivePointsForFreshness(points, {
      unitObjectIds: ["a"],
    });
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.objectId).toBe("a");
  });
});
