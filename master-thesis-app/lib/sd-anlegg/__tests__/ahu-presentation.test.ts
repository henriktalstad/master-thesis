import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  AHU_BLUEPRINT_PROCESS_SLOTS,
  AHU_BLUEPRINT_STATUS_SLOTS,
} from "@/lib/sd-anlegg/ahu-blueprint";
import { buildAhuPresentationModel, filterSourceVisibleSlots } from "@/lib/sd-anlegg/ahu-equipment-identification";
import { applyPointMetadataOverridesToList } from "@/lib/sd-anlegg/point-metadata-overrides";
import { NAERBYEN_AUDIT_FIXTURES } from "../fixtures/naerbyen-audit-fixtures";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "360.102",
    objectId: "AI-1",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 1,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

/** BACnet-signaler fra Nærbyen 360.102 (live Infraspawn). */
const NAERBYEN_AI_SIGNALS: InfraspawnPointListItem[] = [
  point({
    objectId: "AV-1",
    objectName: "AI_EAFFLOW",
    unit: "cubic-meters-per-hour",
    lastValue: 0,
  }),
  point({
    objectId: "AV-2",
    objectName: "AI_EAFPressure",
    unit: "pascals",
    lastValue: -2,
  }),
  point({
    objectId: "AV-3",
    objectName: "AI_EfficiencyTemp",
    unit: "degrees-celsius",
    lastValue: 24.07,
  }),
  point({
    objectId: "AV-4",
    objectName: "AI_SAFFLOW",
    unit: "cubic-meters-per-hour",
    lastValue: 0,
  }),
  point({
    objectId: "AV-5",
    objectName: "AI_FilterGuard1",
    unit: "pascals",
    lastValue: -2,
  }),
  point({
    objectId: "AV-5b",
    objectName: "AI_FilterGuard2",
    unit: "pascals",
    lastValue: 0,
  }),
  point({
    objectId: "AV-6",
    objectName: "AI_SupplyAirTemp",
    unit: "degrees-celsius",
    lastValue: 22.97,
  }),
  point({
    objectId: "AV-7",
    objectName: "AI_IntakeAirTemp",
    unit: "degrees-celsius",
    lastValue: 21.7,
  }),
  point({
    objectId: "AV-8",
    objectName: "AI_ExtractAirTemp",
    unit: "degrees-celsius",
    lastValue: 25.2,
  }),
  point({
    objectId: "BO-601",
    objectName: "Systemstatus",
    unit: "boolean",
    lastValue: 0,
  }),
  point({
    objectId: "BO-602",
    objectName: "Frostrisk",
    unit: "boolean",
    lastValue: 0,
  }),
  point({
    objectId: "BO-sfp",
    objectName: "SFP",
    unit: "generic",
    lastValue: 0,
  }),
  point({
    objectId: "SP-402",
    objectName: "SupplySetpoint",
    unit: "degrees-celsius",
    lastValue: 18.1,
  }),
  point({
    objectId: "AM-1",
    objectName: "AirUnitAutoMode",
    unit: "boolean",
    lastValue: 0,
  }),
];

const NAERBYEN_AUDIT_POINTS: InfraspawnPointListItem[] =
  NAERBYEN_AUDIT_FIXTURES.map((fixture) =>
    point({
      objectId: fixture.objectId,
      objectName: fixture.objectName,
      description: fixture.description,
      unit: fixture.unit,
      lastValue: fixture.unit === "boolean" ? 0 : 1,
    }),
  );

