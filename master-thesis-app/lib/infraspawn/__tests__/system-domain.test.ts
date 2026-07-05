import { describe, expect, test } from "bun:test";
import { InfraspawnSystemDomain } from "@/generated/client/enums";
import {
  inferInfraspawnSystemDomain,
  systemDomainFromPathSegment,
} from "@/lib/infraspawn/system-domain";

describe("inferInfraspawnSystemDomain", () => {
  test("klassifiserer ventilasjon", () => {
    expect(
      inferInfraspawnSystemDomain({
        objectId: "JV501_MV",
        objectName: "Tilluft temperatur",
      }),
    ).toBe(InfraspawnSystemDomain.VENTILATION);
  });

  test("klassifiserer varme", () => {
    expect(
      inferInfraspawnSystemDomain({
        objectId: "JP101",
        objectName: "Turtemperatur",
      }),
    ).toBe(InfraspawnSystemDomain.HEATING);
  });

  test("klassifiserer 320.xxx utstyrskoder som varme", () => {
    expect(
      inferInfraspawnSystemDomain({
        objectId: "AI-402",
        objectName: "320.002RT402_MV",
        description: "Temperatur turvann",
      }),
    ).toBe(InfraspawnSystemDomain.HEATING);

    expect(
      inferInfraspawnSystemDomain({
        objectId: "AI-403",
        objectName: "320.002RP403_MV",
        description: "Differansetrykk",
      }),
    ).toBe(InfraspawnSystemDomain.HEATING);

    expect(
      inferInfraspawnSystemDomain({
        objectId: "AI-001",
        objectName: "320001OE001_turtemp",
      }),
    ).toBe(InfraspawnSystemDomain.HEATING);
  });

  test("klassifiserer PA-0805 ventilasjon som ventilasjon", () => {
    expect(
      inferInfraspawnSystemDomain({
        objectId: "AI-PA",
        objectName: "+123456=3600.001.05-RTA001",
      }),
    ).toBe(InfraspawnSystemDomain.VENTILATION);
  });

  test("klassifiserer AHU status-signaler som ventilasjon", () => {
    for (const objectName of [
      "Frostrisk",
      "SFP",
      "AirUnitAutoMode",
      "SupplySetpoint",
    ]) {
      expect(
        inferInfraspawnSystemDomain({
          objectId: "BO-1",
          objectName,
        }),
      ).toBe(InfraspawnSystemDomain.VENTILATION);
    }
  });
});

describe("systemDomainFromPathSegment", () => {
  test("mapper norske path-segmenter", () => {
    expect(systemDomainFromPathSegment("ventilasjon")).toBe(
      InfraspawnSystemDomain.VENTILATION,
    );
    expect(systemDomainFromPathSegment("varme")).toBe(
      InfraspawnSystemDomain.HEATING,
    );
  });
});
