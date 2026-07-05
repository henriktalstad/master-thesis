import { describe, expect, test } from "bun:test";
import {
  aggregateBacnetRowsTo15m,
  aggregateBacnetRowsToDaily,
  aggregateBacnetRowsToHourly,
  rollupStoredRowsToDaily,
  rollupStoredRowsToHourly,
  truncateToUtc15m,
  truncateToUtcDay,
  truncateToUtcHour,
} from "@/lib/infraspawn/bucket-aggregate";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";

function row(
  objectId: string,
  iso: string,
  value: number | null,
): InfraspawnBacnetRow {
  const sampledAt = new Date(iso);
  return {
    objectId,
    sampledAt,
    valueNum: value,
    quality: "good",
    objectName: null,
    description: null,
    unit: "°C",
    raw: {},
  };
}

describe("truncateToUtc15m", () => {
  test("runder ned til 15-minuttersgrense i UTC", () => {
    const d = truncateToUtc15m(new Date("2026-06-07T16:42:33.123Z"));
    expect(d.toISOString()).toBe("2026-06-07T16:30:00.000Z");
  });
});

describe("truncateToUtcHour", () => {
  test("runder ned til timegrense i UTC", () => {
    const d = truncateToUtcHour(new Date("2026-06-07T16:42:33.123Z"));
    expect(d.toISOString()).toBe("2026-06-07T16:00:00.000Z");
  });
});

describe("truncateToUtcDay", () => {
  test("runder ned til midnatt UTC", () => {
    const d = truncateToUtcDay(new Date("2026-06-07T16:42:33.123Z"));
    expect(d.toISOString()).toBe("2026-06-07T00:00:00.000Z");
  });
});

describe("aggregateBacnetRowsTo15m", () => {
  test("beholder siste verdi per objectId per 15m-bucket", () => {
    const buckets = aggregateBacnetRowsTo15m([
      row("a", "2026-06-07T16:05:00.000Z", 1),
      row("a", "2026-06-07T16:12:00.000Z", 2),
      row("a", "2026-06-07T16:20:00.000Z", 3),
      row("b", "2026-06-07T16:10:00.000Z", 9),
    ]);
    expect(buckets).toHaveLength(3);
    const aFirst = buckets.find(
      (r) =>
        r.objectId === "a" &&
        r.sampledAt.toISOString() === "2026-06-07T16:00:00.000Z",
    );
    expect(aFirst?.valueNum).toBe(2);
    expect(aFirst?.sampleCount).toBe(2);
    const aSecond = buckets.find(
      (r) =>
        r.objectId === "a" &&
        r.sampledAt.toISOString() === "2026-06-07T16:15:00.000Z",
    );
    expect(aSecond?.valueNum).toBe(3);
  });

  test("teller samples i bucket uten å overskrive siste verdi", () => {
    const buckets = aggregateBacnetRowsTo15m([
      row("a", "2026-06-07T16:01:00.000Z", 10),
      row("a", "2026-06-07T16:02:00.000Z", 20),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.valueNum).toBe(20);
    expect(buckets[0]?.sampleCount).toBe(2);
  });
});

describe("aggregateBacnetRowsToHourly", () => {
  test("beholder siste verdi per objectId per time", () => {
    const hourly = aggregateBacnetRowsToHourly([
      row("a", "2026-06-07T16:05:00.000Z", 1),
      row("a", "2026-06-07T16:55:00.000Z", 2),
      row("b", "2026-06-07T16:10:00.000Z", 9),
    ]);
    expect(hourly).toHaveLength(2);
    const a = hourly.find((r) => r.objectId === "a");
    expect(a?.valueNum).toBe(2);
    expect(a?.sampledAt.toISOString()).toBe("2026-06-07T16:00:00.000Z");
  });
});

describe("aggregateBacnetRowsToDaily", () => {
  test("beholder siste verdi per dag", () => {
    const daily = aggregateBacnetRowsToDaily([
      row("a", "2026-06-07T08:00:00.000Z", 1),
      row("a", "2026-06-07T20:00:00.000Z", 2),
      row("a", "2026-06-08T10:00:00.000Z", 3),
    ]);
    expect(daily).toHaveLength(2);
    expect(daily[0]?.valueNum).toBe(2);
    expect(daily[0]?.sampledAt.toISOString()).toBe("2026-06-07T00:00:00.000Z");
  });
});

describe("rollupStoredRowsToHourly", () => {
  test("slår sammen 15m-rader til én time med siste verdi", () => {
    const hourly = rollupStoredRowsToHourly([
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T16:05:00.000Z"),
        valueNum: 1,
        quality: "good",
        sampleCount: 3,
      },
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T16:40:00.000Z"),
        valueNum: 2,
        quality: "good",
        sampleCount: 2,
      },
    ]);

    expect(hourly).toHaveLength(1);
    expect(hourly[0]?.valueNum).toBe(2);
    expect(hourly[0]?.sampledAt.toISOString()).toBe("2026-06-07T16:00:00.000Z");
    expect(hourly[0]?.sampleCount).toBe(5);
  });

  test("batch-grense: to batches gir samme time-bucket", () => {
    const batch1 = rollupStoredRowsToHourly([
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T16:05:00.000Z"),
        valueNum: 1,
        quality: null,
        sampleCount: 1,
      },
    ]);
    const batch2 = rollupStoredRowsToHourly([
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T16:50:00.000Z"),
        valueNum: 9,
        quality: null,
        sampleCount: 1,
      },
    ]);
    const merged = rollupStoredRowsToHourly([
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T16:05:00.000Z"),
        valueNum: 1,
        quality: null,
        sampleCount: 1,
      },
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T16:50:00.000Z"),
        valueNum: 9,
        quality: null,
        sampleCount: 1,
      },
    ]);

    expect(batch1[0]?.sampledAt.toISOString()).toBe(
      batch2[0]?.sampledAt.toISOString(),
    );
    expect(merged[0]?.valueNum).toBe(9);
  });
});

describe("rollupStoredRowsToDaily", () => {
  test("cursor-simulering: to batches med hour-rader gir én dag", () => {
    const batch1 = rollupStoredRowsToDaily([
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T08:00:00.000Z"),
        valueNum: 1,
        quality: null,
        sampleCount: 4,
      },
    ]);
    const batch2 = rollupStoredRowsToDaily([
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T20:00:00.000Z"),
        valueNum: 5,
        quality: null,
        sampleCount: 4,
      },
    ]);
    const full = rollupStoredRowsToDaily([
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T08:00:00.000Z"),
        valueNum: 1,
        quality: null,
        sampleCount: 4,
      },
      {
        objectId: "a",
        sampledAt: new Date("2026-06-07T20:00:00.000Z"),
        valueNum: 5,
        quality: null,
        sampleCount: 4,
      },
    ]);

    expect(batch1).toHaveLength(1);
    expect(batch2).toHaveLength(1);
    expect(full).toHaveLength(1);
    expect(full[0]?.valueNum).toBe(5);
    expect(full[0]?.sampleCount).toBe(8);
  });
});
