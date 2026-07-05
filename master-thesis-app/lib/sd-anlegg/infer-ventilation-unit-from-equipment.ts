import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import { extractInfraspawnEquipmentCodes } from "@/lib/infraspawn/parse-point-ks-tag";
import {
  inferInfraspawnSystemDomain,
  InfraspawnSystemDomain,
} from "@/lib/infraspawn/system-domain";
import {
  inferVentilationSiblingFromThermalUnitKey,
  isVentilationSystemElementKey,
} from "@/lib/infraspawn/tfm-element-keys";

const EQUIPMENT_WITH_DIGITS = /^(JV|KA|QD|LX|RT|RP|SB|JP)(\d{2,4})$/i;

const HAYSTACK_360_BLOCK = /\b(360[.\s]?\d{3})\b/i;

/** Tappevann/vannsystem (310.xxx) — ikke AHU utstyrsbånd. */
const TAP_WATER_ELEMENT_PREFIX = /^310\.\d{3}/i;

const BACNET_VENT_NAME =
  /^(AI_|AO_|DO_|BO_|DI_|AV_|AG_|BV_|BG_)/i;

const BACNET_SUPPLY_ROLE =
  /SAF(?:Flow|Pressure|Start)?|SupplyAir|FilterGuard|IntakeAir|Frostprot|SupplySetpoint|UnitMode|\bSFP\b/i;

const BACNET_EXHAUST_ROLE =
  /EAF(?:Flow|Pressure|Start)?|ExtractAir|Efficiency(?:Temp)?/i;

export type VentilationUnitInferenceMethod =
  | "equipment_band"
  | "bacnet_role"
  | "source_label";

/** Utstyrsnummer 401 → bolig (360.101), 501 → næring (360.102). */
export function inferVentilationUnitKeyFromEquipmentDigits(
  digits: string,
): string | null {
  const normalized = digits.replace(/\D/g, "");
  const band =
    normalized.length >= 3 ? normalized.slice(-3) : normalized.padStart(3, "0");
  const n = parseInt(band, 10);
  if (Number.isNaN(n)) return null;
  if (n >= 400 && n < 500) return "360101";
  if (n >= 500 && n < 600) return "360102";
  if (n >= 600 && n < 700) return "362001";
  return null;
}

const BOLIG_VENT_UNIT_KEY = inferVentilationUnitKeyFromEquipmentDigits("401");
const NAERING_VENT_UNIT_KEY = inferVentilationUnitKeyFromEquipmentDigits("501");

type VentilationPointHaystackInput = {
  objectId: string;
  objectName?: string | null;
  description?: string | null;
  unit?: string | null;
};

function ventilationPointHaystack(point: VentilationPointHaystackInput): string {
  return infraspawnPointHaystack({
    objectId: point.objectId,
    objectName: point.objectName ?? null,
    description: point.description ?? null,
    unit: point.unit ?? null,
  });
}

export function extractVentilationUnitKeyFromSourceLabel(
  sourceLabel: string,
): string | null {
  const match = sourceLabel.match(HAYSTACK_360_BLOCK);
  if (!match?.[0]) return null;
  const normalized = match[0].replace(/[.\s]/g, "").toLowerCase();
  return isVentilationSystemElementKey(normalized) ? normalized : null;
}

const AHU_EQUIPMENT_PREFIXES = new Set(["JV", "KA", "QD", "LX"]);

function isAhuEquipmentBand(prefix: string, digits: string): boolean {
  const normalized =
    digits.length >= 3 ? digits.slice(-3) : digits.padStart(3, "0");
  if (AHU_EQUIPMENT_PREFIXES.has(prefix)) return true;
  if (prefix === "SB" && (normalized.startsWith("501") || normalized.startsWith("401"))) {
    return true;
  }
  return false;
}

export function inferVentilationUnitKeyFromEquipmentPoint(input: {
  objectName?: string | null;
  description?: string | null;
}): { unitKey: string; method: VentilationUnitInferenceMethod } | null {
  const objectName = input.objectName?.trim() ?? "";
  if (objectName && TAP_WATER_ELEMENT_PREFIX.test(objectName)) {
    return null;
  }

  for (const code of extractInfraspawnEquipmentCodes(input)) {
    const match = code.match(EQUIPMENT_WITH_DIGITS);
    if (!match?.[1] || !match[2]) continue;
    const prefix = match[1].toUpperCase();
    const digits =
      match[2].length >= 3 ? match[2].slice(-3) : match[2].padStart(3, "0");
    if (!isAhuEquipmentBand(prefix, digits)) continue;
    const unitKey = inferVentilationUnitKeyFromEquipmentDigits(digits);
    if (unitKey) {
      return { unitKey, method: "equipment_band" };
    }
  }
  return null;
}

