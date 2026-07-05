import { describe, expect, it } from "bun:test";
import {
  formatActiveAlarmAge,
  formatLastUpdated,
  formatRelativeMeasurementAge,
} from "../display-format";

describe("measurement age formatters", () => {
  it("formatRelativeMeasurementAge bruker måling-copy", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeMeasurementAge(fiveMinAgo)).toBe("5 min siden");
  });

  it("formatRelativeMeasurementAge tikker med eksplisitt now", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    const sampledAt = new Date(now.getTime() - 9 * 3_600_000).toISOString();
    expect(formatRelativeMeasurementAge(sampledAt, now)).toBe("9 timer siden");
  });

  it("formatLastUpdated prefikser med Sist oppdatert", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatLastUpdated(fiveMinAgo)).toBe("Sist oppdatert for 5 min siden");
  });

  it("formatActiveAlarmAge bruker dager siden for nylige alarmer", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(formatActiveAlarmAge(twoDaysAgo)).toBe("2 dager siden");
  });
});
