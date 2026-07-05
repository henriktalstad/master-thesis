import { compactAliasToken } from "@/lib/sd-anlegg/ahu-signal-alias-registry";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function normalizePattern(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "_");
}

/** Utstyrstag (320.002RT402_MV) — kan matches på objectName/objectId. */
export function isEquipmentTagPattern(pattern: string): boolean {
  const trimmed = pattern.trim();
  return /^\d{3}[._]/.test(trimmed) || trimmed.startsWith("360102");
}

/** Systemair/Influx objectName (AO_3, AI_SupplyAirTemp) — matches kun objectName. */
export function isNamedBacnetSignalPattern(pattern: string): boolean {
  return !isEquipmentTagPattern(pattern);
}

export function pointFieldTokens(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId">,
  pattern: string,
): string[] {
  const fields = isNamedBacnetSignalPattern(pattern)
    ? ([point.objectName].filter((value): value is string =>
        Boolean(value?.trim()),
      ) as string[])
    : ([point.objectName, point.objectId].filter((value): value is string =>
        Boolean(value?.trim()),
      ) as string[]);

  return fields.flatMap((value) => [
    normalizePattern(value),
    compactAliasToken(value),
  ]);
}

export function pointMatchesCatalogPattern(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId">,
  pattern: string,
): boolean {
  const normalizedPattern = normalizePattern(pattern);
  const compactPattern = compactAliasToken(pattern);
  return pointFieldTokens(point, pattern).some(
    (candidate) =>
      candidate === normalizedPattern || candidate === compactPattern,
  );
}
