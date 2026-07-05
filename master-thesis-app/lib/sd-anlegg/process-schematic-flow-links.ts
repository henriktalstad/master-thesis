import {
  AHU_BLUEPRINT_PROCESS_SLOTS,
  type AhuBlueprintSlotDef,
  type AhuLane,
} from "./ahu-blueprint";
import {
  PROCESS_DUCT_GEOMETRY as G,
  PROCESS_HEATING_BRANCH_Y,
  PROCESS_HEATING_PIPE as P,
  PROCESS_SCHEMATIC_CANVAS,
} from "./process-schematic-geometry";
import {
  PROCESS_EXHAUST_DUCT_CENTER_Y,
  PROCESS_EXHAUST_PROBE_ANCHOR_Y,
  PROCESS_HX_CENTER_X,
  PROCESS_SUPPLY_DUCT_CENTER_Y,
  PROCESS_SUPPLY_PROBE_ANCHOR_Y,
} from "./process-schematic-slot-anchors";

export {
  PROCESS_EXHAUST_DUCT_CENTER_Y,
  PROCESS_SUPPLY_DUCT_CENTER_Y,
  PROCESS_HX_CENTER_X,
  resolveProcessSlotAnchorPercentY,
  resolveProcessSlotAnchorY,
} from "./process-schematic-slot-anchors";

export type ProcessFlowLinkSegment = {
  slotId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "probe" | "in-duct" | "pipe-tap";
  lane: AhuLane;
};

export type ProcessFlowChevron = {
  cx: number;
  cy: number;
  direction: "left" | "right";
};

function slotSvgX(slot: AhuBlueprintSlotDef): number {
  return (slot.x / 100) * PROCESS_SCHEMATIC_CANVAS.width;
}

export function buildProcessFlowLinkSegments(): ProcessFlowLinkSegment[] {
  const segments: ProcessFlowLinkSegment[] = [];

  for (const slot of AHU_BLUEPRINT_PROCESS_SLOTS) {
    const x = slotSvgX(slot);

    if (slot.lane === "exhaust") {
      const cy = PROCESS_EXHAUST_DUCT_CENTER_Y;
      if (slot.role === "temp" || slot.role === "filter") {
        segments.push({
          slotId: slot.slotId,
          x1: x,
          y1: PROCESS_EXHAUST_PROBE_ANCHOR_Y,
          x2: x,
          y2: cy,
          kind: "probe",
          lane: slot.lane,
        });
      } else if (slot.role === "fan" || slot.role === "damper") {
        segments.push({
          slotId: slot.slotId,
          x1: x,
          y1: G.topY + 6,
          x2: x,
          y2: G.topY + G.height - 6,
          kind: "in-duct",
          lane: slot.lane,
        });
      }
      continue;
    }

    if (slot.lane === "supply") {
      const cy = PROCESS_SUPPLY_DUCT_CENTER_Y;
      if (slot.role === "temp" || slot.role === "filter") {
        segments.push({
          slotId: slot.slotId,
          x1: x,
          y1: cy,
          x2: x,
          y2: PROCESS_SUPPLY_PROBE_ANCHOR_Y,
          kind: "probe",
          lane: slot.lane,
        });
      } else if (slot.role === "fan" || slot.role === "damper") {
        segments.push({
          slotId: slot.slotId,
          x1: x,
          y1: G.supplyY + 6,
          x2: x,
          y2: G.supplyY + G.height - 6,
          kind: "in-duct",
          lane: slot.lane,
        });
      }
      continue;
    }

    if (slot.lane === "heating") {
      if (slot.slotId === "heating.cool_valve") {
        segments.push({
          slotId: slot.slotId,
          x1: P.coolValveX,
          y1: G.supplyY + G.height - 4,
          x2: P.coolValveX,
          y2: P.topY + 28,
          kind: "pipe-tap",
          lane: slot.lane,
        });
        continue;
      }
      if (slot.role === "temp") {
        segments.push({
          slotId: slot.slotId,
          x1: P.rightPipeX - 18,
          y1: PROCESS_HEATING_BRANCH_Y.temp,
          x2: P.rightPipeX,
          y2: PROCESS_HEATING_BRANCH_Y.temp,
          kind: "probe",
          lane: slot.lane,
        });
        continue;
      }
      if (slot.role === "pump") {
        segments.push({
          slotId: slot.slotId,
          x1: P.leftPipeX - 18,
          y1: PROCESS_HEATING_BRANCH_Y.pump,
          x2: P.leftPipeX,
          y2: PROCESS_HEATING_BRANCH_Y.pump,
          kind: "probe",
          lane: slot.lane,
        });
        segments.push({
          slotId: slot.slotId,
          x1: P.leftPipeX,
          y1: PROCESS_HEATING_BRANCH_Y.pump - 18,
          x2: P.leftPipeX,
          y2: PROCESS_HEATING_BRANCH_Y.pump + 18,
          kind: "pipe-tap",
          lane: slot.lane,
        });
        continue;
      }
      if (slot.role === "valve") {
        segments.push({
          slotId: slot.slotId,
          x1: P.rightPipeX - 18,
          y1: PROCESS_HEATING_BRANCH_Y.valve,
          x2: P.rightPipeX,
          y2: PROCESS_HEATING_BRANCH_Y.valve,
          kind: "probe",
          lane: slot.lane,
        });
        segments.push({
          slotId: slot.slotId,
          x1: P.rightPipeX,
          y1: PROCESS_HEATING_BRANCH_Y.valve - 16,
          x2: P.rightPipeX,
          y2: PROCESS_HEATING_BRANCH_Y.valve + 16,
          kind: "pipe-tap",
          lane: slot.lane,
        });
      }
    }
  }

  return segments;
}

