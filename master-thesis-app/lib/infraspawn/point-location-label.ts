import { isTechnicalAlarmSignalRef } from "@/lib/infraspawn/alarm-signal-label";
import { parseInfraspawnTfmIdentity } from "@/lib/infraspawn/parse-infraspawn-tfm-identity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type InfraspawnPointLocationInput = Pick<
  InfraspawnPointListItem,
  "objectId" | "objectName" | "description" | "sourceLabel"
>;

const SIGNAL_PREFIX =
  /^(romtemperatur|temperatur|temp\.?|målt\s*verdi|measured\s*value)\s+/i;

type LocationPattern = {
  pattern: RegExp;
  format: (match: RegExpMatchArray, blockLetter: string | null) => string;
};

const LOCATION_PATTERNS: readonly LocationPattern[] = [
  {
    pattern: /heiss?jakt(?:\s+bygg\s*([A-Z0-9]))?/i,
    format: (match, blockLetter) => {
      const letter = match[1]?.toUpperCase() ?? blockLetter;
      return letter ? `Heissjakt bygg ${letter}` : "Heissjakt";
    },
  },
  {
    pattern: /heis(?:rom|sjak)?(?:\s+bygg\s*([A-Z0-9]))?/i,
    format: (match, blockLetter) => {
      const letter = match[1]?.toUpperCase() ?? blockLetter;
      return letter ? `Heis bygg ${letter}` : "Heis";
    },
  },
  {
    pattern: /trapp(?:erom|ehus)?(?:\s+bygg\s*([A-Z0-9]))?/i,
    format: (match, blockLetter) => {
      const letter = match[1]?.toUpperCase() ?? blockLetter;
      return letter ? `Trapperom bygg ${letter}` : "Trapperom";
    },
  },
  {
    pattern: /teknisk(?:\s+rom)?(?:\s+bygg\s*([A-Z0-9]))?/i,
    format: (match, blockLetter) => {
      const letter = match[1]?.toUpperCase() ?? blockLetter;
      return letter ? `Teknisk rom bygg ${letter}` : "Teknisk rom";
    },
  },
];

function normalizeLocationText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => {
      if (/^[A-Z0-9]{1,3}$/.test(word)) return word.toUpperCase();
      if (word.toLowerCase() === "bygg") return "bygg";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function extractBlockLetterFromSourceLabel(
  sourceLabel: string | null | undefined,
): string | null {
  if (!sourceLabel?.trim()) return null;
  const match =
    sourceLabel.match(/\bblokk\s*([A-Z0-9])\b/i) ??
    sourceLabel.match(/\bbygg\s*([A-Z0-9])\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function looksTechnicalLocation(text: string): boolean {
  if (isTechnicalAlarmSignalRef(text)) return true;
  if (/^\d{3}[._]\d{3}/i.test(text)) return true;
  if (/^[A-Z]{2,3}\d{2,4}(?:[._-][A-Z0-9]+)?$/i.test(text)) return true;
  return false;
}

export function extractLocationPhraseFromText(
  text: string | null | undefined,
  blockLetter: string | null = null,
): string | null {
  const trimmed = normalizeLocationText(text ?? "");
  if (!trimmed || looksTechnicalLocation(trimmed)) return null;

  for (const { pattern, format } of LOCATION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return format(match, blockLetter);
  }

  const withoutSignal = trimmed.replace(SIGNAL_PREFIX, "").trim();
  if (
    withoutSignal &&
    withoutSignal !== trimmed &&
    !looksTechnicalLocation(withoutSignal)
  ) {
    for (const { pattern, format } of LOCATION_PATTERNS) {
      const match = withoutSignal.match(pattern);
      if (match) return format(match, blockLetter);
    }
    return titleCaseWords(withoutSignal);
  }

  return null;
}

function resolvePointIdentity(input: InfraspawnPointLocationInput) {
  return parseInfraspawnTfmIdentity({
    objectName: input.objectName ?? input.objectId,
    description: input.description,
    sourceLabel: input.sourceLabel,
  });
}

function isRelatedPoint(
  target: InfraspawnPointLocationInput,
  candidate: InfraspawnPointLocationInput,
): boolean {
  if (target.sourceLabel && candidate.sourceLabel) {
    if (target.sourceLabel !== candidate.sourceLabel) return false;
  }

  const targetIdentity = resolvePointIdentity(target);
  const candidateIdentity = resolvePointIdentity(candidate);

  if (
    targetIdentity?.equipmentCode &&
    candidateIdentity?.equipmentCode &&
    targetIdentity.equipmentCode === candidateIdentity.equipmentCode
  ) {
    return true;
  }

  if (
    targetIdentity?.elementKey &&
    candidateIdentity?.elementKey &&
    targetIdentity.elementKey === candidateIdentity.elementKey
  ) {
    return true;
  }

  return normalizeInfraspawnObjectId(target.objectId) ===
    normalizeInfraspawnObjectId(candidate.objectId);
}

/** `362.001RT601_MV` og `362001RT601_MV` behandles som samme punkt. */
export function normalizeInfraspawnObjectId(objectId: string): string {
  return objectId.replace(/(\d{3})\.(\d{3})/g, "$1$2").toUpperCase();
}

export function findLocationFromRelatedPoints(
  target: InfraspawnPointLocationInput,
  relatedPoints: readonly InfraspawnPointLocationInput[] | undefined,
  blockLetter: string | null,
): string | null {
  if (!relatedPoints?.length) return null;

  for (const point of relatedPoints) {
    if (
      normalizeInfraspawnObjectId(point.objectId) ===
      normalizeInfraspawnObjectId(target.objectId)
    ) {
      continue;
    }
    if (!isRelatedPoint(target, point)) continue;

    for (const text of [point.description, point.objectName]) {
      const location = extractLocationPhraseFromText(text, blockLetter);
      if (location) return location;
    }
  }

  return null;
}

/** Automatisk lokasjon fra Infraspawn-meta (description, objectName, krysspunkt). */
export function resolveInfraspawnPointLocationLabel(input: {
  point: InfraspawnPointLocationInput;
  relatedPoints?: readonly InfraspawnPointLocationInput[];
}): string | null {
  const blockLetter = extractBlockLetterFromSourceLabel(input.point.sourceLabel);

  for (const text of [input.point.description, input.point.objectName]) {
    const direct = extractLocationPhraseFromText(text, blockLetter);
    if (direct) return direct;
  }

  const fromRelated = findLocationFromRelatedPoints(
    input.point,
    input.relatedPoints,
    blockLetter,
  );
  if (fromRelated) return fromRelated;

  return null;
}

export function isInfraspawnRoomTemperaturePoint(
  point: InfraspawnPointLocationInput,
): boolean {
  const haystack = `${point.objectId} ${point.objectName ?? ""} ${point.description ?? ""}`;
  if (/RT\d{3}.*_MV/i.test(haystack)) return true;
  if (/romtemp|room.?temp|innertemp/i.test(haystack)) return true;
  return false;
}
