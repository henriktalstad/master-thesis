import { describe, expect, it } from "bun:test";
import { resolveOsloAlarmDayWindow } from "../oslo-alarm-day-window";

describe("resolveOsloAlarmDayWindow", () => {
  it("ankrer dagens start på Europe/Oslo, ikke UTC-midnatt", () => {
    const now = new Date("2026-06-20T08:00:00.000Z");
    const { start, end } = resolveOsloAlarmDayWindow(now);

    expect(start.toISOString()).toBe("2026-06-19T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-20T22:00:00.000Z");
  });

  it("inkluderer alarm aktivert kl. 01:30 Oslo samme dag", () => {
    const now = new Date("2026-06-20T08:00:00.000Z");
    const { start, end } = resolveOsloAlarmDayWindow(now);
    const activatedAt = new Date("2026-06-19T23:30:00.000Z");

    expect(activatedAt.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(activatedAt.getTime()).toBeLessThan(end.getTime());
  });

  it("ekskluderer alarm aktivert dagen før i Oslo-tid", () => {
    const now = new Date("2026-06-20T08:00:00.000Z");
    const { start } = resolveOsloAlarmDayWindow(now);
    const activatedAt = new Date("2026-06-19T20:00:00.000Z");

    expect(activatedAt.getTime()).toBeLessThan(start.getTime());
  });
});