export function isFlatBacnetVentilationPoint(input: {
  objectId: string;
  objectName?: string | null;
  description?: string | null;
  unit?: string | null;
}): boolean {
  const objectName = input.objectName?.trim() ?? "";
  if (objectName && TAP_WATER_ELEMENT_PREFIX.test(objectName)) {
    return false;
  }

  const domainInput = {
    objectId: input.objectId,
    objectName: input.objectName ?? null,
    description: input.description ?? null,
    unit: input.unit ?? null,
  };

  const name = objectName || input.objectId.trim();
  const haystack = infraspawnPointHaystack(domainInput);
  const looksBacnet =
    BACNET_VENT_NAME.test(name) ||
    /SAF|EAF|FilterGuard|SupplyAir|ExtractAir|IntakeAir|Frostprot/i.test(haystack);
  if (!looksBacnet) {
    return inferInfraspawnSystemDomain(domainInput) === InfraspawnSystemDomain.VENTILATION;
  }
  return inferInfraspawnSystemDomain(domainInput) !== InfraspawnSystemDomain.HEATING;
}

export function inferVentilationUnitKeyFromBacnetPoint(
  input: {
    objectId: string;
    objectName?: string | null;
    description?: string | null;
    unit?: string | null;
  },
  context: {
    sourceLabel?: string;
    dominantVentilationUnitKey?: string | null;
  } = {},
): { unitKey: string; method: VentilationUnitInferenceMethod } | null {
  if (!isFlatBacnetVentilationPoint(input)) return null;

  const fromLabel = extractVentilationUnitKeyFromSourceLabel(
    context.sourceLabel ?? "",
  );
  if (fromLabel) {
    return { unitKey: fromLabel, method: "source_label" };
  }

  if (context.dominantVentilationUnitKey) {
    return {
      unitKey: context.dominantVentilationUnitKey,
      method: "bacnet_role",
    };
  }

  return null;
}

function collectVentilationSiblingCandidates(
  keyedUnitKeys: readonly string[],
): string[] {
  const candidates = new Set<string>();
  for (const unitKey of keyedUnitKeys) {
    const sibling = inferVentilationSiblingFromThermalUnitKey(unitKey);
    if (sibling) candidates.add(sibling);
  }
  return [...candidates];
}

function scoreVentilationBootstrapCandidate(
  unitKey: string,
  ventFlatOrphans: readonly VentilationPointHaystackInput[],
): number {
  let score = 0;
  for (const point of ventFlatOrphans) {
    const equipment = inferVentilationUnitKeyFromEquipmentPoint(point);
    if (equipment?.unitKey === unitKey) score += 10;

    const haystack = ventilationPointHaystack(point);

    if (unitKey === NAERING_VENT_UNIT_KEY) {
      if (BACNET_EXHAUST_ROLE.test(haystack)) score += 2;
      if (/FilterGuard2|ExtractAir|Efficiency(?:Temp)?|\bLX471\b/i.test(haystack)) {
        score += 1;
      }
    }

    if (unitKey === BOLIG_VENT_UNIT_KEY) {
      if (BACNET_SUPPLY_ROLE.test(haystack) && !BACNET_EXHAUST_ROLE.test(haystack)) {
        score += 2;
      }
    }
  }
  return score;
}

function pickVentilationBootstrapAmongSiblings(
  candidates: readonly string[],
  ventFlatOrphans: readonly VentilationPointHaystackInput[],
): string | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const scored = candidates
    .map((unitKey) => ({
      unitKey,
      score: scoreVentilationBootstrapCandidate(unitKey, ventFlatOrphans),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUp = scored[1];
  if (!best || best.score <= 0) return null;
  if (runnerUp && runnerUp.score === best.score) return null;
  return best.unitKey;
}

export function inferVentilationBootstrapUnitKey(input: {
  keyedUnitKeys: readonly string[];
  orphanPoints: readonly VentilationPointHaystackInput[];
}): string | null {
  if (input.keyedUnitKeys.some((key) => isVentilationSystemElementKey(key))) {
    return null;
  }

  const ventFlatOrphans = input.orphanPoints.filter((point) =>
    isFlatBacnetVentilationPoint(point),
  );
  if (ventFlatOrphans.length < 2) return null;

  const hasBacnetRole = ventFlatOrphans.some((point) => {
    const haystack = ventilationPointHaystack(point);
    return (
      BACNET_SUPPLY_ROLE.test(haystack) || BACNET_EXHAUST_ROLE.test(haystack)
    );
  });
  if (!hasBacnetRole) return null;

  const siblingCandidates = collectVentilationSiblingCandidates(
    input.keyedUnitKeys,
  );
  return pickVentilationBootstrapAmongSiblings(
    siblingCandidates,
    ventFlatOrphans,
  );
}

export function pickDominantVentilationUnitKey(
  keyed: ReadonlyMap<string, readonly unknown[]>,
): string | null {
  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [unitKey, points] of keyed) {
    if (!isVentilationSystemElementKey(unitKey)) continue;
    if (points.length > bestCount) {
      bestKey = unitKey;
      bestCount = points.length;
    }
  }
  return bestKey;
}

export function inferFallbackAnleggsenhetUnitKey(
  point: {
    objectId: string;
    objectName?: string | null;
    description?: string | null;
    unit?: string | null;
  },
  context: {
    sourceLabel?: string;
    dominantVentilationUnitKey?: string | null;
  } = {},
): { unitKey: string; method: VentilationUnitInferenceMethod } | null {
  const equipment = inferVentilationUnitKeyFromEquipmentPoint(point);
  if (equipment) return equipment;

  return inferVentilationUnitKeyFromBacnetPoint(point, context);
}
