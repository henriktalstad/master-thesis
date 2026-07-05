import { describe, expect, test } from "bun:test";
import { parseNordPoolCsv } from "./parse-nord-pool-csv";

describe("parse-nord-pool-csv", () => {
  test("parser semikolon CSV med Date, Hour og NO3", () => {
    const csv = `Date;Hour;NO1;NO2;NO3;NO4;NO5
01.01.2024;1;100;110;120;90;130
01.01.2024;2;101;111;121;91;131`;

    const parsed = parseNordPoolCsv(csv, "NO3");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]!.price).toBeCloseTo(0.12, 4);
    expect(parsed.rows[0]!.areaCode).toBe("NO3");
  });

  test("parser ISO delivery_start med price_area", () => {
    const csv = `delivery_start,price_area,price
2024-01-01T00:00:00Z,NO3,450.5
2024-01-01T01:00:00Z,NO3,460.0`;

    const parsed = parseNordPoolCsv(csv, "NO3");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]!.price).toBeCloseTo(0.4505, 4);
  });
});
