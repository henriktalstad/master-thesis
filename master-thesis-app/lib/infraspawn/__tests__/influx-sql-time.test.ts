import { describe, expect, test } from "bun:test";
import {
  formatInfluxSqlTimeLiteral,
  parseInfluxSqlTimestamp,
} from "@/lib/infraspawn/influx-sql-time";

describe("formatInfluxSqlTimeLiteral", () => {
  test("formatterer UTC Date til naive Influx-literal", () => {
    const literal = formatInfluxSqlTimeLiteral(
      new Date("2026-06-29T15:10:50.555Z"),
    );
    expect(literal).toBe("2026-06-29T15:10:50.555");
  });
});

describe("parseInfluxSqlTimestamp", () => {
  test("naive Influx-tid tolkes som UTC uavhengig av server-TZ", () => {
    const parsed = parseInfluxSqlTimestamp("2026-06-29T21:53:50.959662848");
    expect(parsed.toISOString()).toBe("2026-06-29T21:53:50.959Z");
  });

  test("beholder eksplisitt Z-suffiks", () => {
    const parsed = parseInfluxSqlTimestamp("2026-06-04T10:00:00.123Z");
    expect(parsed.toISOString()).toBe("2026-06-04T10:00:00.123Z");
  });

  test("roundtrip med formatInfluxSqlTimeLiteral", () => {
    const instant = new Date("2026-06-29T15:10:50.555Z");
    const parsed = parseInfluxSqlTimestamp(formatInfluxSqlTimeLiteral(instant));
    expect(parsed.toISOString()).toBe(instant.toISOString());
  });
});