export function buildProcessFlowChevrons(): ProcessFlowChevron[] {
  const chevrons: ProcessFlowChevron[] = [];
  const exhaustY = PROCESS_EXHAUST_DUCT_CENTER_Y;
  const supplyY = PROCESS_SUPPLY_DUCT_CENTER_Y;
  const left = G.left + 48;
  const right = G.left + G.width - 48;
  const step = 128;

  for (let x = right; x >= left; x -= step) {
    chevrons.push({ cx: x, cy: exhaustY, direction: "left" });
  }
  for (let x = left; x <= right; x += step) {
    chevrons.push({ cx: x, cy: supplyY, direction: "right" });
  }

  return chevrons;
}

export function buildProcessDuctCenterSpines(): Array<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lane: "exhaust" | "supply";
}> {
  const left = G.left + 24;
  const right = G.left + G.width - 24;
  return [
    {
      x1: left,
      y1: PROCESS_EXHAUST_DUCT_CENTER_Y,
      x2: right,
      y2: PROCESS_EXHAUST_DUCT_CENTER_Y,
      lane: "exhaust",
    },
    {
      x1: left,
      y1: PROCESS_SUPPLY_DUCT_CENTER_Y,
      x2: right,
      y2: PROCESS_SUPPLY_DUCT_CENTER_Y,
      lane: "supply",
    },
  ];
}

export function buildHxBridgeSegments(): Array<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}> {
  const cx = PROCESS_HX_CENTER_X;
  return [
    {
      x1: cx - 20,
      y1: PROCESS_EXHAUST_DUCT_CENTER_Y,
      x2: cx + 20,
      y2: PROCESS_EXHAUST_DUCT_CENTER_Y,
    },
    {
      x1: cx - 20,
      y1: PROCESS_SUPPLY_DUCT_CENTER_Y,
      x2: cx + 20,
      y2: PROCESS_SUPPLY_DUCT_CENTER_Y,
    },
  ];
}

export function buildHeatingBranchJunctions(): { cx: number; cy: number }[] {
  return [
    { cx: P.leftPipeX, cy: G.supplyY },
    { cx: P.rightPipeX, cy: G.supplyY },
    { cx: P.leftPipeX, cy: PROCESS_HEATING_BRANCH_Y.pump },
    { cx: P.rightPipeX, cy: PROCESS_HEATING_BRANCH_Y.temp },
    { cx: P.rightPipeX, cy: PROCESS_HEATING_BRANCH_Y.valve },
  ];
}
