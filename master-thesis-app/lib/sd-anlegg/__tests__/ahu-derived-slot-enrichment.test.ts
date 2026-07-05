import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { AHU_BLUEPRINT_PROCESS_SLOTS } from "@/lib/sd-anlegg/ahu-blueprint";
import {
  inferDamperStateFromFan,
  prepareAhuSchematicModel,
} from "@/lib/sd-anlegg/ahu-derived-slot-enrichment";
import { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";

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

const STOPPED_SIGNALS: InfraspawnPointListItem[] = [
  point({
    objectId: "UM",
    objectName: "UnitMode",
    unit: "boolean",
    lastValue: 0,
  }),
  point({
    objectId: "AV-SAF",
    objectName: "AI_SAFFLOW",
    unit: "cubic-meters-per-hour",
    lastValue: 0,
  }),
  point({
    objectId: "AV-EAF",
    objectName: "AI_EAFFLOW",
    unit: "cubic-meters-per-hour",
    lastValue: 0,
  }),
  point({
    objectId: "BO-601",
    objectName: "Systemstatus",
    unit: "boolean",
    lastValue: 0,
  }),
];

describe("inferDamperStateFromFan", () => {
  test("null eller 0 flow og pådrag → LUKKET", () => {
    expect(inferDamperStateFromFan({ fanFlow: 0, fanPercent: 0 })).toBe("LUKKET");
    expect(inferDamperStateFromFan({ fanFlow: null, fanPercent: null })).toBe(
      "LUKKET",
    );
  });

  test("positiv flow → ÅPEN", () => {
    expect(inferDamperStateFromFan({ fanFlow: 120, fanPercent: null })).toBe("ÅPEN");
  });

  test("positiv pådrag uten flow → ÅPEN", () => {
    expect(inferDamperStateFromFan({ fanFlow: 0, fanPercent: 15 })).toBe("ÅPEN");
  });
});

describe("prepareAhuSchematicModel", () => {
  test("skjuler pumpe uten gyldig kommando og viser kjølebatteri fra AO_5", () => {
    const signals = [
      ...STOPPED_SIGNALS,
      point({
        objectId: "AO-5",
        objectName: "AO_5",
        unit: "percent",
        lastValue: 0,
      }),
      point({
        objectId: "AO-701",
        objectName: "JP401",
        unit: "volts",
        lastValue: 0,
      }),
    ];
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(signals, { elementKey: "360102" }),
      signals,
    );

    expect(model.processSlots.some((slot) => slot.slotId === "heating.pump")).toBe(
      false,
    );

    const coolValve = model.processSlots.find(
      (slot) => slot.slotId === "heating.cool_valve",
    );
    expect(coolValve?.equipmentCode).toBe("SB501");
    expect(coolValve?.displayValue).toBe("0 %");
    expect(coolValve?.confidence).toMatch(/^(exact|alias)$/);
  });

  test("pumpe viser faktisk drift (Av) fremfor sekvensmodus (Auto)", () => {
    const signals = [
      ...STOPPED_SIGNALS,
      point({
        objectId: "MSVV-30549",
        objectName: "DOSelect_SeqPumpY1",
        lastValue: 3,
      }),
      point({
        objectId: "BV-20321",
        objectName: "DO_SeqPumpY1",
        lastValue: 0,
      }),
    ];
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(signals, { elementKey: "360102" }),
      signals,
    );
    const pump = model.processSlots.find((slot) => slot.slotId === "heating.pump");
    expect(pump?.displayValue).toBe("Av");
    expect(pump?.primaryPoint?.objectName).toBe("DO_SeqPumpY1");
  });

  test("varmeventil ignorerer volt-feedback og bruker AO_3 prosent", () => {
    const signals = [
      ...STOPPED_SIGNALS,
      point({
        objectId: "AV-40372",
        objectName: "SB401",
        unit: "volts",
        lastValue: 0,
      }),
      point({
        objectId: "AO-3",
        objectName: "AO_3",
        unit: "percent",
        lastValue: 0,
      }),
    ];
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(signals, { elementKey: "360102" }),
      signals,
    );

    const valve = model.processSlots.find((slot) => slot.slotId === "heating.valve");
    expect(valve?.displayValue).toBe("0 %");
    expect(valve?.primaryPoint?.objectName).toBe("AO_3");
  });

  test("viser SB401/AO_3 når Influx kun har volt-enhet (live Nærbyen)", () => {
    const signals = [
      ...STOPPED_SIGNALS,
      point({
        objectId: "AV-40372",
        objectName: "AO_3",
        unit: "volts",
        lastValue: 0,
      }),
      point({
        objectId: "AV-40374",
        objectName: "AO_5",
        unit: "volts",
        lastValue: 0,
      }),
    ];
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(signals, { elementKey: "360102" }),
      signals,
    );

    const valve = model.processSlots.find((slot) => slot.slotId === "heating.valve");
    const coolValve = model.processSlots.find(
      (slot) => slot.slotId === "heating.cool_valve",
    );
    expect(valve?.displayValue).toBe("0 %");
    expect(valve?.primaryPoint?.objectName).toBe("AO_3");
    expect(coolValve?.displayValue).toBe("0 %");
    expect(coolValve?.primaryPoint?.objectName).toBe("AO_5");
  });

  test("viser full blueprint-topologi unntatt skjult pumpe", () => {
    const model = prepareAhuSchematicModel(buildAhuPresentationModel([]));
    expect(model.processSlots.some((slot) => slot.slotId === "heating.pump")).toBe(
      false,
    );
    expect(model.processSlots.length).toBe(AHU_BLUEPRINT_PROCESS_SLOTS.length - 1);
  });

  test("utleder LUKKET spjeld når KA-signaler mangler og anlegg står stoppet", () => {
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(STOPPED_SIGNALS, { elementKey: "360102" }),
    );

    const supplyDamper = model.processSlots.find(
      (slot) => slot.slotId === "supply.damper",
    );
    const exhaustDamper = model.processSlots.find(
      (slot) => slot.slotId === "exhaust.damper",
    );

    expect(supplyDamper?.confidence).toBe("inferred");
    expect(supplyDamper?.displayValue).toBe("LUKKET");
    expect(exhaustDamper?.displayValue).toBe("LUKKET");
    expect(model.summary.inferred).toBeGreaterThanOrEqual(2);
  });

  test("beholder exact spjeld når direkte signal finnes", () => {
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(
        [
          ...STOPPED_SIGNALS,
          point({
            objectId: "KA401",
            objectName: "KA401",
            unit: "boolean",
            lastValue: 1,
          }),
        ],
        { elementKey: "360102" },
      ),
    );

    const supplyDamper = model.processSlots.find(
      (slot) => slot.slotId === "supply.damper",
    );
    expect(supplyDamper?.confidence).toBe("exact");
  });

  test("viser idle for LX471 når varmegjenvinner-signaler mangler", () => {
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(STOPPED_SIGNALS, { elementKey: "360102" }),
      STOPPED_SIGNALS,
    );

    const hx = model.processSlots.find(
      (slot) => slot.slotId === "heat_recovery.unit",
    );
    expect(hx?.confidence).toBe("inferred");
    expect(hx?.displayValue).toBe("0 %");
    expect(hx?.stateLabel).toBe("Av");
    expect(hx?.displayLines.map((line) => line.label)).toEqual([
      "Hastighet",
      "Effektivitet",
    ]);
  });

  test("mapper LX471_C og LX471_KV til varmegjenvinner", () => {
    const signals = [
      ...STOPPED_SIGNALS,
      point({
        objectId: "LX471-C",
        objectName: "360102_LX471_C",
        unit: "percent",
        lastValue: 42,
      }),
      point({
        objectId: "LX471-KV",
        objectName: "360102_LX471_KV",
        unit: "percent",
        lastValue: 68,
      }),
    ];
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(signals, { elementKey: "360102" }),
      signals,
    );

    const hx = model.processSlots.find(
      (slot) => slot.slotId === "heat_recovery.unit",
    );
    expect(hx?.confidence).toMatch(/^(exact|alias)$/);
    expect(hx?.displayValue).toBe("42 %");
    expect(hx?.stateLabel).toBe("HØY 68 %");
    expect(hx?.displayLines.some((line) => line.label === "Hastighet")).toBe(true);
    expect(hx?.displayLines.some((line) => line.label === "Effektivitet")).toBe(
      true,
    );
  });

  test("viser ikke falsk hastighet når bare Efficiency finnes", () => {
    const signals = [
      ...STOPPED_SIGNALS,
      point({
        objectId: "LX471-KV",
        objectName: "Efficiency",
        unit: "percent",
        lastValue: 66,
      }),
    ];
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(signals, { elementKey: "360102" }),
      signals,
    );

    const hx = model.processSlots.find(
      (slot) => slot.slotId === "heat_recovery.unit",
    );
    expect(hx?.displayLines.map((line) => line.label)).toEqual(["Effektivitet"]);
    expect(hx?.displayLines[0]?.displayValue).toBe("HØY 66 %");
    expect(hx?.displayValue).toBe("HØY 66 %");
    expect(hx?.stateLabel).toBeNull();
  });

  test("utleder effektivitet fra temperaturer når Efficiency mangler", () => {
    const signals = [
      ...STOPPED_SIGNALS,
      point({
        objectId: "RT402",
        objectName: "AI_EfficiencyTemp",
        unit: "degrees-celsius",
        lastValue: 19.91,
      }),
      point({
        objectId: "RT901",
        objectName: "AI_IntakeAirTemp",
        unit: "degrees-celsius",
        lastValue: 15.04,
      }),
      point({
        objectId: "RT501",
        objectName: "AI_ExtractAirTemp",
        unit: "degrees-celsius",
        lastValue: 22.42,
      }),
    ];
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(signals, { elementKey: "360102" }),
      signals,
    );

    const hx = model.processSlots.find(
      (slot) => slot.slotId === "heat_recovery.unit",
    );
    expect(hx?.displayLines.map((line) => line.label)).toEqual(["Effektivitet"]);
    expect(hx?.displayLines[0]?.displayValue).toBe("HØY 66 %");
    expect(hx?.relatedPoints.map((point) => point.objectName)).toEqual([
      "AI_EfficiencyTemp",
      "AI_IntakeAirTemp",
      "AI_ExtractAirTemp",
    ]);
  });

  test("LX471_C med generic unit og FDV-beskrivelse gir Hastighet-linje", () => {
    const signals = [
      ...STOPPED_SIGNALS,
      point({
        objectId: "LX471-C",
        objectName: "360102_LX471_C",
        description: "Pådrag gjenvinner",
        unit: "generic",
        lastValue: 0,
      }),
      point({
        objectId: "LX471-KV",
        objectName: "Efficiency",
        unit: "generic",
        lastValue: 0,
      }),
    ];
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(signals, { elementKey: "360102" }),
      signals,
    );

    const hx = model.processSlots.find(
      (slot) => slot.slotId === "heat_recovery.unit",
    );
    const hast = hx?.displayLines.find((line) => line.label === "Hastighet");
    expect(hast?.displayValue).toBe("0 %");
  });
});
