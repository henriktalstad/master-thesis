import { describe, expect, test } from "bun:test";
import { clearSkySolarProxy } from "../disturbance/solar-proxy";

describe("clearSkySolarProxy", () => {
  test("er 0 midt på natten om vinteren i Trondheim", () => {
    const midnightWinter = Date.parse("2026-01-15T23:00:00.000Z");
    expect(clearSkySolarProxy(midnightWinter)).toBe(0);
  });

  test("er positiv midt på dagen om sommeren", () => {
    const noonSummer = Date.parse("2026-06-21T12:00:00.000Z");
    expect(clearSkySolarProxy(noonSummer)).toBeGreaterThan(0.5);
  });

  test("sommer-middag gir høyere sol enn vinter-middag", () => {
    const noonSummer = Date.parse("2026-06-21T12:00:00.000Z");
    const noonWinter = Date.parse("2026-01-15T12:00:00.000Z");
    expect(clearSkySolarProxy(noonSummer)).toBeGreaterThan(
      clearSkySolarProxy(noonWinter),
    );
  });

  test("returnerer aldri negative verdier", () => {
    for (let h = 0; h < 24; h++) {
      const t = Date.parse(`2026-01-15T${String(h).padStart(2, "0")}:00:00.000Z`);
      expect(clearSkySolarProxy(t)).toBeGreaterThanOrEqual(0);
    }
  });
});
