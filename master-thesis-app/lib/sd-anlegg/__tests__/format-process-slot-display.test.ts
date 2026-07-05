import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { AhuBlueprintSlotDef } from "@/lib/sd-anlegg/ahu-blueprint";
import {
  buildProcessSlotDisplayLines,
  formatFilterPressure,
  formatSystemStatus,
  isHxControlPercentSignal,
  resolveProcessPrimaryDisplay,
  selectProcessSchematicDisplayLines,
} from "@/lib/sd-anlegg/format-process-slot-display";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "360.102",
    objectId: "p1",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 0,
    lastSampledAt: "2026-06-20T09:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

const filterSlot: AhuBlueprintSlotDef = {
  slotId: "supply.filter",
  equipmentCode: "QD401",
  role: "filter",
  lane: "supply",
  componentType: "ventilation.filter",
  x: 22,
  y: 58,
  labelPosition: "below",
};

const fanSlot: AhuBlueprintSlotDef = {
  slotId: "supply.fan",
  equipmentCode: "JV401",
  role: "fan",
  lane: "supply",
  componentType: "ventilation.fan",
  x: 78,
  y: 58,
  labelPosition: "below",
};

describe("formatFilterPressure", () => {
  test("viser pa én gang", () => {
    expect(
      formatFilterPressure(
        point({ lastValue: -2.19, unit: "pascals", objectName: "AI_FilterGuard1" }),
      ),
    ).toBe("−2 Pa");
  });
});

const hxSlot: AhuBlueprintSlotDef = {
  slotId: "heat_recovery.unit",
  equipmentCode: "LX471",
  role: "hx",
  lane: "heatRecovery",
  componentType: "ventilation.heat_recovery",
  x: 50,
  y: 22,
  labelPosition: "above",
};

describe("LX471 hastighet (Pådrag gjenvinner)", () => {
  test("360102_LX471_C uten percent-enhet vises som Hastighet %", () => {
    const displayLines = buildProcessSlotDisplayLines(hxSlot, [
      point({
        objectName: "360102_LX471_C",
        description: "Pådrag gjenvinner",
        unit: "generic",
        lastValue: 0,
      }),
      point({
        objectName: "360102_LX471_KV",
        description: "Virkningsgrad",
        unit: "generic",
        lastValue: 0,
      }),
    ]);

    expect(isHxControlPercentSignal({
      objectName: "360102_LX471_C",
      objectId: "lx-c",
      description: "Pådrag gjenvinner",
    })).toBe(true);

    const hast = displayLines.find((line) => line.label === "Hastighet");
    const eff = displayLines.find((line) => line.label === "Effektivitet");
    expect(hast?.displayValue).toBe("0 %");
    expect(eff?.displayValue).toBe("0 %");

    const visible = selectProcessSchematicDisplayLines({
      role: "hx",
      displayLines,
      displayValue: "0 %",
    });
    expect(visible.map((line) => line.label)).toEqual(["Hastighet", "Effektivitet"]);
  });

  test("kun FDV-beskrivelse matcher hastighet via Efficiency-navn", () => {
    const displayLines = buildProcessSlotDisplayLines(hxSlot, [
      point({
        objectId: "AV-999",
        objectName: "360102_LX471_C",
        description: "Pådrag gjenvinner",
        unit: null,
        lastValue: 42,
      }),
    ]);
    expect(displayLines[0]?.label).toBe("Hastighet");
    expect(displayLines[0]?.displayValue).toBe("42 %");
  });
});