/** Alle flate 360.102-signaler fra live Influx (unntatt spjeld). */
const NAERBYEN_FLAT_INFLUX: InfraspawnPointListItem[] = [
  ...NAERBYEN_AI_SIGNALS,
  point({ objectId: "AO-SAF", objectName: "AO_SAF", unit: "percent", lastValue: 0 }),
  point({ objectId: "AO-EAF", objectName: "AO_EAF", unit: "percent", lastValue: 0 }),
  point({ objectId: "DO-SAF", objectName: "DO_SAFStart", lastValue: 0 }),
  point({ objectId: "DO-EAF", objectName: "DO_EAFStart", lastValue: 0 }),
  point({ objectId: "AO-3", objectName: "AO_3", unit: "percent", lastValue: 0 }),
  point({ objectId: "AO-5", objectName: "AO_5", unit: "percent", lastValue: 0 }),
  point({ objectId: "DO-P1", objectName: "DO_SeqPumpY1", lastValue: 0 }),
  point({ objectId: "DO-P2", objectName: "DO_SeqPumpY2", lastValue: 0 }),
  point({ objectId: "EFF", objectName: "Efficiency", unit: "percent", lastValue: 50 }),
  point({
    objectId: "AV-FROST-T",
    objectName: "AI_FrostprotTemp1",
    unit: "degrees-celsius",
    lastValue: 22,
  }),
  point({
    objectId: "AV-EXT-SP",
    objectName: "ExtractSetpoint",
    unit: "degrees-celsius",
    lastValue: 23,
  }),
  point({
    objectId: "AV-PID",
    objectName: "SupplyPID_SetP",
    unit: "degrees-celsius",
    lastValue: 18,
  }),
  point({ objectId: "UM", objectName: "UnitMode", lastValue: 0 }),
  point({ objectId: "FG2", objectName: "AI_FilterGuard2", unit: "pascals", lastValue: 0 }),
];

const NAERBYEN_EQUIPMENT_TAG_POINTS: InfraspawnPointListItem[] = [
  point({
    objectId: "BO-401",
    objectName: "KA401",
    unit: "boolean",
    lastValue: 0,
  }),
  point({
    objectId: "AO-401",
    objectName: "SB401",
    unit: "percent",
    lastValue: 0,
  }),
  point({
    objectId: "AI-550",
    objectName: "RT550",
    unit: "degrees-celsius",
    lastValue: 42,
  }),
  point({
    objectId: "AI-402mv",
    objectName: "360.102RT402_MV",
    unit: "degrees-celsius",
    lastValue: 21.5,
  }),
];

