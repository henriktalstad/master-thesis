import { formatInfraspawnPointValue } from "@/lib/infraspawn/display-format";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { formatHeatingPointDisplayValue } from "./format-heating-display";
import {
  formatHeatingCirculationPumpMode,
  resolveHeatingExactPointLabel,
} from "./heating-signal-vocabulary";
import type { SdComponentType } from "./component-types";

export type HeatingProcessSlot = {
  slotId: string;
  equipmentCode: string;
  label: string;
  componentType: SdComponentType;
  displayValue: string | null;
  stateLabel?: string | null;
  primaryPoint?: InfraspawnPointListItem;
  relatedPoints: InfraspawnPointListItem[];
  confidence: "exact" | "missing";
  alarm: boolean;
};

function findByName(
  points: readonly InfraspawnPointListItem[],
  pattern: RegExp | string,
): InfraspawnPointListItem | undefined {
  if (typeof pattern === "string") {
    return points.find((p) => p.objectName === pattern);
  }
  return points.find((p) => pattern.test(p.objectName ?? ""));
}

function formatValue(point: InfraspawnPointListItem | undefined): string | null {
  if (!point) return null;
  const heating = formatHeatingPointDisplayValue(point);
  if (heating) return heating;
  if (point.lastValue == null) return null;
  return formatInfraspawnPointValue(point.lastValue, point.unit, point);
}

function toSlot(
  slotId: string,
  equipmentCode: string,
  label: string,
  componentType: SdComponentType,
  point: InfraspawnPointListItem | undefined,
): HeatingProcessSlot {
  const exactLabel = point?.objectName
    ? resolveHeatingExactPointLabel(point.objectName)
    : null;
  const resolvedLabel = exactLabel ?? label;
  return {
    slotId,
    equipmentCode,
    label: resolvedLabel,
    componentType,
    displayValue: formatValue(point),
    primaryPoint: point,
    relatedPoints: point ? [point] : [],
    confidence: point ? "exact" : "missing",
    alarm: Boolean(point?.statusInAlarm),
  };
}

function pumpSlot(
  slotId: string,
  equipmentCode: string,
  points: readonly InfraspawnPointListItem[],
  prefix: string,
): HeatingProcessSlot {
  const related = points.filter((p) =>
    (p.objectName ?? "").toUpperCase().includes(prefix.toUpperCase()),
  );
  const modePoint =
    related.find((p) => /_KOM\b/i.test(p.objectName ?? "")) ??
    related.find((p) => /_S\b/i.test(p.objectName ?? ""));
  const runPoint = related.find((p) => /_A\b/i.test(p.objectName ?? ""));
  const primary = modePoint ?? runPoint ?? related[0];

  const modeLabel = modePoint
    ? formatHeatingCirculationPumpMode(modePoint)
    : null;
  const runLabel = runPoint ? formatHeatingCirculationPumpMode(runPoint) : null;
  const displayValue =
    modeLabel ??
    runLabel ??
    (primary ? formatValue(primary) : null);
  const stateLabel =
    modePoint && runPoint && runLabel && runLabel !== displayValue
      ? runLabel
      : null;

  const base = toSlot(slotId, equipmentCode, "Pumpe", "hvac.pump", primary);
  return {
    ...base,
    displayValue,
    stateLabel,
    relatedPoints: related,
  };
}

export function resolveHeatingEquipmentDisplay(slot: HeatingProcessSlot): {
  displayLines: Array<{ displayValue: string; role: "value" | "command" }>;
  stateLabel?: string | null;
} {
  if (
    slot.componentType === "hvac.pump" &&
    slot.displayValue &&
    slot.stateLabel &&
    slot.stateLabel !== slot.displayValue
  ) {
    const isRunState = (value: string) => /^(AV|PÅ)$/i.test(value.trim());
    const mode = isRunState(slot.displayValue)
      ? slot.stateLabel
      : slot.displayValue;
    const run = isRunState(slot.displayValue)
      ? slot.displayValue
      : slot.stateLabel;

    return {
      displayLines: [
        { displayValue: mode, role: "value" },
        { displayValue: run, role: "command" },
      ],
      stateLabel: null,
    };
  }

  if (slot.displayValue) {
    return {
      displayLines: [{ displayValue: slot.displayValue, role: "value" }],
      stateLabel: slot.stateLabel,
    };
  }

  if (slot.stateLabel) {
    return {
      displayLines: [{ displayValue: slot.stateLabel, role: "command" }],
      stateLabel: null,
    };
  }

  return { displayLines: [], stateLabel: null };
}

