import { describe, expect, test } from "bun:test";
import { resolveSyncWatermarkAfterRun } from "@/lib/infraspawn/resolve-sync-watermark";

const OVERLAP_MS = 30_000;

describe("resolveSyncWatermarkAfterRun", () => {
  test("fullført tail hever vannmerke minst til recentStart", () => {
    const watermarkBase = new Date("2026-06-29T11:19:36.415Z");
    const recentStart = new Date("2026-06-29T13:00:00.000Z");
    const maxSampledAt = new Date("2026-06-29T18:45:00.000Z");

    const next = resolveSyncWatermarkAfterRun({
      watermarkBase,
      recentStart,
      tailReachedSyncUntil: true,
      tailEndCursor: new Date("2026-06-29T19:00:00.000Z"),
      maxSampledAt,
      overlapMs: OVERLAP_MS,
    });

    expect(next.toISOString()).toBe(maxSampledAt.toISOString());
  });

  test("ufullført tail bruker tail-fremdrift", () => {
    const watermarkBase = new Date("2026-06-29T11:19:36.415Z");
    const recentStart = new Date("2026-06-29T13:00:00.000Z");
    const tailEndCursor = new Date("2026-06-29T14:30:00.000Z");

    const next = resolveSyncWatermarkAfterRun({
      watermarkBase,
      recentStart,
      tailReachedSyncUntil: false,
      tailEndCursor,
      maxSampledAt: new Date("2026-06-29T14:28:00.000Z"),
      overlapMs: OVERLAP_MS,
    });

    expect(next.getTime()).toBeGreaterThan(watermarkBase.getTime());
    expect(next.toISOString()).toBe("2026-06-29T14:29:30.000Z");
  });
});
