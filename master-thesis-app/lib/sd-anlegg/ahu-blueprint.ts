import type { SdComponentType } from "./component-types";
import {
  PROCESS_DUCT_GEOMETRY,
  PROCESS_FILTER_SLOT_X,
  PROCESS_HEATING_SLOT_ANCHORS,
  processSchematicPercentX,
} from "./process-schematic-geometry";

export type AhuSlotRole =
  | "damper"
  | "fan"
  | "filter"
  | "pressure"
  | "temp"
  | "hx"
  | "coil"
  | "pump"
  | "valve"
  | "status";

export type AhuLane =
  | "exhaust"
  | "supply"
  | "heatRecovery"
  | "heating"
  | "status";

export type AhuLabelPosition = "above" | "below";

/** Fast topologi for dual-duct AHU — koordinater i prosent (0–100). */
export type AhuBlueprintSlotDef = {
  slotId: string;
  equipmentCode: string;
  alternateEquipmentCodes?: readonly string[];
  role: AhuSlotRole;
  lane: AhuLane;
  componentType: SdComponentType;
  label?: string;
  x: number;
  y: number;
  labelPosition: AhuLabelPosition;
};

export type AhuStatusSlotDef = {
  slotId: string;
  label: string;
  equipmentCode?: string;
  signalPatterns: readonly string[];
  order: number;
};

export const AHU_BLUEPRINT_CANVAS = {
  width: 1000,
  height: 520,
} as const;

/** Avtrekk øverst (høyre→venstre visuelt), tilluft nederst, VGX midt. */
export const AHU_BLUEPRINT_PROCESS_SLOTS: readonly AhuBlueprintSlotDef[] = [
  {
    slotId: "exhaust.temp",
    equipmentCode: "RT501",
    alternateEquipmentCodes: ["RT901"],
    role: "temp",
    lane: "exhaust",
    componentType: "sensor.temperature",
    label: "Temp. avtrekk",
    x: processSchematicPercentX(136),
    y: 14,
    labelPosition: "above",
  },
  {
    slotId: "exhaust.filter",
    equipmentCode: "QD501",
    role: "filter",
    lane: "exhaust",
    componentType: "ventilation.filter",
    label: "Filtervakt avtrekk",
    x: PROCESS_FILTER_SLOT_X,
    y: 14,
    labelPosition: "above",
  },
  {
    slotId: "heat_recovery.unit",
    equipmentCode: "LX471",
    role: "hx",
    lane: "heatRecovery",
    componentType: "ventilation.heat_recovery",
    label: "Varmegjenvinner",
    x: processSchematicPercentX(
      PROCESS_DUCT_GEOMETRY.hxX + PROCESS_DUCT_GEOMETRY.hxWidth / 2,
    ),
    y: 22,
    labelPosition: "above",
  },
  {
    slotId: "exhaust.fan",
    equipmentCode: "JV501",
    alternateEquipmentCodes: ["JV502"],
    role: "fan",
    lane: "exhaust",
    componentType: "ventilation.fan",
    label: "Avtrekksvifte",
    x: 67,
    y: 14,
    labelPosition: "above",
  },
  {
    slotId: "exhaust.damper",
    equipmentCode: "KA501",
    alternateEquipmentCodes: ["KA502"],
    role: "damper",
    lane: "exhaust",
    componentType: "ventilation.damper",
    label: "Spjeld avkast",
    x: 89,
    y: 14,
    labelPosition: "above",
  },
  {
    slotId: "supply.damper",
    equipmentCode: "KA401",
    alternateEquipmentCodes: ["KA501"],
    role: "damper",
    lane: "supply",
    componentType: "ventilation.damper",
    label: "Spjeld inntak",
    x: 16,
    y: 58,
    labelPosition: "below",
  },
  {
    slotId: "supply.filter",
    equipmentCode: "QD401",
    role: "filter",
    lane: "supply",
    componentType: "ventilation.filter",
    label: "Filtervakt inntak",
    x: PROCESS_FILTER_SLOT_X,
    y: 58,
    labelPosition: "below",
  },
  {
    slotId: "supply.temp_in",
    equipmentCode: "RT901",
    alternateEquipmentCodes: ["RT501"],
    role: "temp",
    lane: "supply",
    componentType: "sensor.temperature",
    label: "Temp. inntak",
    x: 36,
    y: 58,
    labelPosition: "below",
  },
  {
    slotId: "supply.temp_mid",
    equipmentCode: "RT402",
    role: "temp",
    lane: "supply",
    componentType: "sensor.temperature",
    label: "Temp. etter VGX",
    x: 70,
    y: 58,
    labelPosition: "below",
  },
  {
    slotId: "heating.pump",
    equipmentCode: "JP401",
    alternateEquipmentCodes: [],
    role: "pump",
    lane: "heating",
    componentType: "hvac.pump",
    label: "Sirkulasjonspumpe",
    x: PROCESS_HEATING_SLOT_ANCHORS.pump.x,
    y: PROCESS_HEATING_SLOT_ANCHORS.pump.y,
    labelPosition: "above",
  },
  {
    slotId: "heating.valve",
    equipmentCode: "SB401",
    role: "valve",
    lane: "heating",
    componentType: "hvac.valve",
    label: "Varmeventil",
    x: PROCESS_HEATING_SLOT_ANCHORS.valve.x,
    y: PROCESS_HEATING_SLOT_ANCHORS.valve.y,
    labelPosition: "below",
  },
  {
    slotId: "heating.temp",
    equipmentCode: "RT550",
    role: "temp",
    lane: "heating",
    componentType: "sensor.temperature",
    label: "Frost varmebatteri",
    x: PROCESS_HEATING_SLOT_ANCHORS.temp.x,
    y: PROCESS_HEATING_SLOT_ANCHORS.temp.y,
    labelPosition: "below",
  },
  {
    slotId: "heating.cool_valve",
    equipmentCode: "SB501",
    role: "coil",
    lane: "heating",
    componentType: "hvac.coil",
    label: "Kjølebatteri",
    x: PROCESS_HEATING_SLOT_ANCHORS.coolValve.x,
    y: PROCESS_HEATING_SLOT_ANCHORS.coolValve.y,
    labelPosition: "below",
  },
  {
    slotId: "supply.fan",
    equipmentCode: "JV401",
    alternateEquipmentCodes: ["JV402"],
    role: "fan",
    lane: "supply",
    componentType: "ventilation.fan",
    label: "Tilluftsvifte",
    x: 86,
    y: 58,
    labelPosition: "below",
  },
  {
    slotId: "supply.temp_out",
    equipmentCode: "RT401",
    alternateEquipmentCodes: ["RT501"],
    role: "temp",
    lane: "supply",
    componentType: "sensor.temperature",
    label: "Temp. tilluft",
    x: 95,
    y: 58,
    labelPosition: "below",
  },
];