export type HeatingCombinedBranch = {
  id: "residential" | "commercial";
  title: string;
  elementLabel: string;
  heatExchangerLabel: string;
  oe: {
    supply: HeatingProcessSlot;
    return: HeatingProcessSlot;
    power: HeatingProcessSlot;
    energy: HeatingProcessSlot;
  };
  valve: HeatingProcessSlot;
  pump1: HeatingProcessSlot;
  pump2: HeatingProcessSlot;
  supplyTemp: HeatingProcessSlot;
  returnTemp: HeatingProcessSlot;
  pressure: HeatingProcessSlot | null;
  setpoint: HeatingProcessSlot;
};

export type HeatingCombinedPresentationModel = {
  outdoorTemp: HeatingProcessSlot | null;
  branches: HeatingCombinedBranch[];
  tapWaterLink: { label: string; liveTemp: string | null } | null;
};

export function buildHeatingCombinedPresentationModel(
  points: readonly InfraspawnPointListItem[],
): HeatingCombinedPresentationModel {
  const outdoorPoint = findByName(points, "320.001RT901_MV");
  const outdoorTemp = outdoorPoint
    ? toSlot(
        "outdoor",
        "RT901",
        "Utetemperatur",
        "sensor.temperature",
        outdoorPoint,
      )
    : null;

  const residential: HeatingCombinedBranch = {
    id: "residential",
    title: "320.002 Boligdel",
    elementLabel: "320.002",
    heatExchangerLabel: "LV002",
    oe: {
      supply: toSlot(
        "res.oe.supply",
        "OE001",
        "Primær tur",
        "sensor.temperature",
        findByName(points, "320001OE001_turtemp"),
      ),
      return: toSlot(
        "res.oe.return",
        "OE001",
        "Primær retur",
        "sensor.temperature",
        findByName(points, "320001OE001_returtemp"),
      ),
      power: toSlot(
        "res.oe.power",
        "OE001",
        "Effekt",
        "generic.signal",
        findByName(points, "320001OE001_effekt"),
      ),
      energy: toSlot(
        "res.oe.energy",
        "OE001",
        "Energi",
        "generic.signal",
        findByName(points, "320001OE001_energi"),
      ),
    },
    valve: toSlot(
      "res.valve",
      "SB502",
      "Varmeventil",
      "hvac.valve",
      findByName(points, "320.002SB502_C"),
    ),
    pump1: pumpSlot("res.pump1", "JP401", points, "320.002JP401"),
    pump2: pumpSlot("res.pump2", "JP402", points, "320.002JP402"),
    supplyTemp: toSlot(
      "res.supply",
      "RT402",
      "Sek. tur ut",
      "sensor.temperature",
      findByName(points, "320.002RT402_MV"),
    ),
    returnTemp: toSlot(
      "res.return",
      "RT502",
      "Retur ut",
      "sensor.temperature",
      findByName(points, "320.002RT502_MV"),
    ),
    pressure: toSlot(
      "res.pressure",
      "RP403",
      "Trykk",
      "sensor.pressure",
      findByName(points, "320.002RP403_MV"),
    ),
    setpoint: toSlot(
      "res.setpoint",
      "SPK",
      "Settpunkt",
      "sensor.temperature",
      findByName(points, "320.002RT402_SPK"),
    ),
  };

  const commercial: HeatingCombinedBranch = {
    id: "commercial",
    title: "320.003 Næringsdel",
    elementLabel: "320.003",
    heatExchangerLabel: "LV003",
    oe: {
      supply: toSlot(
        "com.oe.supply",
        "OE001",
        "Primær tur",
        "sensor.temperature",
        findByName(points, "320003OE001_turtemp"),
      ),
      return: toSlot(
        "com.oe.return",
        "OE001",
        "Primær retur",
        "sensor.temperature",
        findByName(points, "320003OE001_returtemp"),
      ),
      power: toSlot(
        "com.oe.power",
        "OE001",
        "Effekt",
        "generic.signal",
        findByName(points, "320003OE001_effekt"),
      ),
      energy: toSlot(
        "com.oe.energy",
        "OE001",
        "Energi",
        "generic.signal",
        findByName(points, "320003OE001_energi"),
      ),
    },
    valve: toSlot(
      "com.valve",
      "SB502",
      "Varmeventil",
      "hvac.valve",
      findByName(points, "320.003SB502_C"),
    ),
    pump1: pumpSlot("com.pump1", "JP401", points, "320.003JP401"),
    pump2: pumpSlot("com.pump2", "JP402", points, "320.003JP402"),
    supplyTemp: toSlot(
      "com.supply",
      "RT402",
      "Sek. tur ut",
      "sensor.temperature",
      findByName(points, "320.003RT402_MV"),
    ),
    returnTemp: toSlot(
      "com.return",
      "RT502",
      "Retur ut",
      "sensor.temperature",
      findByName(points, "320.003RT502_MV"),
    ),
    pressure: null,
    setpoint: toSlot(
      "com.setpoint",
      "SPK",
      "Settpunkt",
      "sensor.temperature",
      findByName(points, "320.003RT402_SPK"),
    ),
  };

  const tapMv = findByName(points, "310.001RT402_MV");

  return {
    outdoorTemp,
    branches: [residential, commercial],
    tapWaterLink: tapMv
      ? {
          label: "310.001 Forbruksvann",
          liveTemp: formatValue(tapMv),
        }
      : null,
  };
}

