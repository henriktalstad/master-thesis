import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { InfraspawnSystemDomain } from "@/generated/client/enums";
import {
  pointMatchesInfraspawnSystemDomain,
  type InfraspawnSystemDomain as Domain,
} from "@/lib/infraspawn/system-domain";
import {
  anleggsenhetSlug,
  buildAnleggsenhetScopeId,
  inferAnleggsenheterFromPoints,
  type SdAnleggsenhet,
} from "./infer-anleggsenheter";
import type { SdDomainAnleggsenhet } from "./resolve-domain-anleggsenheter";

/** Samlet visning 320.001-3 Fjernvarme (bolig + næring som grener). */
export const HEATING_DISTRICT_COMBINED_UNIT_KEY = "3200013";

/** TR001 Forbruksvann / tappevann. */
export const HEATING_TAPWATER_UNIT_KEY = "310001";

/** Dykkpumper pumpekum. */
export const HEATING_SUMP_PITS_UNIT_KEY = "310010";

export const HEATING_CURATED_UNIT_KEYS = [
  HEATING_DISTRICT_COMBINED_UNIT_KEY,
  HEATING_TAPWATER_UNIT_KEY,
  HEATING_SUMP_PITS_UNIT_KEY,
] as const;

export type HeatingCuratedUnitKey = (typeof HEATING_CURATED_UNIT_KEYS)[number];

const CURATED_DISPLAY: Record<
  HeatingCuratedUnitKey,
  { displayName: string; sortOrder: number }
> = {
  [HEATING_DISTRICT_COMBINED_UNIT_KEY]: {
    displayName: "320.001-3 Fjernvarme",
    sortOrder: 1,
  },
  [HEATING_TAPWATER_UNIT_KEY]: {
    displayName: "310.001 Forbruksvann",
    sortOrder: 2,
  },
  [HEATING_SUMP_PITS_UNIT_KEY]: {
    displayName: "310.010 Pumpekummer",
    sortOrder: 3,
  },
};

export function isHeatingCuratedUnitKey(
  unitKey: string,
): unitKey is HeatingCuratedUnitKey {
  return (HEATING_CURATED_UNIT_KEYS as readonly string[]).includes(unitKey);
}

function objectNameRef(point: InfraspawnPointListItem): string {
  return (point.objectName ?? point.objectId ?? "").trim();
}

export function pointBelongsToHeatingCuratedUnit(
  point: InfraspawnPointListItem,
  unitKey: HeatingCuratedUnitKey,
): boolean {
  const name = objectNameRef(point);
  if (!name) return false;

  switch (unitKey) {
    case HEATING_TAPWATER_UNIT_KEY:
      return /^310\.001/i.test(name);
    case HEATING_SUMP_PITS_UNIT_KEY:
      return /^310\.010/i.test(name);
    case HEATING_DISTRICT_COMBINED_UNIT_KEY:
      return (
        /^320\.00[123]/i.test(name) ||
        /^32000[123]/i.test(name) ||
        /^320001OE001/i.test(name) ||
        /^320003OE001/i.test(name)
      );
    default:
      return false;
  }
}

function filterCuratedPoints(
  points: readonly InfraspawnPointListItem[],
  unitKey: HeatingCuratedUnitKey,
): InfraspawnPointListItem[] {
  return points.filter(
    (point) =>
      pointBelongsToHeatingCuratedUnit(point, unitKey) &&
      pointMatchesInfraspawnSystemDomain(point, InfraspawnSystemDomain.HEATING),
  );
}

function buildCuratedUnit(
  sourceId: string,
  sourceLabel: string,
  unitKey: HeatingCuratedUnitKey,
  points: readonly InfraspawnPointListItem[],
): SdAnleggsenhet {
  const meta = CURATED_DISPLAY[unitKey];
  return {
    id: buildAnleggsenhetScopeId(sourceId, unitKey),
    unitKey,
    sourceId,
    sourceLabel,
    displayName: meta.displayName,
    slug: anleggsenhetSlug(unitKey, sourceId),
    pointCount: points.length,
    primaryDomain: InfraspawnSystemDomain.HEATING,
    detectionConfidence: "high",
    detectionMethod: "prefix",
    objectIds: points.map((p) => p.objectId),
  };
}

/**
 * Kuraterte varmeprosesser i stedet for rå TFM-enheter + ugruppert.
 */
export function resolveCuratedHeatingDomainUnits(
  points: readonly InfraspawnPointListItem[],
  sources: readonly { id: string; label: string }[],
): SdDomainAnleggsenhet[] {
  const entries: SdDomainAnleggsenhet[] = [];

  for (const source of sources) {
    const sourcePoints = points.filter((p) => p.sourceId === source.id);
    if (sourcePoints.length === 0) continue;

    for (const unitKey of HEATING_CURATED_UNIT_KEYS) {
      const domainPoints = filterCuratedPoints(sourcePoints, unitKey);
      if (domainPoints.length === 0) continue;

      entries.push({
        unit: buildCuratedUnit(
          source.id,
          source.label,
          unitKey,
          domainPoints,
        ),
        domainPoints,
      });
    }
  }

  return entries.sort((a, b) => {
    const orderA =
      CURATED_DISPLAY[a.unit.unitKey as HeatingCuratedUnitKey]?.sortOrder ?? 99;
    const orderB =
      CURATED_DISPLAY[b.unit.unitKey as HeatingCuratedUnitKey]?.sortOrder ?? 99;
    return orderA - orderB;
  });
}

/** Fallback når kuraterte enheter mangler (f.eks. testdata uten 310.xxx). */
export function shouldUseCuratedHeatingNav(
  points: readonly InfraspawnPointListItem[],
  domain: Domain,
): boolean {
  if (domain !== InfraspawnSystemDomain.HEATING) return false;
  const curated = resolveCuratedHeatingDomainUnits(points, [
    { id: "probe", label: "probe" },
  ]);
  void curated;
  return points.some(
    (p) =>
      pointMatchesInfraspawnSystemDomain(p, InfraspawnSystemDomain.HEATING) &&
      (/^320\.00[123]/i.test(objectNameRef(p)) ||
        /^310\.001/i.test(objectNameRef(p)) ||
        /^310\.010/i.test(objectNameRef(p))),
  );
}

export function resolveHeatingNavUnits(
  points: readonly InfraspawnPointListItem[],
  sources: readonly { id: string; label: string }[],
  domain: Domain,
): SdDomainAnleggsenhet[] {
  if (domain !== InfraspawnSystemDomain.HEATING) {
    return [];
  }

  const curated = resolveCuratedHeatingDomainUnits(points, sources);
  if (curated.length > 0) {
    return curated;
  }

  const { units } = inferAnleggsenheterFromPoints(points, sources);
  return units
    .filter((unit) => unit.unitKey !== "__ungrouped__")
    .map((unit) => {
      const objectIds = new Set(unit.objectIds);
      const domainPoints = points.filter(
        (p) =>
          p.sourceId === unit.sourceId &&
          objectIds.has(p.objectId) &&
          pointMatchesInfraspawnSystemDomain(p, domain),
      );
      return { unit, domainPoints };
    })
    .filter((entry) => entry.domainPoints.length > 0);
}
