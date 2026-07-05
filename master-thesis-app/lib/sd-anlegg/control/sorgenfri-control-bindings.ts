import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { BUILDING_CONTROL_PROFILE_360102 } from "./building-control-profile";
import type { ControlSignalBinding } from "./control-signal-bindings";

/** Case-bygg for masteroppgaven — Sorgenfri 32, AHU 360.102. */
export const SORGENFRI_BUILDING_SLUG =
  BUILDING_CONTROL_PROFILE_360102.buildingSlug;

export const SORGENFRI_VENTILATION_UNIT_KEY = "360102";

export type SorgenfriControlBindingSpec = {
  canonicalId: string;
  objectNames: readonly string[];
  slotId?: string;
};

/**
 * Kuraterte signal→canonical for Sorgenfri.
 * Kilde: data/processed/signal_registry.csv + Infraspawn audit (123 punkter).
 */
export const SORGENFRI_CONTROL_BINDING_SPECS: readonly SorgenfriControlBindingSpec[] =
  [
    {
      canonicalId: "supply.setpoint",
      objectNames: ["SupplySetpoint", "360102_RT401_SP"],
      slotId: "status.setpoint",
    },
    {
      canonicalId: "supply.setpoint_calculated",
      objectNames: ["SupplyPID_SetP", "360102_RT401_SPK"],
    },
    {
      canonicalId: "extract.setpoint",
      objectNames: ["ExtractSetpoint", "360102_RT501_SP"],
    },
    {
      canonicalId: "supply.temp",
      objectNames: ["AI_SupplyAirTemp", "360102_RT401_PV"],
      slotId: "supply.temp_out",
    },
    {
      canonicalId: "extract.temp",
      objectNames: ["AI_ExtractAirTemp", "360102_RT501_PV"],
      slotId: "exhaust.temp",
    },
    {
      canonicalId: "intake.temp",
      objectNames: ["AI_IntakeAirTemp", "360102_RT901_MV"],
      slotId: "supply.temp_in",
    },
    {
      canonicalId: "outdoor.temp",
      objectNames: ["320.001RT901_MV", "AI-2"],
    },
    {
      canonicalId: "heating.coil_temp",
      objectNames: ["AI_FrostprotTemp1", "360102_RT550_MV"],
      slotId: "heating.temp",
    },
    {
      canonicalId: "heat_recovery.after_temp",
      objectNames: ["AI_EfficiencyTemp", "360102_RT402_MV"],
      slotId: "supply.temp_mid",
    },
    {
      canonicalId: "supply.fan.command",
      objectNames: ["AO_SAF", "360102_JV401_C"],
      slotId: "supply.fan",
    },
    {
      canonicalId: "exhaust.fan.command",
      objectNames: ["AO_EAF", "360102_JV501_C"],
      slotId: "exhaust.fan",
    },
    {
      canonicalId: "supply.fan.flow",
      objectNames: ["AI_SAFFlow", "360102_JV401_KV"],
      slotId: "supply.fan",
    },
    {
      canonicalId: "exhaust.fan.flow",
      objectNames: ["AI_EAFFlow", "360102_JV501_KV"],
      slotId: "exhaust.fan",
    },
    {
      canonicalId: "heat_recovery.efficiency",
      objectNames: ["Efficiency", "360102_LX471_KV"],
    },
    {
      canonicalId: "constraint.low_efficiency",
      objectNames: ["Lowefficiency"],
    },
    {
      canonicalId: "heat_recovery.rotation_guard",
      objectNames: ["Rotationguardexchanger"],
      slotId: "heat_recovery.unit",
    },
    {
      canonicalId: "heating.pump.malfunction",
      objectNames: ["Malf_pumpheater", "360102_JP401_A"],
      slotId: "heating.pump",
    },
    {
      canonicalId: "cooling.pump.malfunction",
      objectNames: ["Malf_pumpcooler", "360102_JP501_A"],
      slotId: "heating.pump",
    },
    {
      canonicalId: "heating.valve.command",
      objectNames: ["AO_3", "360102_SB401_C"],
      slotId: "heating.valve",
    },
    {
      canonicalId: "district.tr002.valve.command",
      objectNames: ["320.002SB502_C"],
    },
    {
      canonicalId: "district.tr003.valve.command",
      objectNames: ["320.003SB502_C"],
    },
    {
      canonicalId: "district.tr002.supply.temp",
      objectNames: ["320.002RT402_MV"],
    },
    {
      canonicalId: "district.tr003.supply.temp",
      objectNames: ["320.003RT402_MV"],
    },
    {
      canonicalId: "district.tr002.return.temp",
      objectNames: ["320.002RT502_MV"],
    },
    {
      canonicalId: "district.tr003.return.temp",
      objectNames: ["320.003RT502_MV"],
    },
    {
      canonicalId: "district.tr002.supply.setpoint",
      objectNames: ["320.002RT402_SPK"],
    },
    {
      canonicalId: "district.tr003.supply.setpoint",
      objectNames: ["320.003RT402_SPK"],
    },
    {
      canonicalId: "district.meter.tr002.energy",
      objectNames: ["320001OE001_energi"],
    },
    {
      canonicalId: "district.meter.tr002.power",
      objectNames: ["320001OE001_effekt"],
    },
    {
      canonicalId: "district.meter.tr002.supply.temp",
      objectNames: ["320001OE001_turtemp"],
    },
    {
      canonicalId: "district.meter.tr002.return.temp",
      objectNames: ["320001OE001_returtemp"],
    },
    {
      canonicalId: "district.meter.tr003.energy",
      objectNames: ["320003OE001_energi"],
    },
    {
      canonicalId: "district.meter.tr003.power",
      objectNames: ["320003OE001_effekt"],
    },
    {
      canonicalId: "district.meter.tr003.supply.temp",
      objectNames: ["320003OE001_turtemp"],
    },
    {
      canonicalId: "district.meter.tr003.return.temp",
      objectNames: ["320003OE001_returtemp"],
    },
    {
      canonicalId: "district.tr002.pump.status",
      objectNames: ["320.002JP401_S"],
    },
    {
      canonicalId: "district.tr003.pump.status",
      objectNames: ["320.003JP401_S"],
    },
    {
      canonicalId: "cooling.valve.command",
      objectNames: ["AO_5", "360102_SB501_C"],
      slotId: "heating.cool_valve",
    },
    {
      canonicalId: "cooling.valve.position",
      objectNames: ["AO_4", "360102_SB501_C"],
    },
    {
      canonicalId: "constraint.frost",
      objectNames: ["Frostrisk", "360102_FROST"],
      slotId: "status.frost",
    },
    {
      canonicalId: "constraint.fire",
      objectNames: ["Firealarm", "360102_BRANNALARM"],
    },
    {
      canonicalId: "supply.fan.pressure",
      objectNames: ["AI_SAFPressure", "360102_JV401_PV"],
      slotId: "supply.fan",
    },
    {
      canonicalId: "exhaust.fan.pressure",
      objectNames: ["AI_EAFPressure", "360102_JV501_PV"],
      slotId: "exhaust.fan",
    },
    {
      canonicalId: "supply.filter.pressure",
      objectNames: ["AI_FilterGuard1", "360102_QD401_PV"],
      slotId: "supply.filter",
    },
    {
      canonicalId: "exhaust.filter.pressure",
      objectNames: ["AI_FilterGuard2", "360102_QD501_PV"],
      slotId: "exhaust.filter",
    },
    {
      canonicalId: "ventilation.sfp",
      objectNames: ["SFP", "360102_SFP"],
      slotId: "status.sfp",
    },
    {
      canonicalId: "supply.fan.mode",
      objectNames: ["SAFAutoMode", "360102_JV401_KMD"],
      slotId: "supply.fan",
    },
    {
      canonicalId: "exhaust.fan.mode",
      objectNames: ["EAFAutoMode", "360102_JV501_KMD"],
      slotId: "exhaust.fan",
    },
    {
      canonicalId: "system.mode",
      objectNames: ["UnitMode", "360102_Plantmode_KV"],
      slotId: "status.system",
    },
    {
      canonicalId: "system.schedule",
      objectNames: ["AirUnitAutoMode", "360102_KMD_MSV"],
      slotId: "status.schedule",
    },
  ];