export const AHU_BLUEPRINT_STATUS_SLOTS: readonly AhuStatusSlotDef[] = [
  {
    slotId: "status.system",
    label: "Systemstatus",
    signalPatterns: [
      "Systemstatus",
      "UnitMode",
      "SYSTEMSTATUS",
      "Plantmode",
      "360102_Plantmode_KV",
    ],
    order: 0,
  },
  {
    slotId: "status.schedule",
    label: "Tidsprogram",
    signalPatterns: [
      "Tidsprogram",
      "TimeSchedule",
      "Schedule",
      "AirUnitAutoMode",
      "EAFAutoMode",
      "SAFAutoMode",
    ],
    order: 1,
  },
  {
    slotId: "status.setpoint",
    label: "Kalkulert verdi",
    signalPatterns: [
      "360102_RT401_SPK",
      "SupplyPID_SetP",
      "CalculatedValue",
      "Kalkulert",
      "360102_RT401_SP",
      "SupplySetpoint",
      "RT402_SP",
      "310.001RT402_SP",
    ],
    order: 2,
  },
  {
    slotId: "status.frost",
    label: "Frostvakt",
    signalPatterns: ["Frostvakt", "Frostrisk", "360102_FROST"],
    order: 3,
  },
  {
    slotId: "status.sfp",
    label: "SFP",
    signalPatterns: ["SFP", "RT402_SPF", "SpecificFanPower"],
    order: 4,
  },
];

export {
  AHU_SIGNAL_ALIAS_REGISTRY,
  AHU_SIGNAL_ALIAS_TO_SLOT,
  resolveAhuSignalAliasSlotId,
  resolveAhuSignalFdvDescription,
} from "./ahu-signal-alias-registry";

export function resolveAhuBlueprintEquipmentCodes(
  def: AhuBlueprintSlotDef,
): string[] {
  return [def.equipmentCode, ...(def.alternateEquipmentCodes ?? [])];
}