describe("buildAhuPresentationModel", () => {
  test("har komplett statisk topologi selv når signaler mangler", () => {
    const model = buildAhuPresentationModel([]);

    expect(model.processSlots.length).toBe(AHU_BLUEPRINT_PROCESS_SLOTS.length);
    expect(model.statusSlots.length).toBe(AHU_BLUEPRINT_STATUS_SLOTS.length);
    expect(model.processSlots.every((slot) => slot.equipmentCode.length > 0)).toBe(
      true,
    );
    expect(model.summary.missing).toBe(model.summary.total);
  });

  test("mapper AI_*-signaler til utstyrskoder", () => {
    const model = buildAhuPresentationModel(NAERBYEN_AI_SIGNALS);

    const supplyFan = model.processSlots.find((slot) => slot.slotId === "supply.fan");
    const exhaustFan = model.processSlots.find((slot) => slot.slotId === "exhaust.fan");
    const supplyFilter = model.processSlots.find(
      (slot) => slot.slotId === "supply.filter",
    );
    const exhaustFilter = model.processSlots.find(
      (slot) => slot.slotId === "exhaust.filter",
    );
    const hx = model.processSlots.find(
      (slot) => slot.slotId === "heat_recovery.unit",
    );
    const supplyTemp = model.processSlots.find(
      (slot) => slot.slotId === "supply.temp_out",
    );
    const intakeTemp = model.processSlots.find(
      (slot) => slot.slotId === "supply.temp_in",
    );
    const exhaustTemp = model.processSlots.find(
      (slot) => slot.slotId === "exhaust.temp",
    );

    expect(supplyFan?.equipmentCode).toBe("JV401");
    expect(supplyFan?.primaryPoint?.objectName).toBe("AI_SAFFLOW");

    expect(exhaustFan?.equipmentCode).toBe("JV501");
    expect(exhaustFan?.primaryPoint?.objectName).toBe("AI_EAFFLOW");

    expect(supplyFilter?.equipmentCode).toBe("QD401");
    expect(supplyFilter?.primaryPoint?.objectName).toBe("AI_FilterGuard1");

    expect(exhaustFilter?.equipmentCode).toBe("QD501");
    expect(exhaustFilter?.primaryPoint?.objectName).toBe("AI_FilterGuard2");

    expect(exhaustFan?.relatedPoints.some(
      (point) => point.objectName === "AI_EAFPressure",
    )).toBe(true);

    expect(hx?.equipmentCode).toBe("LX471");
    expect(hx?.primaryPoint).toBeUndefined();

    const tempMid = model.processSlots.find(
      (slot) => slot.slotId === "supply.temp_mid",
    );
    expect(tempMid?.primaryPoint?.objectName).toBe("AI_EfficiencyTemp");

    expect(supplyTemp?.primaryPoint?.objectName).toBe("AI_SupplyAirTemp");
    expect(intakeTemp?.primaryPoint?.objectName).toBe("AI_IntakeAirTemp");
    expect(exhaustTemp?.primaryPoint?.objectName).toBe("AI_ExtractAirTemp");
  });

  test("prioriterer eksakte utstyrstagger over alias", () => {
    const points = [
      ...NAERBYEN_AI_SIGNALS,
      point({
        objectId: "JV401-exact",
        objectName: "JV401",
        unit: "cubic-meters-per-hour",
        lastValue: 1200,
      }),
    ];
    const model = buildAhuPresentationModel(points);
    const supplyFan = model.processSlots.find((slot) => slot.slotId === "supply.fan");

    expect(supplyFan?.primaryPoint?.objectName).toBe("JV401");
    expect(supplyFan?.confidence).toBe("exact");
  });

  test("statusstripe følger forventet rekkefølge med menneskelige tekster", () => {
    const model = buildAhuPresentationModel(NAERBYEN_AI_SIGNALS);
    expect(model.statusSlots.map((slot) => slot.slotId)).toEqual([
      "status.system",
      "status.schedule",
      "status.setpoint",
      "status.frost",
      "status.sfp",
    ]);
    expect(
      model.statusSlots.find((s) => s.slotId === "status.system")?.displayValue,
    ).toBe("Stoppet");
    expect(
      model.statusSlots.find((s) => s.slotId === "status.schedule")?.displayValue,
    ).toBe("Av");
    expect(
      model.statusSlots.find((s) => s.slotId === "status.frost")?.displayValue,
    ).toBe("Normal");
    expect(model.statusSlots.find((s) => s.slotId === "status.sfp")?.displayValue).toBe(
      "0",
    );
  });

  test("statusstripe viser UnitMode 4 som normal hastighet", () => {
    const model = buildAhuPresentationModel(
      [
        point({
          objectId: "MSVV-40396",
          objectName: "UnitMode",
          description: "Run mode.",
          unit: null,
          lastValue: 4,
        }),
      ],
      { elementKey: "360102" },
    );

    expect(
      model.statusSlots.find((slot) => slot.slotId === "status.system")
        ?.displayValue,
    ).toBe("Normal hastighet");
  });

  test("Kalkulert verdi bruker tilluft-SPK, ikke avtrekkssetpunkt", () => {
    const model = buildAhuPresentationModel(
      [
        point({
          objectId: "AV-EXT-SP",
          objectName: "ExtractSetpoint",
          unit: "degrees-celsius",
          lastValue: 23,
        }),
        point({
          objectId: "AV-PID",
          objectName: "SupplyPID_SetP",
          unit: "degrees-celsius",
          lastValue: 18.88,
        }),
        point({
          objectId: "spk",
          objectName: "360102_RT401_SPK",
          unit: "degrees-celsius",
          lastValue: 18.88,
        }),
        point({
          objectId: "SP-402",
          objectName: "SupplySetpoint",
          unit: "degrees-celsius",
          lastValue: 18.1,
        }),
      ],
      { elementKey: "360102" },
    );

    const setpoint = model.statusSlots.find((slot) => slot.slotId === "status.setpoint");
    expect(setpoint?.primaryPoint?.objectName).toBe("360102_RT401_SPK");
    expect(setpoint?.displayValue).toBe("18,9 °C");
  });

  test("ekskluderer tappevann 310.001SB501 fra AHU varmegren", () => {
    const model = buildAhuPresentationModel(
      [
        point({
          objectId: "tap-501",
          objectName: "310.001SB501_C",
          unit: "percent",
          lastValue: 45,
        }),
        point({
          objectId: "vent-501",
          objectName: "SB501",
          unit: "percent",
          lastValue: 12,
        }),
      ],
      { elementKey: "360102" },
    );

    const coolValve = model.processSlots.find(
      (slot) => slot.slotId === "heating.cool_valve",
    );
    expect(coolValve?.primaryPoint?.objectName).toBe("SB501");
    expect(coolValve?.confidence).toBe("exact");
  });

  test("ekskluderer utstyrstagger fra andre anleggsenheter", () => {
    const model = buildAhuPresentationModel(
      [
        point({
          objectId: "362.001RT601_MV",
          objectName: "362.001RT601_MV",
          unit: "degrees-celsius",
          lastValue: 22.5,
        }),
        point({
          objectId: "AV-6",
          objectName: "AI_SupplyAirTemp",
          unit: "degrees-celsius",
          lastValue: 22.97,
        }),
      ],
      { elementKey: "360102" },
    );

    const supplyTemp = model.processSlots.find(
      (slot) => slot.slotId === "supply.temp_out",
    );
    expect(supplyTemp?.primaryPoint?.objectName).toBe("AI_SupplyAirTemp");
  });

  test("global tildeling: KA501 til avtrekk når KA401 mangler", () => {
    const model = buildAhuPresentationModel(
      [
        point({
          objectId: "ka501",
          objectName: "KA501",
          unit: "boolean",
          lastValue: 0,
        }),
      ],
      { elementKey: "360102" },
    );

    expect(
      model.processSlots.find((slot) => slot.slotId === "exhaust.damper")
        ?.primaryPoint?.objectName,
    ).toBe("KA501");
    expect(
      model.processSlots.find((slot) => slot.slotId === "supply.damper")
        ?.confidence,
    ).toBe("missing");
  });

  test("global tildeling: KA401 og KA501 til riktige spjeld", () => {
    const model = buildAhuPresentationModel(
      [
        point({
          objectId: "ka401",
          objectName: "KA401",
          unit: "boolean",
          lastValue: 0,
        }),
        point({
          objectId: "ka501",
          objectName: "KA501",
          unit: "boolean",
          lastValue: 0,
        }),
      ],
      { elementKey: "360102" },
    );

    expect(
      model.processSlots.find((slot) => slot.slotId === "supply.damper")
        ?.primaryPoint?.objectName,
    ).toBe("KA401");
    expect(
      model.processSlots.find((slot) => slot.slotId === "exhaust.damper")
        ?.primaryPoint?.objectName,
    ).toBe("KA501");
  });

  test("BACnet-only dekning reflekterer produksjon", () => {
    const model = buildAhuPresentationModel(NAERBYEN_AI_SIGNALS);

    expect(model.summary.coveragePct).toBeGreaterThanOrEqual(60);
    expect(model.summary.coveragePct).toBeLessThanOrEqual(80);
  });

  test("full flat Influx-liste dekker alle slotter unntatt spjeld", () => {
    const model = buildAhuPresentationModel(NAERBYEN_FLAT_INFLUX, {
      elementKey: "360102",
    });

    expect(model.summary.missing).toBe(2);
    expect(
      model.processSlots.find((slot) => slot.slotId === "heating.pump")?.primaryPoint
        ?.objectName,
    ).toBe("DO_SeqPumpY1");
    expect(model.summary.coveragePct).toBe(90);
  });

  test("audit-fixtures + BACnet dekker ~80 %", () => {
    const model = buildAhuPresentationModel([
      ...NAERBYEN_AI_SIGNALS,
      ...NAERBYEN_AUDIT_POINTS,
    ]);

    expect(model.summary.coveragePct).toBeGreaterThanOrEqual(75);
    expect(model.summary.coveragePct).toBeLessThanOrEqual(85);
  });

  test("med utstyrstagger når ≥85 % dekning", () => {
    const model = buildAhuPresentationModel([
      ...NAERBYEN_AI_SIGNALS,
      ...NAERBYEN_AUDIT_POINTS,
      ...NAERBYEN_EQUIPMENT_TAG_POINTS,
    ]);

    expect(model.summary.coveragePct).toBeGreaterThanOrEqual(85);
    expect(
      model.processSlots.some(
        (slot) => slot.slotId === "supply.fan" && slot.primaryPoint != null,
      ),
    ).toBe(true);
    expect(
      model.processSlots.some(
        (slot) => slot.slotId === "exhaust.fan" && slot.primaryPoint != null,
      ),
    ).toBe(true);
    expect(
      model.processSlots.some(
        (slot) => slot.slotId === "exhaust.damper" && slot.displayValue === "LUKKET",
      ),
    ).toBe(true);
    expect(
      model.processSlots.some((slot) => slot.displayLines.length > 0),
    ).toBe(true);
  });

  test("metadata-override på flatt AI_* gir RT401 exact via utstyrstag", () => {
    const flatPoint = NAERBYEN_AI_SIGNALS.find(
      (point) => point.objectName === "AI_SupplyAirTemp",
    );
    expect(flatPoint).toBeDefined();

    const effective = applyPointMetadataOverridesToList(
      NAERBYEN_AI_SIGNALS,
      [
        {
          sourceId: flatPoint!.sourceId,
          objectId: flatPoint!.objectId,
          objectName: "360102_RT401_PV",
          description: "Temp. tilluft",
        },
      ],
    );

    const model = buildAhuPresentationModel(effective, {
      elementKey: "360102",
    });
    const rt401 = model.processSlots.find(
      (slot) => slot.slotId === "supply.temp_out",
    );

    expect(rt401?.primaryPoint?.objectName).toBe("360102_RT401_PV");
    expect(rt401?.confidence).toBe("exact");
  });

  test("schemaSlotId override binder eksplisitt slot", () => {
    const flatPoint = NAERBYEN_AI_SIGNALS[0]!;
    const schemaSlotOverrides = new Map([
      [`${flatPoint.sourceId}:${flatPoint.objectId}`, "supply.temp_out"],
    ]);

    const model = buildAhuPresentationModel(NAERBYEN_AI_SIGNALS, {
      elementKey: "360102",
      schemaSlotOverrides,
    });

    expect(
      model.processSlots.find((slot) => slot.slotId === "supply.temp_out")
        ?.primaryPoint?.objectId,
    ).toBe(flatPoint.objectId);
    expect(
      model.processSlots.find((slot) => slot.slotId === "supply.temp_out")
        ?.confidence,
    ).toBe("exact");
  });
});