export type TapWaterPresentationModel = {
  supplyTemp: HeatingProcessSlot;
  setpoint: HeatingProcessSlot;
  valve: HeatingProcessSlot;
  pump: HeatingProcessSlot;
};

export function buildTapWaterPresentationModel(
  points: readonly InfraspawnPointListItem[],
): TapWaterPresentationModel {
  return {
    supplyTemp: toSlot(
      "tap.supply",
      "RT402",
      "Tur tappevann",
      "sensor.temperature",
      findByName(points, "310.001RT402_MV"),
    ),
    setpoint: toSlot(
      "tap.setpoint",
      "TR001",
      "Settpunkt TR001",
      "sensor.temperature",
      findByName(points, "310.001RT402_SP"),
    ),
    valve: toSlot(
      "tap.valve",
      "SB501",
      "Tappevannsventil",
      "hvac.valve",
      findByName(points, "310.001SB501_C"),
    ),
    pump: pumpSlot("tap.pump", "JP501", points, "310.001JP501"),
  };
}

export type SumpPitBranch = {
  id: "building_a" | "building_b";
  title: string;
  pumpCode: string;
  drift: HeatingProcessSlot;
  alarm: HeatingProcessSlot;
};

export type SumpPitsPresentationModel = {
  pits: SumpPitBranch[];
};

export function buildSumpPitsPresentationModel(
  points: readonly InfraspawnPointListItem[],
): SumpPitsPresentationModel {
  return {
    pits: [
      {
        id: "building_a",
        title: "Bygg A",
        pumpCode: "JP001",
        drift: toSlot(
          "pit.a.drift",
          "JP001",
          "Drift",
          "hvac.pump",
          findByName(points, "310.010JP001_D"),
        ),
        alarm: toSlot(
          "pit.a.alarm",
          "JP001",
          "Alarm",
          "binary.status",
          findByName(points, "310.010JP001_A"),
        ),
      },
      {
        id: "building_b",
        title: "Bygg B",
        pumpCode: "JP002",
        drift: toSlot(
          "pit.b.drift",
          "JP002",
          "Drift",
          "hvac.pump",
          findByName(points, "310.010JP002_D"),
        ),
        alarm: toSlot(
          "pit.b.alarm",
          "JP002",
          "Alarm",
          "binary.status",
          findByName(points, "310.010JP002_A"),
        ),
      },
    ],
  };
}

export function resolveHeatingHistoryGroup(
  slotId: string,
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem[] {
  const namesBySlot: Record<string, readonly string[]> = {
    "res.regulation": [
      "320.002RT402_MV",
      "320.002RT502_MV",
      "320.002SB502_C",
      "320.002RT402_SPK",
    ],
    "com.regulation": [
      "320.003RT402_MV",
      "320.003RT502_MV",
      "320.003SB502_C",
      "320.003RT402_SPK",
    ],
    "tap.regulation": [
      "310.001RT402_MV",
      "310.001RT402_SP",
      "310.001SB501_C",
    ],
    "res.oe": [
      "320001OE001_turtemp",
      "320001OE001_returtemp",
      "320001OE001_effekt",
    ],
    "com.oe": [
      "320003OE001_turtemp",
      "320003OE001_returtemp",
      "320003OE001_effekt",
    ],
  };

  const names = namesBySlot[slotId];
  if (!names) return [];

  return names
    .map((name) => points.find((p) => p.objectName === name))
    .filter((p): p is InfraspawnPointListItem => Boolean(p));
}
