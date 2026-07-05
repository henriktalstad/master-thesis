import { describe, expect, test } from "bun:test";
import {
  buildInfluxBacnetLiveQuery,
  buildInfluxBacnetObjectIdFilter,
  buildInfluxBacnetSelectorLastBatchQuery,
  buildInfluxBacnetSingleLatestPointQuery,
  INFLUX_BACNET_OBJECT_ID,
  INFLUX_BACNET_VALUE_NUM,
} from "@/lib/infraspawn/influx-sql-fields";

describe("influx-sql-fields", () => {
  test("bruker quoted objectId i filter", () => {
    expect(buildInfluxBacnetObjectIdFilter(["AV-40300"])).toBe(
      `AND ${INFLUX_BACNET_OBJECT_ID} = 'AV-40300'`,
    );
  });

  test("live-spørring bruker SELECT * og quoted objectId", () => {
    const sql = buildInfluxBacnetLiveQuery({
      tableName: "bacnet_point",
      lookbackMinutes: 15,
      objectIds: ["a", "b"],
      order: "DESC",
      limit: 100,
    });

    expect(sql).toContain('SELECT * FROM bacnet_point');
    expect(sql).toContain(`AND ${INFLUX_BACNET_OBJECT_ID} IN ('a', 'b')`);
  });

  test("enkeltpunkt tail bruker LIMIT 1 og time-vindu i timer", () => {
    const sql = buildInfluxBacnetSingleLatestPointQuery({
      tableName: "bacnet_point",
      objectId: "AV-40294",
      lookbackHours: 72,
    });

    expect(sql).toContain(`AND ${INFLUX_BACNET_OBJECT_ID} = 'AV-40294'`);
    expect(sql).toContain("INTERVAL '72 hours'");
    expect(sql).toContain("LIMIT 1");
  });

  test("selector_last batch grupperer per objectId med value_num", () => {
    const sql = buildInfluxBacnetSelectorLastBatchQuery({
      tableName: "bacnet_point",
      lookbackMinutes: 6,
      objectIds: ["a", "b"],
    });

    expect(sql).toContain(`selector_last(${INFLUX_BACNET_VALUE_NUM}, time)`);
    expect(sql).toContain(`GROUP BY ${INFLUX_BACNET_OBJECT_ID}`);
    expect(sql).toContain("INTERVAL '6 minutes'");
    expect(sql).toContain(`AND ${INFLUX_BACNET_OBJECT_ID} IN ('a', 'b')`);
    expect(sql).not.toContain("LIMIT");
  });

  test("selector_last tail bruker timer som lookback", () => {
    const sql = buildInfluxBacnetSelectorLastBatchQuery({
      tableName: "bacnet_point",
      lookbackHours: 72,
      objectIds: ["AV-1"],
    });

    expect(sql).toContain("INTERVAL '72 hours'");
    expect(sql).toContain(`AND ${INFLUX_BACNET_OBJECT_ID} = 'AV-1'`);
  });
});