describe("selectProcessSchematicDisplayLines", () => {
  test("vifte viser kun flow og pådrag", () => {
    const displayLines = buildProcessSlotDisplayLines(fanSlot, [
      point({
        objectName: "AI_SAFFLOW",
        unit: "cubic-meters-per-hour",
        lastValue: 0,
      }),
      point({
        objectName: "AI_SAFPressure",
        unit: "pascals",
        lastValue: null,
      }),
      point({ objectName: "AO_SAF", unit: "percent", lastValue: 0 }),
    ]);

    const visible = selectProcessSchematicDisplayLines({
      role: "fan",
      displayLines,
      displayValue: "0 m³/h",
    });

    expect(visible).toHaveLength(2);
    expect(visible[0]?.displayValue).toContain("m³/h");
    expect(visible[1]?.displayValue).toBe("0 %");
    expect(visible[1]?.label).toBeUndefined();
  });

  test("filter viser én pa-linje", () => {
    const displayLines = buildProcessSlotDisplayLines(filterSlot, [
      point({
        objectName: "AI_FilterGuard1",
        unit: "pascals",
        lastValue: -2.19,
      }),
    ]);

    const visible = selectProcessSchematicDisplayLines({
      role: "filter",
      displayLines,
      displayValue: "−2 Pa",
    });

    expect(visible).toHaveLength(1);
    expect(visible[0]?.displayValue).toBe("−2 Pa");
  });

  test("ventil viser prosent", () => {
    const coolValve: AhuBlueprintSlotDef = {
      slotId: "heating.cool_valve",
      equipmentCode: "SB501",
      role: "valve",
      lane: "heating",
      componentType: "hvac.valve",
      x: 52,
      y: 38,
      labelPosition: "above",
    };
    const displayLines = buildProcessSlotDisplayLines(coolValve, [
      point({ objectName: "AO_5", unit: "percent", lastValue: 0 }),
    ]);
    expect(displayLines[0]?.displayValue).toBe("0 %");
  });

  test("coil viser prosent og hopper over volt", () => {
    const coolCoil: AhuBlueprintSlotDef = {
      slotId: "heating.cool_valve",
      equipmentCode: "SB501",
      role: "coil",
      lane: "heating",
      componentType: "hvac.coil",
      x: 52,
      y: 38,
      labelPosition: "above",
    };
    const displayLines = buildProcessSlotDisplayLines(coolCoil, [
      point({ objectName: "AO_5", unit: "percent", lastValue: 0 }),
      point({ objectName: "AO_5_V", unit: "volts", lastValue: 0 }),
    ]);
    expect(displayLines).toHaveLength(1);
    expect(displayLines[0]?.displayValue).toBe("0 %");
  });

  test("hx viser ikke Hastighet-placeholder når kun effektivitet finnes", () => {
    const displayLines = buildProcessSlotDisplayLines(hxSlot, [
      point({
        objectName: "360102_LX471_KV",
        unit: "percent",
        lastValue: 66,
      }),
    ]);

    const visible = selectProcessSchematicDisplayLines({
      role: "hx",
      displayLines,
      displayValue: "66 %",
    });

    expect(visible).toHaveLength(1);
    expect(visible[0]?.label).toBe("Effektivitet");
    expect(visible[0]?.displayValue).toBe("66 %");
  });
});

describe("formatSystemStatus", () => {
  test("mapper Plantmode til norske tilstander", () => {
    expect(
      formatSystemStatus(
        point({
          objectName: "360102_Plantmode_KV",
          description: "Plantmode",
          lastValue: 1,
        }),
      ),
    ).toBe("Av");
    expect(
      formatSystemStatus(
        point({
          objectName: "360102_Plantmode_KV",
          lastValue: 3,
        }),
      ),
    ).toBe("Normal hastighet");
  });

  test("mapper UnitMode 4 til operatørstatus i driftstripen", () => {
    expect(
      formatSystemStatus(
        point({
          objectId: "MSVV-40396",
          objectName: "UnitMode",
          description: "Run mode.",
          lastValue: 4,
        }),
      ),
    ).toBe("Normal hastighet");
  });
});

describe("resolveProcessPrimaryDisplay", () => {
  test("vifte header: flow + stateLabel som prosent", () => {
    const displayLines = buildProcessSlotDisplayLines(fanSlot, [
      point({
        objectName: "AI_SAFFLOW",
        unit: "cubic-meters-per-hour",
        lastValue: 1200,
      }),
      point({ objectName: "AO_SAF", unit: "percent", lastValue: 42 }),
    ]);

    const { displayValue, stateLabel } = resolveProcessPrimaryDisplay(
      fanSlot,
      displayLines[0]?.point,
      displayLines,
    );

    expect(displayValue).toContain("1");
    expect(displayValue).toContain("m³/h");
    expect(stateLabel).toBe("42 %");
  });
});
