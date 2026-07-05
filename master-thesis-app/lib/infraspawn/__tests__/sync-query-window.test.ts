import { describe, expect, it } from "bun:test";
import {
  advanceSyncAfterEmptyWindow,
  advanceSyncAfterPage,
  computeSyncWindowUntil,
  isInfluxFileLimitError,
  INFRASPAWN_SYNC_MIN_QUERY_WINDOW_MS,
  INFRASPAWN_SYNC_QUERY_WINDOW_MS,
  shrinkSyncQueryWindowMs,
} from "@/lib/infraspawn/sync-query-window";

const HOUR_MS = 60 * 60 * 1000;

function d(iso: string): Date {
  return new Date(iso);
}

describe("isInfluxFileLimitError", () => {
  it("gjenkjenner Parquet file limit-feil", () => {
    expect(
      isInfluxFileLimitError(
        "Query would scan 432 Parquet files, exceeding the file limit",
      ),
    ).toBe(true);
  });
});

describe("shrinkSyncQueryWindowMs", () => {
  it("halverer vindu ned til minimum", () => {
    expect(shrinkSyncQueryWindowMs(HOUR_MS)).toBe(30 * 60 * 1000);
    expect(shrinkSyncQueryWindowMs(10 * 60 * 1000)).toBe(5 * 60 * 1000);
    expect(shrinkSyncQueryWindowMs(INFRASPAWN_SYNC_MIN_QUERY_WINDOW_MS)).toBeNull();
  });
});

describe("computeSyncWindowUntil", () => {
  it("begrenser til syncUntil", () => {
    const cursor = d("2026-01-01T10:00:00Z");
    const syncUntil = d("2026-01-01T10:30:00Z");
    expect(
      computeSyncWindowUntil({
        cursor,
        syncUntil,
        windowMs: HOUR_MS,
      }).toISOString(),
    ).toBe("2026-01-01T10:30:00.000Z");
  });
});

describe("advanceSyncAfterEmptyWindow", () => {
  it("hopper til neste vindu", () => {
    const result = advanceSyncAfterEmptyWindow({
      windowUntil: d("2026-01-01T11:00:00Z"),
      syncUntil: d("2026-01-01T12:00:00Z"),
      windowMs: HOUR_MS,
    });
    expect(result.cursor.toISOString()).toBe("2026-01-01T11:00:00.000Z");
    expect(result.windowUntil.toISOString()).toBe("2026-01-01T12:00:00.000Z");
    expect(result.done).toBe(false);
  });
});

describe("advanceSyncAfterPage", () => {
  const syncUntil = d("2026-01-01T20:00:00Z");
  const windowUntil = d("2026-01-01T11:00:00Z");
  const overlapMs = 30_000;

  it("paginerer innenfor vindu ved full side", () => {
    const result = advanceSyncAfterPage({
      cursor: d("2026-01-01T10:00:00Z"),
      windowUntil,
      syncUntil,
      pageMax: d("2026-01-01T10:45:00Z"),
      rowCount: 25_000,
      maxRowsPerRun: 25_000,
      overlapMs,
      windowMs: HOUR_MS,
    });
    expect(result.done).toBe(false);
    expect(result.windowUntil).toEqual(windowUntil);
    expect(result.cursor.toISOString()).toBe("2026-01-01T10:44:30.000Z");
  });

  it("går til neste vindu når data når vindusende", () => {
    const result = advanceSyncAfterPage({
      cursor: d("2026-01-01T10:00:00Z"),
      windowUntil,
      syncUntil,
      pageMax: d("2026-01-01T11:00:00Z"),
      rowCount: 100,
      maxRowsPerRun: 25_000,
      overlapMs,
      windowMs: HOUR_MS,
    });
    expect(result.done).toBe(false);
    expect(result.cursor.toISOString()).toBe("2026-01-01T11:00:00.000Z");
    expect(result.windowUntil.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  it("stopper når data slutter før vindusende", () => {
    const result = advanceSyncAfterPage({
      cursor: d("2026-01-01T10:00:00Z"),
      windowUntil,
      syncUntil,
      pageMax: d("2026-01-01T10:20:00Z"),
      rowCount: 50,
      maxRowsPerRun: 25_000,
      overlapMs,
      windowMs: HOUR_MS,
    });
    expect(result.done).toBe(true);
    expect(result.cursor.toISOString()).toBe("2026-01-01T10:19:30.000Z");
  });
});

describe("INFRASPAWN_SYNC_QUERY_WINDOW_MS", () => {
  it("er ett timevindu", () => {
    expect(INFRASPAWN_SYNC_QUERY_WINDOW_MS).toBe(HOUR_MS);
  });
});