export function isSorgenfriCaseBuilding(buildingSlug: string | undefined): boolean {
  return buildingSlug === SORGENFRI_BUILDING_SLUG;
}

function findPointByObjectName(
  points: readonly InfraspawnPointListItem[],
  objectNames: readonly string[],
): InfraspawnPointListItem | undefined {
  for (const name of objectNames) {
    const normalized = name.toUpperCase();
    const match = points.find(
      (point) => point.objectName?.toUpperCase() === normalized,
    );
    if (match) return match;
  }
  return undefined;
}

/** Materialiserer kuraterte bindings mot faktiske punkter i kilden. */
export function materializeSorgenfriControlBindings(input: {
  sourceId: string;
  points: readonly InfraspawnPointListItem[];
}): ControlSignalBinding[] {
  const bindings: ControlSignalBinding[] = [];

  for (const spec of SORGENFRI_CONTROL_BINDING_SPECS) {
    const point = findPointByObjectName(input.points, spec.objectNames);
    if (!point) continue;

    bindings.push({
      sourceId: input.sourceId,
      objectId: point.objectId,
      canonicalId: spec.canonicalId,
      unitKey: SORGENFRI_VENTILATION_UNIT_KEY,
      slotId: spec.slotId,
      source: "manual",
      confidence: "high",
    });
  }

  return bindings;
}
