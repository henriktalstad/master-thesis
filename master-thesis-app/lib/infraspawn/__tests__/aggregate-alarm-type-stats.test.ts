import { describe, expect, test } from "bun:test";
import {
  aggregateAlarmTypeStats,
  slugifyAlarmTypeKey,
  type AlarmStatsRawRow,
} from "@/lib/infraspawn/aggregate-alarm-type-stats";

function row(
  partial: Partial<AlarmStatsRawRow> & Pick<AlarmStatsRawRow, "day" | "count">,
): AlarmStatsRawRow {
  return {
    sourceId: "src-1",
    alarmText: "362.001RT601_MV: Romtemperatur",
    objectId: "362.001RT601_MV",
    objectName: null,
    description: null,
    ...partial,
  };
}

describe("slugifyAlarmTypeKey", () => {
  test("normaliserer label til slug", () => {
    expect(slugifyAlarmTypeKey("Romtemperatur")).toBe("romtemperatur");
    expect(slugifyAlarmTypeKey("C-alarm")).toBe("c-alarm");
  });
});

describe("aggregateAlarmTypeStats", () => {
  test("slår sammen like alarmtyper på tvers av signaler", () => {
    const result = aggregateAlarmTypeStats(
      [
        row({ day: "2026-06-01", count: 10, objectId: "362.001RT601_MV" }),
        row({ day: "2026-06-01", count: 5, objectId: "362.001RT602_MV" }),
        row({
          day: "2026-06-02",
          count: 3,
          alarmText: "C-alarm",
          objectId: "BI-1",
        }),
      ],
      null,
    );

    expect(result.byType).toHaveLength(2);
    expect(result.byType[0]?.label).toBe("Romtemperatur");
    expect(result.byType[0]?.count).toBe(15);
    expect(result.totalCount).toBe(18);
  });

  test("filtrerer daglige buckets på valgt typeKey", () => {
    const rows = [
      row({ day: "2026-06-01", count: 10 }),
      row({ day: "2026-06-02", count: 4 }),
      row({
        day: "2026-06-02",
        count: 6,
        alarmText: "C-alarm",
        objectId: "BI-1",
      }),
    ];

    const romKey = slugifyAlarmTypeKey("Romtemperatur");
    const filtered = aggregateAlarmTypeStats(rows, romKey);

    expect(filtered.totalCount).toBe(14);
    expect(filtered.dailyBuckets).toEqual([
      { day: "2026-06-01", count: 10 },
      { day: "2026-06-02", count: 4 },
    ]);
    expect(filtered.byType).toHaveLength(2);
  });

  test("returnerer tom statistikk uten rader", () => {
    const result = aggregateAlarmTypeStats([], null);
    expect(result.totalCount).toBe(0);
    expect(result.byType).toEqual([]);
    expect(result.dailyBuckets).toEqual([]);
  });
});