describe("filterSourceVisibleSlots", () => {
  test("skjuler slotter uten kilde-binding", () => {
    const full = buildAhuPresentationModel([]);
    const visible = filterSourceVisibleSlots(full);

    expect(full.processSlots.length).toBe(AHU_BLUEPRINT_PROCESS_SLOTS.length);
    expect(visible.processSlots.length).toBe(0);
    expect(visible.statusSlots.length).toBe(0);
  });

  test("viser kun bundne prosess- og status-slotter", () => {
    const full = buildAhuPresentationModel(NAERBYEN_FLAT_INFLUX, {
      elementKey: "360102",
    });
    const visible = filterSourceVisibleSlots(full);

    expect(visible.processSlots.every((slot) => slot.confidence !== "missing")).toBe(
      true,
    );
    expect(
      visible.processSlots.some((slot) => slot.slotId === "supply.damper"),
    ).toBe(false);
    expect(visible.statusSlots.length).toBeGreaterThan(0);
    expect(visible.summary).toEqual(full.summary);
  });
});

describe("multi-signal vifte", () => {
  test("samler flow og pådrag i displayLines", () => {
    const model = buildAhuPresentationModel(NAERBYEN_FLAT_INFLUX, {
      elementKey: "360102",
    });
    const supplyFan = model.processSlots.find((slot) => slot.slotId === "supply.fan");
    const exhaustFan = model.processSlots.find((slot) => slot.slotId === "exhaust.fan");

    expect(supplyFan?.displayLines.length).toBeGreaterThanOrEqual(2);
    expect(
      supplyFan?.displayLines.some((line) =>
        (line.point?.objectName ?? "").includes("SAFFLOW"),
      ),
    ).toBe(true);
    expect(
      supplyFan?.displayLines.some((line) => line.point?.objectName === "AO_SAF"),
    ).toBe(true);

    expect(exhaustFan?.displayLines.length).toBeGreaterThanOrEqual(2);
    expect(
      exhaustFan?.displayLines.some((line) => line.point?.objectName === "AO_EAF"),
    ).toBe(true);
  });
});
