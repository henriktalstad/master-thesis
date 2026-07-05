import { describe, expect, test } from "bun:test";
import {
  formatSystemairMsvAxisTick,
  formatSystemairMsvValue,
  formatSystemairOperatorMsvAxisTick,
  formatSystemairOperatorMsvValue,
  formatSystemairPlantRunModeValue,
  formatSystemairPumpCommandModeValue,
  isSystemairPumpCommandPoint,
  resolveSystemairMsvKind,
} from "@/lib/sd-anlegg/systemair-msv-labels";

describe("resolveSystemairMsvKind", () => {
  test("gjenkjenner Plantmode", () => {
    expect(
      resolveSystemairMsvKind({
        objectId: "MSV-1",
        objectName: "360102_Plantmode_KV",
        description: "Plantmode",
      }),
    ).toBe("plant_run_mode");
  });

  test("skiller Run mode fra Plantmode", () => {
    expect(
      resolveSystemairMsvKind({
        objectId: "MSV-2",
        objectName: "UnitMode",
        description: "Run mode",
      }),
    ).toBe("corrigo_run_mode");
  });

  test("MSVV pumpestatus er pumpekommando, ikke Corrigo Run mode", () => {
    expect(
      resolveSystemairMsvKind({
        objectId: "MSVV-30549",
        objectName: null,
        description: "Run mode",
      }),
    ).toBe("pump_command_mode");
    expect(
      formatSystemairMsvValue(3, {
        objectId: "MSVV-30549",
        objectName: null,
        description: "Run mode",
      }),
    ).toBe("Auto");
  });

  test("UnitMode på MSVV er Corrigo systemstatus, ikke pumpe", () => {
    const point = {
      objectId: "MSVV-40396",
      objectName: "UnitMode",
      description: "Run mode",
    };
    expect(isSystemairPumpCommandPoint(point)).toBe(false);
    expect(resolveSystemairMsvKind(point)).toBe("corrigo_run_mode");
    expect(formatSystemairMsvValue(1, point)).toBe("Stoppet");
    expect(formatSystemairMsvValue(4, point)).toBe("Oppstart full hastighet");
    expect(formatSystemairMsvAxisTick(1, point)).toBe("Stoppet");
    expect(formatSystemairMsvAxisTick(4, point)).toBe("Oppst. full");
  });

  test("EAFAutoMode på MSVV beholder vifte-modus", () => {
    expect(
      resolveSystemairMsvKind({
        objectId: "MSVV-40350",
        objectName: "EAFAutoMode",
        description: "Running mode EAF",
      }),
    ).toBe("fan_auto_mode");
  });

  test("MSVV driftsmodus aggregat matcher air unit, ikke pumpe", () => {
    const point = {
      objectId: "MSVV-30565",
      objectName: "AirUnitAutoMode",
      description: "Running mode air unit",
    };
    expect(isSystemairPumpCommandPoint(point)).toBe(false);
    expect(resolveSystemairMsvKind(point)).toBe("air_unit_auto_mode");
    expect(formatSystemairMsvValue(1, point)).toBe("Manuell av");
    expect(formatSystemairMsvValue(3, point)).toBe("Manuell normal");
    expect(formatSystemairMsvValue(4, point)).toBe("Auto");
    expect(formatSystemairMsvAxisTick(1, point)).toBe("Man. av");
    expect(formatSystemairMsvAxisTick(3, point)).toBe("Man. normal");
    expect(formatSystemairMsvAxisTick(4, point)).toBe("Auto");
  });
});

describe("formatSystemairPlantRunModeValue", () => {
  test("mapper Plantmode-verdier", () => {
    expect(formatSystemairPlantRunModeValue(1)).toBe("Av");
    expect(formatSystemairPlantRunModeValue(2)).toBe("Redusert hastighet");
    expect(formatSystemairPlantRunModeValue(3)).toBe("Normal hastighet");
    expect(formatSystemairPlantRunModeValue(4)).toBe("Stopp pga. alarm");
  });
});

describe("formatSystemairPumpCommandModeValue", () => {
  test("mapper pumpekommando som DOSelect", () => {
    expect(formatSystemairPumpCommandModeValue(0)).toBe("Av");
    expect(formatSystemairPumpCommandModeValue(1)).toBe("På");
    expect(formatSystemairPumpCommandModeValue(2)).toBe("Auto");
    expect(formatSystemairPumpCommandModeValue(3)).toBe("Auto");
  });
});

describe("formatSystemairMsvValue", () => {
  test("formaterer Plantmode i historikk-kontekst", () => {
    expect(
      formatSystemairMsvValue(3, {
        objectId: "MSV-1",
        objectName: "360102_Plantmode_KV",
        description: "Plantmode",
      }),
    ).toBe("Normal hastighet");
  });
});

describe("formatSystemairOperatorMsvValue", () => {
  const unitModePoint = {
    objectId: "MSVV-40396",
    objectName: "UnitMode",
    description: "Run mode",
  };

  test("mapper UnitMode 4 til operatørstatus uten å endre teknisk MSV", () => {
    expect(formatSystemairMsvValue(4, unitModePoint)).toBe(
      "Oppstart full hastighet",
    );
    expect(formatSystemairOperatorMsvValue(4, unitModePoint)).toBe(
      "Normal hastighet",
    );
    expect(formatSystemairMsvAxisTick(4, unitModePoint)).toBe("Oppst. full");
    expect(formatSystemairOperatorMsvAxisTick(4, unitModePoint)).toBe("Normal");
  });

  test("beholder andre Corrigo-verdier uendret", () => {
    expect(formatSystemairOperatorMsvValue(1, unitModePoint)).toBe("Stoppet");
    expect(formatSystemairOperatorMsvAxisTick(1, unitModePoint)).toBe(
      "Stoppet",
    );
  });
});
