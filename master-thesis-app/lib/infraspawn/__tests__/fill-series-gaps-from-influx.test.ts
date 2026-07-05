import { describe, expect, test } from "bun:test";
import { SERIES_GAP_BUCKET_MS } from "@/lib/infraspawn/detect-series-gaps";
import { collectPerObjectInfluxGaps } from "@/lib/infraspawn/series-gap-plan";

describe("collectPerObjectInfluxGaps", () => {
  test("finner hull per objectId, ikke bare globalt", () => {
    const sinceMs = 0;
    const untilMs = 20 * SERIES_GAP_BUCKET_MS;
    const samplesByObjectId = new Map([
      [
        "full",
        Array.from({ length: 20 }, (_, index) => ({
          t: new Date(index * SERIES_GAP_BUCKET_MS).toISOString(),
          value: 1,
        })),
      ],
      [
        "sparse",
        [
          { t: new Date(0).toISOString(), value: 1 },
          { t: new Date(10 * SERIES_GAP_BUCKET_MS).toISOString(), value: 2 },
        ],
      ],
    ]);

    const gaps = collectPerObjectInfluxGaps({
      samplesByObjectId,
      objectIds: ["full", "sparse"],
      sinceMs,
      untilMs,
      minGapBuckets: 4,
    });

    expect(gaps.has("full")).toBe(false);
    expect(gaps.get("sparse")?.length).toBeGreaterThan(0);
  });
});
