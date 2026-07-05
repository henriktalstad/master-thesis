import { describe, expect, test } from "bun:test";
import {
  parseInfraspawnTfmIdentity,
  isThermalSystemElementKey,
  isVentilationSystemElementKey,
} from "@/lib/infraspawn/parse-infraspawn-tfm-identity";

describe("parseInfraspawnTfmIdentity", () => {
  test("parser kompakt utstyrstag i objectName", () => {
    const parsed = parseInfraspawnTfmIdentity({
      objectName: "320.002RT402_MV",
    });

    expect(parsed).toMatchObject({
      elementKey: "320002",
      equipmentCode: "RT402",
      signalSuffix: "MV",
      signalRole: "measured_value",
      matchKind: "equipment-compact",
    });
  });

  test("parser underscore energimåler", () => {
    const parsed = parseInfraspawnTfmIdentity({
      objectName: "320001OE001_turtemp",
    });

    expect(parsed).toMatchObject({
      elementKey: "320001",
      equipmentCode: "OE001",
      signalRole: "measured_value",
      isEnergyMeter: true,
    });
  });

  test("parser settpunkt 310.001RT402_SP", () => {
    const parsed = parseInfraspawnTfmIdentity({
      objectName: "310.001RT402_SP",
    });

    expect(parsed).toMatchObject({
      elementKey: "310001",
      equipmentCode: "RT402",
      signalRole: "setpoint",
    });
  });

  test("parser PA-0805 normal TFM-ID", () => {
    const parsed = parseInfraspawnTfmIdentity({
      objectName: "+123456=3600.001.05-RTA001%RTA.001.001",
    });

    expect(parsed).toMatchObject({
      systemCode: "3600",
      elementNumber: "001",
      subsystemSuffix: "05",
      subsystemRole: "extract_air",
      equipmentCode: "RTA001",
      componentTypeCode: "RTA.001",
      matchKind: "pa-normal",
    });
  });

  test("parser PA kompakt varme tur", () => {
    const parsed = parseInfraspawnTfmIdentity({
      objectName: "=3200.001.04-RTA001",
    });

    expect(parsed).toMatchObject({
      systemCode: "3200",
      elementKey: "3200001",
      subsystemSuffix: "04",
      subsystemRole: "supply_water",
      equipmentCode: "RTA001",
    });
  });

  test("parser PA uten utstyrskode uten å krasje", () => {
    const parsed = parseInfraspawnTfmIdentity({
      objectName: "=3200.001.04",
    });

    expect(parsed).toMatchObject({
      systemCode: "3200",
      elementKey: "3200001",
      equipmentCode: null,
      isEnergyMeter: false,
      matchKind: "pa-normal",
    });
  });
});

describe("element key helpers", () => {
  test("gjenkjenner varme- og ventilasjonssystem", () => {
    expect(isThermalSystemElementKey("320002")).toBe(true);
    expect(isThermalSystemElementKey("3200001")).toBe(true);
    expect(isVentilationSystemElementKey("360102")).toBe(true);
    expect(isVentilationSystemElementKey("3600001")).toBe(true);
    expect(isThermalSystemElementKey("310001")).toBe(false);
  });
});
