import { describe, expect, it } from "bun:test";
import {
  buildControlSignalSeriesMetadata,
  hourlyBucketCoverageRatio,
  shouldUseHourlyBucketCache,
} from "@/lib/sd-anlegg/control/control-signal-series-helpers";

describe("hourlyBucketCoverageRatio", () => {
  it("returnerer lav dekning for sparsom cache", () => {
    expect(hourlyBucketCoverageRatio(2, 168)).toBeCloseTo(2 / 168, 3);
  });

  it("returnerer høy dekning for full cache", () => {
    expect(hourlyBucketCoverageRatio(168, 168)).toBe(1);
  });
});

describe("shouldUseHourlyBucketCache", () => {
  it("avviser sparsom cache ved 7 d lookback", () => {
    expect(shouldUseHourlyBucketCache(2, 168)).toBe(false);
  });

  it("godtar cache med minst 50 % dekning", () => {
    expect(shouldUseHourlyBucketCache(84, 168)).toBe(true);
  });
});

describe("buildControlSignalSeriesMetadata", () => {
  it("beregner forventet antall timer for lang periode", () => {
    const metadata = buildControlSignalSeriesMetadata({
      steps: Array.from({ length: 142 }),
      stepMinutes: 60,
      lookbackHours: 168,
      effectiveHours: 168,
      grain: "15",
      autoHour: true,
    });
    expect(metadata.expectedStepCount).toBe(168);
    expect(metadata.coverageRatio).toBeCloseTo(142 / 168, 3);
    expect(metadata.resolutionNote).toContain("Timevis snitt");
  });
});
