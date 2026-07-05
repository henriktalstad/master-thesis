import { describe, expect, it } from "bun:test";
import { formatInfraspawnUnit } from "@/lib/infraspawn/format-unit";

describe("formatInfraspawnUnit", () => {
  it("oversetter vanlige BACnet-enheter", () => {
    expect(formatInfraspawnUnit("degrees-celsius")).toBe("°C");
    expect(formatInfraspawnUnit("kilowatts")).toBe("kW");
    expect(formatInfraspawnUnit("kilowatt-hours")).toBe("kWh");
    expect(formatInfraspawnUnit("cubic-meters-per-hour")).toBe("m³/h");
    expect(formatInfraspawnUnit("percent")).toBe("%");
  });

  it("beholder korte enheter", () => {
    expect(formatInfraspawnUnit("°C")).toBe("°C");
  });

  it("returnerer null for tom enhet", () => {
    expect(formatInfraspawnUnit(null)).toBeNull();
    expect(formatInfraspawnUnit("no-units")).toBeNull();
  });
});
