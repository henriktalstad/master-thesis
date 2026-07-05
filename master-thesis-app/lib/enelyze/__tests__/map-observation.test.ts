import { describe, expect, test } from "bun:test";
import {
  dedupeMappedObservations,
  mapEnelyzeObservation,
} from "@/lib/enelyze/map-observation";

describe("mapEnelyzeObservation", () => {
  test("UTC ISO mappes til utcTime-bucket og norsk time", () => {
    const mapped = mapEnelyzeObservation({
      time: "2026-06-24T10:00:00.000Z",
      direction: "OUT",
      method: "M",
      volume_kwh: 12.5,
    });
    expect(mapped).not.toBeNull();
    expect(mapped!.utcTime.toISOString()).toBe("2026-06-24T10:00:00.000Z");
    expect(mapped!.volume_kwh).toBe(12.5);
    expect(mapped!.time.getUTCHours()).toBe(12);
  });

  test("DST vinter — norsk time er +1 UTC", () => {
    const mapped = mapEnelyzeObservation({
      time: "2026-01-15T08:00:00.000Z",
      direction: "OUT",
      method: "M",
      volume_kwh: 1,
    });
    expect(mapped!.time.getUTCHours()).toBe(9);
  });

  test("DST sommer — norsk time er +2 UTC", () => {
    const mapped = mapEnelyzeObservation({
      time: "2026-07-01T08:00:00.000Z",
      direction: "OUT",
      method: "M",
      volume_kwh: 1,
    });
    expect(mapped!.time.getUTCHours()).toBe(10);
  });

  test("ugyldig tid returnerer null", () => {
    expect(
      mapEnelyzeObservation({
        time: "not-a-date",
        direction: "OUT",
        method: "M",
        volume_kwh: 1,
      }),
    ).toBeNull();
  });
});

describe("dedupeMappedObservations", () => {
  test("beholder én rad per utcTime", () => {
    const a = mapEnelyzeObservation({
      time: "2026-06-24T10:00:00.000Z",
      direction: "OUT",
      method: "M",
      volume_kwh: 1,
    })!;
    const b = mapEnelyzeObservation({
      time: "2026-06-24T10:15:00.000Z",
      direction: "OUT",
      method: "M",
      volume_kwh: 2,
    })!;
    const deduped = dedupeMappedObservations([a, b]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]!.volume_kwh).toBe(1);
  });
});
