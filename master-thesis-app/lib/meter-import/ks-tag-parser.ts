import { isEnergyMeterEquipmentCode } from "@/lib/meter-import/equipment-code";


export type KsElementCategory =
  | "SANITARY"
  | "THERMAL_HEAT_DISTRIBUTION"
  | "HEAT_PUMP_AND_COOLING"
  | "VENTILATION_AGGREGATE"
  | "THERMAL_COOLING_SYSTEM"
  | "EL_HOVEDTAVLE"
  | "EL_FORDELING"
  | "EL_HEATING"
  | "SOLAR_PV"
  | "ELEVATOR"
  | "UNKNOWN";

export type KsTag = {
  raw: string;
  system: string | null;
  systemCode: string;
  elementNumber: string;
  element: string;
  elementCategory: KsElementCategory;
  meterIndex: string | null;
  isEnergyMeter: boolean;
  variant: string | null;
  isMain: boolean;
  matchKind: "full" | "short" | "element-only";
};


export const SYSTEM_CODE_TABLE: Record<string, KsElementCategory> = {
  "310": "SANITARY",

  "320": "THERMAL_HEAT_DISTRIBUTION",
  "321": "THERMAL_HEAT_DISTRIBUTION",
  "322": "THERMAL_HEAT_DISTRIBUTION",

  // 35x — Varmepumpe- og kuldeinstallasjoner (NS 3451:2022)
  // ⚠️ Endret navn fra 2009-versjonen ("Prosesskjøling"). Dekker nå
  // BÅDE varme- og kuldeproduksjon — VP-anlegg hører her, ikke under 32/37.
  "350": "HEAT_PUMP_AND_COOLING",
  "351": "HEAT_PUMP_AND_COOLING",
  "352": "HEAT_PUMP_AND_COOLING",

  "360": "VENTILATION_AGGREGATE",

  "370": "THERMAL_COOLING_SYSTEM",
  "372": "THERMAL_COOLING_SYSTEM",
  "375": "THERMAL_COOLING_SYSTEM",

  "432": "EL_HOVEDTAVLE",
  "433": "EL_FORDELING",
  "434": "EL_FORDELING",
  "435": "EL_FORDELING",

  "452": "EL_HEATING",
  "453": "EL_HEATING",
  "454": "EL_HEATING",

  "471": "SOLAR_PV",

  "621": "ELEVATOR",
};

export function getCategoryForSystemCode(code: string): KsElementCategory {
  return SYSTEM_CODE_TABLE[code] ?? "UNKNOWN";
}


const FULL_TAG_RX =
  /^\+([A-Z][A-Z0-9_-]*)=(\d{3})\.(\d{3})(?:[\s.\-]+([A-Z]{1,3})(\d{1,4}))?(?:[\s.\-]+([A-Z]\d{1,3}))?\s*$/i;

const SHORT_TAG_RX =
  /^(\d{3})\.(\d{3})[\s.\-]+([A-Z]{1,3})(\d{1,4})(?:[\s.\-]+([A-Z]\d{1,3}))?\s*$/i;

const ELEMENT_ONLY_RX = /^(\d{3})\.(\d{3})\s*$/;


export function parseKsTag(raw: string | null | undefined): KsTag | null {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/^\uFEFF/, "");
  if (trimmed.length === 0) return null;

  const fullMatch = trimmed.match(FULL_TAG_RX);
  if (fullMatch) {
    const [
      ,
      system,
      systemCode,
      elementNumber,
      meterPrefix,
      meterNum,
      variant,
    ] = fullMatch;
    const meterIndex =
      meterPrefix && meterNum
        ? `${meterPrefix.toUpperCase()}${meterNum}`
        : null;
    return buildKsTag({
      raw,
      system: system?.toUpperCase() ?? null,
      systemCode,
      elementNumber,
      meterIndex,
      variant: variant?.toUpperCase() ?? null,
      matchKind: "full",
    });
  }

  const shortMatch = trimmed.match(SHORT_TAG_RX);
  if (shortMatch) {
    const [, systemCode, elementNumber, meterPrefix, meterNum, variant] =
      shortMatch;
    const meterIndex = `${meterPrefix.toUpperCase()}${meterNum}`;
    return buildKsTag({
      raw,
      system: null,
      systemCode,
      elementNumber,
      meterIndex,
      variant: variant?.toUpperCase() ?? null,
      matchKind: "short",
    });
  }

  const elementOnlyMatch = trimmed.match(ELEMENT_ONLY_RX);
  if (elementOnlyMatch) {
    const [, systemCode, elementNumber] = elementOnlyMatch;
    return buildKsTag({
      raw,
      system: null,
      systemCode,
      elementNumber,
      meterIndex: null,
      variant: null,
      matchKind: "element-only",
    });
  }

  return null;
}


function buildKsTag(args: {
  raw: string;
  system: string | null;
  systemCode: string;
  elementNumber: string;
  meterIndex: string | null;
  variant: string | null;
  matchKind: "full" | "short" | "element-only";
}): KsTag {
  const {
    raw,
    system,
    systemCode,
    elementNumber,
    meterIndex,
    variant,
    matchKind,
  } = args;
  const isEnergyMeter = isEnergyMeterEquipmentCode(meterIndex);
  const isMain = meterIndex?.toUpperCase() === "OE001";
  return {
    raw,
    system,
    systemCode,
    elementNumber,
    element: `${systemCode}.${elementNumber}`,
    elementCategory: getCategoryForSystemCode(systemCode),
    meterIndex,
    isEnergyMeter,
    variant,
    isMain,
    matchKind,
  };
}

export function formatKsTag(tag: KsTag): string {
  const parts: string[] = [];
  if (tag.system) parts.push(`+${tag.system}=`);
  parts.push(tag.element);
  if (tag.meterIndex) parts.push(`-${tag.meterIndex}`);
  if (tag.variant) parts.push(`-${tag.variant}`);
  return parts.join("");
}

export function isSameElement(a: KsTag, b: KsTag): boolean {
  return a.systemCode === b.systemCode && a.elementNumber === b.elementNumber;
}
