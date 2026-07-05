import { describe, expect, test } from "bun:test";
import { isStyringLiveControlStale } from "@/lib/sd-anlegg/control/styring-live-stale";
import { CONTROL_TICK_STALE_MS } from "@/lib/sd-anlegg/control/control-constants";

describe("isStyringLiveControlStale", () => {
  const now = Date.parse("2026-07-03T15:00:00.000Z");

  test("returnerer true uten forward plan", () => {
    expect(
      isStyringLiveControlStale({
        lastControlTickAt: new Date(now - 5 * 60_000).toISOString(),
        forwardPlanComputedAt: null,
        nowMs: now,
      }),
    ).toBe(true);
  });

  test("returnerer true når plan er eldre enn terskel", () => {
    expect(
      isStyringLiveControlStale({
        lastControlTickAt: new Date(now - 5 * 60_000).toISOString(),
        forwardPlanComputedAt: new Date(
          now - CONTROL_TICK_STALE_MS - 1_000,
        ).toISOString(),
        nowMs: now,
      }),
    ).toBe(true);
  });

  test("returnerer false når tick og plan er ferske", () => {
    expect(
      isStyringLiveControlStale({
        lastControlTickAt: new Date(now - 10 * 60_000).toISOString(),
        forwardPlanComputedAt: new Date(now - 10 * 60_000).toISOString(),
        nowMs: now,
      }),
    ).toBe(false);
  });
});
