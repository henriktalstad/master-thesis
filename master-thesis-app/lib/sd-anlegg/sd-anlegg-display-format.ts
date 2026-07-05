import { formatInfraspawnUnit } from "@/lib/infraspawn/format-unit";
import {
  formatInfraspawnPointValueParts,
  type InfraspawnPointValueParts,
} from "@/lib/infraspawn/display-format";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export function resolveSdAnleggNumericFractionDigits(
  unit: string | null | undefined,
): number {
  const label = formatInfraspawnUnit(unit);
  if (label === "m³/h" || label === "%" || label === "Pa") return 0;
  return 1;
}

export function formatSdAnleggNumericValue(
  value: number | null,
  unit?: string | null,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const digits = resolveSdAnleggNumericFractionDigits(unit);
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: digits }).format(
    value,
  );
}

export function formatSdAnleggNumericWithUnit(
  value: number | null,
  unit?: string | null,
): string {
  const formatted = formatSdAnleggNumericValue(value, unit);
  if (formatted === "—") return formatted;
  const unitLabel = formatInfraspawnUnit(unit);
  return unitLabel ? `${formatted} ${unitLabel}` : formatted;
}

export function formatSdAnleggFilterPressureValue(
  value: number | null,
): string {
  return formatSdAnleggNumericWithUnit(value, "pascals");
}

export function formatSdAnleggKeyPointValueParts(
  point: Pick<InfraspawnPointListItem, "lastValue" | "unit" | "objectId" | "objectName" | "description">,
): InfraspawnPointValueParts {
  const parts = formatInfraspawnPointValueParts(
    point.lastValue,
    point.unit,
    point,
  );
  if (parts.kind !== "numeric") return parts;
  return {
    kind: "numeric",
    value: formatSdAnleggNumericValue(point.lastValue, point.unit),
    unit: formatInfraspawnUnit(point.unit),
  };
}
