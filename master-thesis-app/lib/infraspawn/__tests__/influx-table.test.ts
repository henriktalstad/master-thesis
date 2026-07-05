import { describe, expect, it } from "bun:test";
import {
  DEFAULT_INFLUX_TABLE,
  resolveInfluxTableName,
  resolveInfluxTableNameFromInput,
} from "@/lib/infraspawn/influx-table";

describe("resolveInfluxTableNameFromInput", () => {
  it("godtar gyldig tabellnavn", () => {
    expect(resolveInfluxTableNameFromInput("ventilasjon_1")).toBe(
      "ventilasjon_1",
    );
  });

  it("trimmer og godtar", () => {
    expect(resolveInfluxTableNameFromInput("  bacnet_point  ")).toBe(
      "bacnet_point",
    );
  });

  it("faller tilbake til standard ved tom input", () => {
    expect(resolveInfluxTableNameFromInput(undefined)).toBe(
      DEFAULT_INFLUX_TABLE,
    );
    expect(resolveInfluxTableNameFromInput("")).toBe(DEFAULT_INFLUX_TABLE);
  });

  it("avviser SQL-injection og ugyldige tegn", () => {
    expect(resolveInfluxTableNameFromInput("bacnet; DROP TABLE x")).toBe(
      DEFAULT_INFLUX_TABLE,
    );
    expect(resolveInfluxTableNameFromInput("1bad")).toBe(DEFAULT_INFLUX_TABLE);
    expect(resolveInfluxTableNameFromInput("a-b")).toBe(DEFAULT_INFLUX_TABLE);
  });
});

describe("resolveInfluxTableName", () => {
  it("leser tableName fra metadata", () => {
    expect(resolveInfluxTableName({ tableName: "varmesentral" })).toBe(
      "varmesentral",
    );
  });

  it("faller tilbake for manglende eller ugyldig metadata", () => {
    expect(resolveInfluxTableName(null)).toBe(DEFAULT_INFLUX_TABLE);
    expect(resolveInfluxTableName("bacnet")).toBe(DEFAULT_INFLUX_TABLE);
    expect(resolveInfluxTableName({ tableName: "; DROP" })).toBe(
      DEFAULT_INFLUX_TABLE,
    );
  });
});
