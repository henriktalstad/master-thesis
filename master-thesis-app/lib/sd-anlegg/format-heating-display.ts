import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { formatInfraspawnPointValue } from "@/lib/infraspawn/display-format";
import {
  formatHeatingCirculationPumpMode,
  formatHeatingSetpointLabel,
} from "./heating-signal-vocabulary";

export function formatHeatingPointDisplayValue(
  point: Pick<
    InfraspawnPointListItem,
    "objectId" | "objectName" | "lastValue" | "unit" | "description"
  >,
): string | null {
  const pumpMode = formatHeatingCirculationPumpMode(point);
  if (pumpMode) return pumpMode;

  if (formatHeatingSetpointLabel(point.objectName) && point.lastValue != null) {
    return formatInfraspawnPointValue(point.lastValue, point.unit, point);
  }

  return null;
}
