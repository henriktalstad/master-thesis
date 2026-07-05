import { describe, expect, test } from "bun:test";
import {
  bucketInfraspawnSeriesSamples,
  mergeInfraspawnSeriesSamples,
} from "@/lib/infraspawn/series-samples";

describe("bucketInfraspawnSeriesSamples", () => {
  test("slår sammen rå sanntid til én per minutt (seneste vinner)", () => {
    const bucketed = bucketInfraspawnSeriesSamples(
      [
        { t: "2026-06-07T16:07:10.000Z", value: 1 },
        { t: "2026-06-07T16:07:40.000Z", value: 2 },
        { t: "2026-06-07T16:08:05.000Z", value: 3 },
      ],
      60_000,
    );
    expect(bucketed).toEqual([
      { t: "2026-06-07T16:07:00.000Z", value: 2 },
      { t: "2026-06-07T16:08:00.000Z", value: 3 },
    ]);
  });
});

describe("mergeInfraspawnSeriesSamples", () => {
  test("siste lag vinner ved lik tid", () => {
    const merged = mergeInfraspawnSeriesSamples(
      [{ t: "2026-06-07T10:00:00.000Z", value: 1 }],
      [{ t: "2026-06-07T10:00:00.000Z", value: 2 }],
    );
    expect(merged).toEqual([
      { t: "2026-06-07T10:00:00.000Z", value: 2 },
    ]);
  });
});
