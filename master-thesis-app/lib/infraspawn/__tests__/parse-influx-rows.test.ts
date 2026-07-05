import { describe, expect, test } from "bun:test";
import { parseInfluxSqlResponse } from "@/lib/infraspawn/parse-influx-rows";

describe("parseInfluxSqlResponse", () => {
  test("parser JSON-array av objekter", () => {
    const body = JSON.stringify([
      {
        time: "2026-06-04T10:00:00Z",
        objectId: "obj-1",
        value_num: 21.5,
        objectName: "Temp",
        quality: "good",
      },
    ]);
    const rows = parseInfluxSqlResponse(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.objectId).toBe("obj-1");
    expect(rows[0]?.valueNum).toBe(21.5);
    expect(rows[0]?.objectName).toBe("Temp");
  });

  test("parser columnar JSON med header-rad", () => {
    const body = JSON.stringify([
      ["time", "objectId", "value_num"],
      ["2026-06-04T10:00:01Z", "obj-2", 3],
    ]);
    const rows = parseInfluxSqlResponse(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.objectId).toBe("obj-2");
    expect(rows[0]?.valueNum).toBe(3);
  });

  test("parser selector_last JSON med value_num alias", () => {
    const body = JSON.stringify([
      {
        objectId: "AV-1",
        time: "2026-06-04T10:00:00Z",
        value_num: 65,
        quality: "good",
      },
    ]);
    const rows = parseInfluxSqlResponse(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.objectId).toBe("AV-1");
    expect(rows[0]?.valueNum).toBe(65);
  });

  test("parser naive Influx-tid som UTC", () => {
    const body = JSON.stringify([
      {
        time: "2026-06-29T21:53:50.959662848",
        objectId: "obj-naive",
        value_num: 42,
      },
    ]);
    const rows = parseInfluxSqlResponse(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sampledAt.toISOString()).toBe("2026-06-29T21:53:50.959Z");
  });

  test("returnerer tom liste for ugyldig JSON", () => {
    expect(parseInfluxSqlResponse("not json")).toEqual([]);
  });

  test("idempotent nøkkel: samme objectId og tid", () => {
    const body = JSON.stringify([
      {
        time: "2026-06-04T10:00:00.123456789Z",
        objectId: "dup",
        value_num: 1,
      },
      {
        time: "2026-06-04T10:00:00.123456789Z",
        objectId: "dup",
        value_num: 2,
      },
    ]);
    const rows = parseInfluxSqlResponse(body);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.sampledAt.getTime()).toBe(rows[1]?.sampledAt.getTime());
  });
});
