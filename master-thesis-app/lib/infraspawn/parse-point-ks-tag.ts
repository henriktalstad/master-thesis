import { parseKsTag, type KsTag } from "@/lib/infraspawn/ks-tag-parser";
import { isEnergyMeterEquipmentCode } from "@/lib/infraspawn/equipment-code";
import {
  formatTfmElementKeyForDisplay,
  isThermalSystemElementKey,
  isVentilationSystemElementKey,
  normalizeTfmElementKey,
} from "@/lib/infraspawn/tfm-element-keys";

export type InfraspawnPointKsTag = {
  raw: string;
  systemCode: string;
  elementNumber: string;
  element: string;
  /** Normalisert enhetsnøkkel, f.eks. `320002`. */
  elementKey: string;
  equipmentCode: string | null;
  signalSuffix: string | null;
  isEnergyMeter: boolean;
  matchKind: "ks" | "equipment-object-name" | "equipment-underscore";
};

type ParseInput = {
  objectName?: string | null;
  description?: string | null;
  sourceLabel?: string | null;
};

/** `320.002RT402_MV`, `320002JP401_A`, `320.001RT901_MV` */
const EQUIPMENT_COMPACT_OBJECT_NAME =
  /^(\d{3})[.\s]?(\d{3})([A-Z]{1,3}\d{1,4})(?:[._-]([A-Za-z0-9]+))?$/i;

/** `320001OE001_turtemp` */
const EQUIPMENT_UNDERSCORE_OBJECT_NAME =
  /^(\d{3})(\d{3})([A-Z]{1,3}\d{1,4})_(.+)$/i;

/** `320.001-3 Fjernvarme` */
const SOURCE_LABEL_ELEMENT = /^(\d{3})\.(\d{3})(?:-\d+)?\b/i;

function normalizeElementKey(systemCode: string, elementNumber: string): string {
  return normalizeTfmElementKey(systemCode, elementNumber);
}

function fromKsTag(raw: string, tag: KsTag): InfraspawnPointKsTag {
  const equipmentCode = tag.meterIndex;
  return {
    raw,
    systemCode: tag.systemCode,
    elementNumber: tag.elementNumber,
    element: tag.element,
    elementKey: normalizeElementKey(tag.systemCode, tag.elementNumber),
    equipmentCode,
    signalSuffix: tag.variant,
    isEnergyMeter: tag.isEnergyMeter,
    matchKind: "ks",
  };
}

function fromParts(
  raw: string,
  systemCode: string,
  elementNumber: string,
  equipmentCode: string | null,
  signalSuffix: string | null,
  matchKind: "equipment-object-name" | "equipment-underscore",
): InfraspawnPointKsTag {
  const element = `${systemCode}.${elementNumber}`;
  return {
    raw,
    systemCode,
    elementNumber,
    element,
    elementKey: normalizeElementKey(systemCode, elementNumber),
    equipmentCode,
    signalSuffix,
    isEnergyMeter: isEnergyMeterEquipmentCode(equipmentCode),
    matchKind,
  };
}

function tryParseCandidate(raw: string): InfraspawnPointKsTag | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ks = parseKsTag(trimmed);
  if (ks) return fromKsTag(trimmed, ks);

  const compact = trimmed.match(EQUIPMENT_COMPACT_OBJECT_NAME);
  if (compact) {
    const [, systemCode, elementNumber, equipment, suffix] = compact;
    if (systemCode && elementNumber) {
      return fromParts(
        trimmed,
        systemCode,
        elementNumber,
        equipment?.toUpperCase() ?? null,
        suffix ?? null,
        "equipment-object-name",
      );
    }
  }

  const underscore = trimmed.match(EQUIPMENT_UNDERSCORE_OBJECT_NAME);
  if (underscore) {
    const [, systemCode, elementNumber, equipment, suffix] = underscore;
    if (systemCode && elementNumber) {
      return fromParts(
        trimmed,
        systemCode,
        elementNumber,
        equipment?.toUpperCase() ?? null,
        suffix ?? null,
        "equipment-underscore",
      );
    }
  }

  const sourceLabel = trimmed.match(SOURCE_LABEL_ELEMENT);
  if (sourceLabel) {
    const [, systemCode, elementNumber] = sourceLabel;
    if (systemCode && elementNumber) {
      return fromParts(
        trimmed,
        systemCode,
        elementNumber,
        null,
        null,
        "equipment-object-name",
      );
    }
  }

  return null;
}

export function parseInfraspawnPointKsTag(
  input: ParseInput,
): InfraspawnPointKsTag | null {
  const candidates = [input.objectName, input.sourceLabel, input.description];
  for (const candidate of candidates) {
    const parsed = tryParseCandidate(candidate ?? "");
    if (parsed) return parsed;
  }
  return null;
}

export function isThermalHeatDistributionElementKey(elementKey: string): boolean {
  return isThermalSystemElementKey(elementKey);
}

export function isVentilationAggregateElementKey(elementKey: string): boolean {
  return isVentilationSystemElementKey(elementKey);
}

export function formatInfraspawnKsElementForDisplay(elementKey: string): string {
  return formatTfmElementKeyForDisplay(elementKey);
}

const EQUIPMENT_CODE_PATTERN =
  /\b(JP|SB|RT|RP|OE|JV|KA|QD|LX|LV)\d{2,4}\b/gi;

/** Utstyrskoder fra KS-tag eller kompakt utstyrstag (f.eks. RT402). */
export function extractInfraspawnEquipmentCodes(input: {
  objectName?: string | null;
  description?: string | null;
}): string[] {
  const codes = new Set<string>();
  const ksTag = parseInfraspawnPointKsTag({
    objectName: input.objectName,
    description: input.description,
  });
  if (ksTag?.equipmentCode) {
    codes.add(ksTag.equipmentCode.toUpperCase());
  }

  const haystack = `${input.objectName ?? ""} ${input.description ?? ""}`;
  for (const match of haystack.matchAll(EQUIPMENT_CODE_PATTERN)) {
    if (match[0]) codes.add(match[0].toUpperCase());
  }

  return [...codes];
}
