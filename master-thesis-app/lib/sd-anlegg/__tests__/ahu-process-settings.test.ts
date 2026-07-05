import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";
import { resolveAhuProcessSettingsItems } from "@/lib/sd-anlegg/ahu-process-settings";
import type { AhuBlueprintSlotDef } from "@/lib/sd-anlegg/ahu-blueprint";
import {
  buildProcessSlotDisplayLines,
  formatPumpCommandValue,
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

function settingsModelFromPoints(points: readonly InfraspawnPointListItem[]) {
  return buildAhuPresentationModel(points, { elementKey: "360102" });
}

const pumpSlot: AhuBlueprintSlotDef = {
  slotId: "heating.pump",
  equipmentCode: "JP401",
  role: "pump",
  lane: "heating",
  componentType: "hvac.pump",
  x: 63,
  y: 32,
  labelPosition: "above",
};

describe("formatPumpCommandValue", () => {
  test("viser Auto for pumpekommando", () => {
    expect(
      formatPumpCommandValue(
        point({ objectName: "DOSelect_SeqPumpY1", lastValue: 2 }),
      ),
    ).toBe("Auto");
  });

  test("skjuler volt-signaler på pumpe", () => {
    expect(
      formatPumpCommandValue(
        point({ objectName: "JP401", unit: "volts", lastValue: 0 }),
      ),
    ).toBeNull();
  });
});

describe("buildProcessSlotDisplayLines pump", () => {
  test("viser kommando i stedet for volt", () => {
    const lines = buildProcessSlotDisplayLines(pumpSlot, [
      point({ objectName: "JP401", unit: "volts", lastValue: 0 }),
      point({ objectName: "DOSelect_SeqPumpY1", lastValue: 2 }),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.displayValue).toBe("Auto");
  });
});

describe("resolveAhuProcessSettingsItems", () => {
  test("samler pumpekommandoer fra skjema og avtrekkssetpunkt fra workspace", () => {
    const points = [
      point({ objectId: "p-y1", objectName: "DOSelect_SeqPumpY1", lastValue: 2 }),
      point({ objectId: "p-y2", objectName: "DOSelect_SeqPumpY2", lastValue: 2 }),
      point({
        objectId: "ext-sp",
        objectName: "ExtractSetpoint",
        unit: "degrees-celsius",
        lastValue: 23,
      }),
    ];
    const model = settingsModelFromPoints(points);
    const items = resolveAhuProcessSettingsItems(model, points);

    expect(items.map((item) => item.label)).toEqual([
      "Kommando pumpe varmebatteri",
      "Kommando pumpe kjølebatteri",
      "Settpunkt avtrekkstemp.",
    ]);
    expect(items[0]?.displayValue).toBe("Auto");
    expect(items[2]?.displayValue).toMatch(/23.*°C/);
  });

  test("foretrekker DOSelect foran DO_SeqPumpY i skjema-slot", () => {
    const points = [
      point({ objectId: "sel-y1", objectName: "DOSelect_SeqPumpY1", lastValue: 2 }),
    ];
    const model = settingsModelFromPoints(points);
    const items = resolveAhuProcessSettingsItems(model, points);

    expect(items).toHaveLength(1);
    expect(items[0]?.displayValue).toBe("Auto");
  });

  test("viser pumpekommando med lastValue 0 fra skjema-slot", () => {
    const points = [point({ objectName: "DOSelect_SeqPumpY1", lastValue: 0 })];
    const model = settingsModelFromPoints(points);
    const items = resolveAhuProcessSettingsItems(model, points);

    expect(items).toHaveLength(1);
    expect(items[0]?.displayValue).toBe("Av");
  });

  test("viser pumpe fra skjema-slot når kommando har ukjent signalnavn", () => {
    const pumpPoint = point({
      objectId: "msv-pump",
      objectName: "360102_Plantmode_KV",
      lastValue: 0,
    });
    const items = resolveAhuProcessSettingsItems(
      {
        processSlots: [
          {
            slotId: "heating.pump",
            equipmentCode: "JP401",
            displayLines: [
              {
                label: "Kommando",
                displayValue: "Av",
                point: pumpPoint,
                role: "command",
              },
            ],
          },
        ],
      },
      [],
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("pump.heater.command");
    expect(items[0]?.displayValue).toBe("Av");
  });

  test("viser settpunkt med — når lastValue mangler", () => {
    const points = [
      point({ objectName: "ExtractSetpoint", unit: "degrees-celsius", lastValue: null }),
    ];
    const model = settingsModelFromPoints([]);
    const items = resolveAhuProcessSettingsItems(model, points);

    expect(items).toHaveLength(1);
    expect(items[0]?.displayValue).toBe("—");
  });
});
