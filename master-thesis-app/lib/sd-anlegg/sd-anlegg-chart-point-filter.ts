import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { AhuSlotRole } from "./ahu-blueprint";
import { isPressureSignal } from "./ahu-signal-classifiers";
import {
  isFlowSignal,
  isPercentSignal,
} from "./format-process-slot-display";

function isHxTemperatureSignal(point: InfraspawnPointListItem): boolean {
  const name = (point.objectName ?? point.objectId).trim().toUpperCase();
  const unit = (point.unit ?? "").toLowerCase();
  return name.includes("TEMP") || unit.includes("celsius") || unit.includes("degree");
}

export function filterSdAnleggChartPointsForSlot(
  slotRole: AhuSlotRole | undefined,
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem[] {
  if (!slotRole || points.length === 0) return [...points];

  switch (slotRole) {
    case "fan":
      return points.filter((point) => !isPressureSignal(point));
    case "hx":
      return points.filter((point) => !isHxTemperatureSignal(point));
    default:
      return [...points];
  }
}

export function pickDefaultSdAnleggChartPointsForSlot(
  slotRole: AhuSlotRole | undefined,
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem[] {
  const chartable = filterSdAnleggChartPointsForSlot(slotRole, points);
  if (chartable.length === 0) return [];

  if (slotRole === "fan") {
    const flow = chartable.find((point) => isFlowSignal(point));
    if (flow) return [flow];
    const speed = chartable.find((point) => isPercentSignal(point));
    if (speed) return [speed];
  }

  if (slotRole === "hx") {
    const control = chartable.find(
      (point) =>
        isPercentSignal(point) &&
        !/EFFICIENCY(?:TEMP)?$/i.test(
          (point.objectName ?? point.objectId).trim(),
        ),
    );
    if (control) return [control];
    const efficiency = chartable.find((point) =>
      /EFFICIENCY|LX471_KV/i.test((point.objectName ?? point.objectId).trim()),
    );
    if (efficiency) return [efficiency];
  }

  if (slotRole === "valve" || slotRole === "coil") {
    const command = chartable.find((point) => isPercentSignal(point));
    if (command) return [command];
  }

  return [chartable[0]!];
}
