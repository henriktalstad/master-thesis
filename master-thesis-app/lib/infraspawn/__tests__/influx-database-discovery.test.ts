import { describe, expect, it } from "vitest";
import {
  INFRASPAWN_DEFAULT_INFLUX_DATABASE,
  orderInfluxDatabaseProbeCandidates,
  parseInfluxConfigureDatabaseResponse,
  selectInfluxDatabaseCandidate,
} from "../influx-database-discovery";

describe("parseInfluxConfigureDatabaseResponse", () => {
  it("parser enkel string-liste", () => {
    expect(parseInfluxConfigureDatabaseResponse('["bacnet"]')).toEqual(["bacnet"]);
  });

  it("parser objektliste med database_name", () => {
    const body = JSON.stringify([
      { database_name: "bacnet" },
      { database_name: "other_db" },
    ]);
    expect(parseInfluxConfigureDatabaseResponse(body)).toEqual([
      "bacnet",
      "other_db",
    ]);
  });

  it("parser wrapper med databases-felt", () => {
    const body = JSON.stringify({
      databases: [{ name: "bacnet" }, { name: "telemetry" }],
    });
    expect(parseInfluxConfigureDatabaseResponse(body)).toEqual([
      "bacnet",
      "telemetry",
    ]);
  });

  it("parser iox::database fra Influx configure API", () => {
    const body = JSON.stringify([
      { "iox::database": "_internal" },
      { "iox::database": "bacnet" },
    ]);
    expect(parseInfluxConfigureDatabaseResponse(body)).toEqual(["bacnet"]);
  });

  it("returnerer tom liste ved ugyldig JSON", () => {
    expect(parseInfluxConfigureDatabaseResponse("not json")).toEqual([]);
  });

  it("filtrerer ugyldige navn", () => {
    const body = JSON.stringify(["bacnet", "123invalid", ""]);
    expect(parseInfluxConfigureDatabaseResponse(body)).toEqual(["bacnet"]);
  });
});

describe("selectInfluxDatabaseCandidate", () => {
  it("returnerer eneste kandidat", () => {
    expect(selectInfluxDatabaseCandidate(["telemetry"])).toBe("telemetry");
  });

  it("foretrekker bacnet når flere finnes", () => {
    expect(
      selectInfluxDatabaseCandidate(["telemetry", "bacnet", "archive"]),
    ).toBe("bacnet");
  });

  it("returnerer første når bacnet mangler", () => {
    expect(selectInfluxDatabaseCandidate(["alpha", "beta"])).toBe("alpha");
  });

  it("returnerer null for tom liste", () => {
    expect(selectInfluxDatabaseCandidate([])).toBeNull();
  });
});

describe("orderInfluxDatabaseProbeCandidates", () => {
  it("returnerer bacnet-fallback når listen er tom", () => {
    expect(orderInfluxDatabaseProbeCandidates([])).toEqual([
      INFRASPAWN_DEFAULT_INFLUX_DATABASE,
    ]);
  });

  it("plasserer bacnet først uavhengig av rekkefølge", () => {
    expect(
      orderInfluxDatabaseProbeCandidates(["other", "bacnet", "alpha"]),
    ).toEqual(["bacnet", "other", "alpha"]);
  });

  it("beholder rekkefølge for øvrige når bacnet mangler", () => {
    expect(orderInfluxDatabaseProbeCandidates(["x", "y"])).toEqual(["x", "y"]);
  });

  it("dedupliserer kandidater", () => {
    expect(
      orderInfluxDatabaseProbeCandidates(["bacnet", "bacnet", "other"]),
    ).toEqual(["bacnet", "other"]);
  });
});
