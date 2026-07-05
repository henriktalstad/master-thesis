import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  HEATING_EXACT_POINT_LABELS,
  resolveHeatingExactPointLabel,
} from "./fdv-signal-registry";

export { HEATING_EXACT_POINT_LABELS, resolveHeatingExactPointLabel };

/** Sekundærpumpemodus: AV / PUMPE A / PUMPE B / AUTO / MODUS n (FDV). */
export function formatHeatingCirculationPumpMode(
  point: Pick<InfraspawnPointListItem, "objectName" | "lastValue">,
): string | null {
  const name = (point.objectName ?? "").toUpperCase();
  if (!/JP(401|402|501)/.test(name)) return null;

  if (/_KOM\b/.test(name)) {
    const numeric = Number(point.lastValue);
    if (!Number.isFinite(numeric)) return "—";
    return `MODUS ${Math.trunc(numeric)}`;
  }

  if (name.endsWith("_S") || name.includes("_S")) {
    const numeric = Number(point.lastValue);
    if (!Number.isFinite(numeric)) return "—";
    if (numeric === 0) return "AV";
    if (numeric === 1) return "PUMPE A";
    if (numeric === 2) return "PUMPE B";
    if (numeric === 3) return "AUTO";
    return numeric >= 1 ? "PÅ" : "AV";
  }

  if (name.endsWith("_A") || name.includes("_A")) {
    const numeric = Number(point.lastValue);
    if (!Number.isFinite(numeric)) return "—";
    return numeric >= 1 ? "PÅ" : "AV";
  }

  return null;
}

export function formatHeatingSetpointLabel(
  objectName: string | null | undefined,
): string | null {
  if (!objectName) return null;
  return resolveHeatingExactPointLabel(objectName);
}
