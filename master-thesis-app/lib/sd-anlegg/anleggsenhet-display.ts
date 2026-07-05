import {
  formatAnleggsenhetUnitKeyForDisplay,
  SD_ANLEGG_SOURCE_UNIT_KEY,
  SD_ANLEGG_UNGROUPED_UNIT_KEY,
  type SdAnleggsenhet,
} from "./infer-anleggsenheter";
import { thermalAnleggsenhetDisplayLabel } from "@/lib/infraspawn/tfm-element-keys";
import {
  findAnleggsenhetDisplayOverride,
  type SdAnleggAnleggsenhetDisplayOverride,
} from "./anleggsenhet-display-overrides";

function normalizeComparableCode(value: string): string {
  return value.replace(/[.\s]/g, "").toLowerCase();
}

/** Trekker ut navnedel fra kildelabel når den starter med anleggskode. */
export function extractDescriptiveNameFromSourceLabel(
  sourceLabel: string,
  unitKey: string,
): string | null {
  const trimmed = sourceLabel.trim();
  if (!trimmed) return null;

  const formattedCode = formatAnleggsenhetUnitKeyForDisplay(unitKey);
  const normalizedCode = normalizeComparableCode(unitKey);
  const normalizedSource = normalizeComparableCode(trimmed);

  if (normalizedSource === normalizedCode) return null;

  const codePattern = new RegExp(
    `^${formattedCode.replace(".", "[.\\s]?")}\\s+(.+)$`,
    "i",
  );
  const directMatch = trimmed.match(codePattern);
  if (directMatch?.[1]?.trim()) return directMatch[1].trim();

  if (normalizedSource.startsWith(normalizedCode) && trimmed.length > formattedCode.length) {
    const remainder = trimmed.slice(formattedCode.length).trim();
    if (remainder) return remainder.replace(/^[-–·]\s*/, "").trim() || null;
  }

  return null;
}

export function inferAnleggsenhetDescriptiveName(
  unit: Pick<SdAnleggsenhet, "unitKey" | "sourceLabel">,
): string | null {
  if (unit.unitKey === SD_ANLEGG_SOURCE_UNIT_KEY) {
    return unit.sourceLabel.trim() || null;
  }
  if (unit.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY) {
    return "Ugruppert";
  }

  const thermal = thermalAnleggsenhetDisplayLabel(unit.unitKey);
  if (thermal) return thermal;

  return extractDescriptiveNameFromSourceLabel(unit.sourceLabel, unit.unitKey);
}

/** Anleggsformat: «360.101 Boligdel blokk A». Uten navn: kun kode. */
export function formatAnleggsenhetDisplay(
  unitKey: string,
  descriptiveName: string | null | undefined,
): string {
  if (unitKey === SD_ANLEGG_SOURCE_UNIT_KEY) {
    return descriptiveName?.trim() || "Anlegg";
  }
  if (unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY) {
    return "Ugruppert";
  }

  const code = formatAnleggsenhetUnitKeyForDisplay(unitKey);
  const name = descriptiveName?.trim();
  if (!name) return code;

  const normalizedName = normalizeComparableCode(name);
  const normalizedCode = normalizeComparableCode(code);
  if (
    normalizedName === normalizedCode ||
    normalizedName.startsWith(normalizedCode) ||
    name.includes(code)
  ) {
    return name;
  }

  return `${code} ${name}`;
}

export function anleggsenhetDisplayNeedsManualName(
  unit: Pick<SdAnleggsenhet, "id" | "unitKey" | "sourceLabel">,
  overrides: readonly SdAnleggAnleggsenhetDisplayOverride[],
): boolean {
  if (unit.unitKey === SD_ANLEGG_SOURCE_UNIT_KEY) return false;
  if (unit.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY) return false;
  if (findAnleggsenhetDisplayOverride(overrides, unit.id)) return false;
  return inferAnleggsenhetDescriptiveName(unit) == null;
}

export function findAnleggsenhetDisplayOverrideEntry(
  overrides: readonly SdAnleggAnleggsenhetDisplayOverride[],
  scopeId: string,
): SdAnleggAnleggsenhetDisplayOverride | null {
  return findAnleggsenhetDisplayOverride(overrides, scopeId);
}
