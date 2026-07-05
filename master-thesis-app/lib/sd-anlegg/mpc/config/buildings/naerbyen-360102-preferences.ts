import type { MpcPreferenceChannelDef } from "../mpc-building-preferences";
import type { ComfortSchedule } from "../comfort-schedule";
import { NAERBYEN_OFFICE_COMFORT_SCHEDULE } from "../comfort-schedule";
import { NAERBYEN_OFFICE_OPERATING_PROFILE } from "../resolve-occupancy";

/** Nærbyen 24/7 — AHU 360.102 (bygg-spesifikk mal). */
export const NAERBYEN_360102_PREFERENCE_CHANNELS: readonly MpcPreferenceChannelDef[] =
  [
    {
      id: "supplySetpointC",
      canonicalId: "supply.setpoint",
      label: "Settpunkt tilluft",
      unit: "°C",
      role: "mpc_actuator",
      mpcOptimizable: true,
      condition: "when_demand",
      limits: { min: 14, max: 26, maxDeltaPerStep: 1.5 },
    },
    {
      id: "supplyFanPct",
      canonicalId: "supply.fan.command",
      label: "Tilluftvifte",
      unit: "%",
      role: "mpc_actuator",
      mpcOptimizable: true,
      condition: "when_fan_on",
      limits: { min: 0, max: 100, maxDeltaPerStep: 12 },
    },
    {
      id: "exhaustFanPct",
      canonicalId: "exhaust.fan.command",
      label: "Avtrekkvifte",
      unit: "%",
      role: "mpc_actuator",
      mpcOptimizable: true,
      condition: "when_fan_on",
      limits: { min: 0, max: 100, maxDeltaPerStep: 12 },
    },
    {
      id: "heatingValvePct",
      canonicalId: "heating.valve.command",
      label: "Varmebatteri",
      unit: "%",
      role: "mpc_actuator",
      mpcOptimizable: true,
      condition: "when_heating_active",
      limits: { min: 0, max: 100, maxDeltaPerStep: 15 },
    },
    {
      id: "coolingValvePct",
      canonicalId: "cooling.valve.command",
      label: "Kjølebatteri",
      unit: "%",
      role: "mpc_actuator",
      mpcOptimizable: true,
      condition: "when_cooling_active",
      limits: { min: 0, max: 100, maxDeltaPerStep: 15 },
    },
    {
      id: "districtTr002ValvePct",
      canonicalId: "district.tr002.valve.command",
      label: "TR002 ventil",
      unit: "%",
      role: "mpc_actuator",
      mpcOptimizable: true,
      condition: "when_heating_active",
      limits: { min: 0, max: 100, maxDeltaPerStep: 12 },
    },
    {
      id: "districtTr003ValvePct",
      canonicalId: "district.tr003.valve.command",
      label: "TR003 ventil",
      unit: "%",
      role: "mpc_actuator",
      mpcOptimizable: true,
      condition: "when_heating_active",
      limits: { min: 0, max: 100, maxDeltaPerStep: 12 },
    },
    {
      id: "supplySetpointCalcC",
      canonicalId: "supply.setpoint_calculated",
      label: "Kalkulert SP tilluft",
      unit: "°C",
      role: "local_bms",
      mpcOptimizable: false,
      condition: "always",
      limits: { min: 14, max: 26, maxDeltaPerStep: 0 },
    },
    {
      id: "extractSetpointC",
      canonicalId: "extract.setpoint",
      label: "Settpunkt avtrekk",
      unit: "°C",
      role: "local_bms",
      mpcOptimizable: false,
      condition: "always",
      limits: { min: 16, max: 28, maxDeltaPerStep: 0 },
    },
  ];

export const NAERBYEN_BUILDING_SLUG = "naerbyen-24-7";
export const NAERBYEN_UNIT_KEY = "360.102";

export const SORGENFRI_BUILDING_SLUG = "sorgenfriveien-32ab";

export function preferenceTemplateForBuilding(buildingSlug: string): {
  unitKey: string;
  channels: readonly MpcPreferenceChannelDef[];
  comfortSchedule: ComfortSchedule;
  operatingProfile: typeof NAERBYEN_OFFICE_OPERATING_PROFILE;
} | null {
  if (
    buildingSlug === NAERBYEN_BUILDING_SLUG ||
    buildingSlug === SORGENFRI_BUILDING_SLUG
  ) {
    return {
      unitKey: NAERBYEN_UNIT_KEY,
      channels: NAERBYEN_360102_PREFERENCE_CHANNELS,
      comfortSchedule: NAERBYEN_OFFICE_COMFORT_SCHEDULE,
      operatingProfile: NAERBYEN_OFFICE_OPERATING_PROFILE,
    };
  }
  return null;
}
