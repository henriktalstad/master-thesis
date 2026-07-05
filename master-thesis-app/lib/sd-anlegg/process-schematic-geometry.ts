export const PROCESS_SCHEMATIC_CANVAS = {
  width: 1000,
  height: 520,
} as const;
export const PROCESS_SCHEMATIC_VIEWBOX = {
  x: 0,
  y: 20,
  width: 1000,
  height: 400,
} as const;

export function processSchematicViewBoxString(): string {
  const viewBox = PROCESS_SCHEMATIC_VIEWBOX;
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

export function processSchematicLayoutPercentX(svgX: number): number {
  const viewBox = PROCESS_SCHEMATIC_VIEWBOX;
  return ((svgX - viewBox.x) / viewBox.width) * 100;
}

export function processSchematicLayoutPercentY(svgY: number): number {
  const viewBox = PROCESS_SCHEMATIC_VIEWBOX;
  return ((svgY - viewBox.y) / viewBox.height) * 100;
}

export function blueprintPercentToLayoutX(blueprintXPercent: number): number {
  const svgX = (blueprintXPercent / 100) * PROCESS_SCHEMATIC_CANVAS.width;
  return processSchematicLayoutPercentX(svgX);
}

export function blueprintPercentToLayoutY(blueprintYPercent: number): number {
  const svgY = (blueprintYPercent / 100) * PROCESS_SCHEMATIC_CANVAS.height;
  return processSchematicLayoutPercentY(svgY);
}
export function resolveBlueprintSlotLayoutX(slot: {
  x: number;
  lane: string;
  role: string;
  slotId: string;
}): number {
  if (
    slot.lane === "heating" ||
    slot.lane === "heatRecovery" ||
    slot.role === "filter" ||
    slot.slotId === "exhaust.temp"
  ) {
    return slot.x;
  }
  return blueprintPercentToLayoutX(slot.x);
}
export const PROCESS_LANE_LABEL_X = 48;

export const PROCESS_DUCT_GEOMETRY = {
  topY: 56,
  height: 88,
  left: 100,
  width: 880,
  supplyY: 300,
  filterX: 230,
  filterWidth: 52,
  hxX: 468,
  hxWidth: 48,
} as const;

const SUPPLY_DUCT_CENTER_Y =
  PROCESS_DUCT_GEOMETRY.supplyY + PROCESS_DUCT_GEOMETRY.height / 2;
export const PROCESS_HEATING_PIPE = {
  leftPipeX: 584,
  rightPipeX: 756,
  topY: 152,
  bypassY: 232,
  supplyConnectY: SUPPLY_DUCT_CENTER_Y,
  coolValveX: 670,
} as const;

export const PROCESS_HEATING_BRANCH_Y = {
  temp: 156,
  pump: 252,
  valve: 228,
} as const;
export const PROCESS_HEATING_COIL_TAP_Y =
  PROCESS_DUCT_GEOMETRY.supplyY + PROCESS_DUCT_GEOMETRY.height - 4;

export type ProcessHeatingBranchSide = "left" | "right";

export const PROCESS_HEATING_BRANCH_SIDE: Record<
  "heating.pump" | "heating.temp" | "heating.valve",
  ProcessHeatingBranchSide
> = {
  "heating.pump": "left",
  "heating.temp": "right",
  "heating.valve": "right",
};

export function resolveProcessHeatingBranchSide(
  slotId: string,
): ProcessHeatingBranchSide | undefined {
  if (slotId in PROCESS_HEATING_BRANCH_SIDE) {
    return PROCESS_HEATING_BRANCH_SIDE[
      slotId as keyof typeof PROCESS_HEATING_BRANCH_SIDE
    ];
  }
  return undefined;
}

export function processSchematicPercentX(svgX: number): number {
  return processSchematicLayoutPercentX(svgX);
}

export function processSchematicPercentY(svgY: number): number {
  return processSchematicLayoutPercentY(svgY);
}
export const PROCESS_HEATING_SLOT_ANCHORS = {
  pump: {
    x: processSchematicPercentX(PROCESS_HEATING_PIPE.leftPipeX),
    y: processSchematicPercentY(PROCESS_HEATING_BRANCH_Y.pump),
  },
  valve: {
    x: processSchematicPercentX(PROCESS_HEATING_PIPE.rightPipeX),
    y: processSchematicPercentY(PROCESS_HEATING_BRANCH_Y.valve),
  },
  temp: {
    x: processSchematicPercentX(PROCESS_HEATING_PIPE.rightPipeX),
    y: processSchematicPercentY(PROCESS_HEATING_BRANCH_Y.temp),
  },
  coolValve: {
    x: processSchematicPercentX(PROCESS_HEATING_PIPE.coolValveX),
    y: processSchematicPercentY(SUPPLY_DUCT_CENTER_Y),
  },
} as const;

export const PROCESS_FILTER_SLOT_X = processSchematicPercentX(
  PROCESS_DUCT_GEOMETRY.filterX + PROCESS_DUCT_GEOMETRY.filterWidth / 2,
);
