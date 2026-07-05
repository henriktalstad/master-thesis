import { describe, expect, test } from "bun:test";
import {
  resolvePrimaryResolutionForHours,
  toTimeSeriesResolution,
} from "@/lib/infraspawn/resolution";

describe("resolvePrimaryResolutionForHours", () => {
  test("≤90 dager → 15m", () => {
    expect(resolvePrimaryResolutionForHours(24)).toBe("15m");
    expect(resolvePrimaryResolutionForHours(90 * 24)).toBe("15m");
  });

  test(">90 dager og ≤2 år → hour", () => {
    expect(resolvePrimaryResolutionForHours(91 * 24)).toBe("hour");
    expect(resolvePrimaryResolutionForHours(365 * 24)).toBe("hour");
  });

  test(">2 år → day", () => {
    expect(resolvePrimaryResolutionForHours(731 * 24)).toBe("day");
  });
});

describe("toTimeSeriesResolution", () => {
  test("mapper 15m til 15min for UI", () => {
    expect(toTimeSeriesResolution("15m")).toBe("15min");
    expect(toTimeSeriesResolution("hour")).toBe("hour");
    expect(toTimeSeriesResolution("day")).toBe("day");
  });
});
