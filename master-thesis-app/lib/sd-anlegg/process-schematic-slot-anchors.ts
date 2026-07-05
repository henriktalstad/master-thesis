import type { AhuLane } from "./ahu-blueprint";
import {
  PROCESS_DUCT_GEOMETRY as G,
  PROCESS_HEATING_BRANCH_Y,
  PROCESS_HEATING_PIPE as P,
  PROCESS_HEATING_SLOT_ANCHORS,
  blueprintPercentToLayoutY,
  processSchematicPercentY,
} from "./process-schematic-geometry";

export const PROCESS_EXHAUST_DUCT_CENTER_Y = G.topY + G.height / 2;
export const PROCESS_SUPPLY_DUCT_CENTER_Y = G.supplyY + G.height / 2;
export const PROCESS_HX_CENTER_X = G.hxX + G.hxWidth / 2;

export const PROCESS_EXHAUST_PROBE_ANCHOR_Y = G.topY - 22;
export const PROCESS_SUPPLY_PROBE_ANCHOR_Y = G.supplyY + G.height + 22;
export const PROCESS_HX_GAP_CENTER_Y =
  G.topY + G.height + (G.supplyY - G.topY - G.height) / 2;

export type ProcessSlotAnchorGrow = "up" | "down" | "center";

const IN_DUCT_ROLES = new Set(["fan", "damper", "pressure", "coil"]);

const SYMBOL_SHIFT_DEFAULT = 50;

const SYMBOL_SHIFT_BY_ROLE: Record<string, number> = {
  fan: 50,
  hx: 50,
  filter: 8,
  pressure: 50,
};

const SYMBOL_SHIFT_BY_ROLE_LANE: Record<string, number> = {
  "temp:exhaust": 6,
  "temp:supply": 6,
  "filter:exhaust": 8,
  "filter:supply": 8,
  "temp:heating": 10,
  "pump:heating": 8,
  "valve:heating": 8,
  "coil:heating": 50,
  "coil:supply": 50,
  "damper:supply": 50,
  "damper:exhaust": 50,
};

function roleLaneKey(role: string, lane?: string): string {
  return lane ? `${role}:${lane}` : role;
}

export function resolveProcessSlotAnchorGrow(
  lane: AhuLane | string,
  role?: string,
): ProcessSlotAnchorGrow {
  if (lane === "exhaust" && role && !IN_DUCT_ROLES.has(role)) {
    return "down";
  }
  if (lane === "supply" && role && !IN_DUCT_ROLES.has(role)) {
    return "up";
  }
  if (lane === "heatRecovery") return "center";
  if (lane === "heating") return "center";
  return "center";
}

export function resolveProcessSymbolAnchorShiftY(role: string, lane?: string): number {
  const scoped = SYMBOL_SHIFT_BY_ROLE_LANE[roleLaneKey(role, lane)];
  if (scoped != null) return scoped;
  return SYMBOL_SHIFT_BY_ROLE[role] ?? SYMBOL_SHIFT_DEFAULT;
}

export function resolveProcessSlotAnchorPercentY(lane: AhuLane, role?: string): number {
  switch (lane) {
    case "exhaust":
      if (role && !IN_DUCT_ROLES.has(role)) {
        return processSchematicPercentY(PROCESS_EXHAUST_PROBE_ANCHOR_Y);
      }
      return processSchematicPercentY(PROCESS_EXHAUST_DUCT_CENTER_Y);
    case "supply":
      if (role && !IN_DUCT_ROLES.has(role)) {
        return processSchematicPercentY(PROCESS_SUPPLY_PROBE_ANCHOR_Y);
      }
      return processSchematicPercentY(PROCESS_SUPPLY_DUCT_CENTER_Y);
    case "heatRecovery":
      return processSchematicPercentY(PROCESS_HX_GAP_CENTER_Y);
    case "heating":
      if (role === "temp") return processSchematicPercentY(PROCESS_HEATING_BRANCH_Y.temp);
      if (role === "pump") return processSchematicPercentY(PROCESS_HEATING_BRANCH_Y.pump);
      if (role === "valve") return processSchematicPercentY(PROCESS_HEATING_BRANCH_Y.valve);
      if (role === "coil") return processSchematicPercentY(PROCESS_SUPPLY_DUCT_CENTER_Y);
      return processSchematicPercentY(P.bypassY);
    default:
      return processSchematicPercentY(PROCESS_SUPPLY_DUCT_CENTER_Y);
  }
}

function resolveHeatingAnchorY(slotId: string): number | undefined {
  switch (slotId) {
    case "heating.pump":
      return PROCESS_HEATING_SLOT_ANCHORS.pump.y;
    case "heating.valve":
      return PROCESS_HEATING_SLOT_ANCHORS.valve.y;
    case "heating.temp":
      return PROCESS_HEATING_SLOT_ANCHORS.temp.y;
    case "heating.cool_valve":
      return PROCESS_HEATING_SLOT_ANCHORS.coolValve.y;
    default:
      return undefined;
  }
}

export function resolveProcessEquipmentAnchorY(input: {
  slotId: string;
  lane: AhuLane | string;
  role: string;
  blueprintY: number;
}): number {
  if (input.lane === "heating") {
    const heatingY = resolveHeatingAnchorY(input.slotId);
    if (heatingY != null) return heatingY;
  }

  if (
    input.lane === "exhaust" ||
    input.lane === "supply" ||
    input.lane === "heatRecovery" ||
    input.lane === "heating"
  ) {
    return resolveProcessSlotAnchorPercentY(input.lane as AhuLane, input.role);
  }

  return blueprintPercentToLayoutY(input.blueprintY);
}

export function resolveProcessSlotAnchorY(lane: string, role?: string): number {
  if (
    lane === "heating" ||
    lane === "heatRecovery" ||
    lane === "exhaust" ||
    lane === "supply"
  ) {
    return resolveProcessSlotAnchorPercentY(
      lane as "exhaust" | "supply" | "heatRecovery" | "heating",
      role,
    );
  }
  return resolveProcessSlotAnchorPercentY("supply");
}
