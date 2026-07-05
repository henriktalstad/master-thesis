import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export function isPressureSignal(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId" | "unit">,
): boolean {
  const name = (point.objectName ?? point.objectId).trim().toUpperCase();
  const unit = (point.unit ?? "").toLowerCase();
  return name.includes("PRESSURE") || unit.includes("pascal");
}
