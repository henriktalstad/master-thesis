import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  InfraspawnSystemDomain,
  pointMatchesInfraspawnSystemDomain,
  systemDomainToPathSegment,
} from "@/lib/infraspawn/system-domain";
import { sdAnleggDomainHref, type SdAnleggDomainSegment } from "./anleggsenhet-routes";
import {
  applyAnleggsenhetDisplayOverridesToDomainEntries,
  type SdAnleggAnleggsenhetDisplayOverride,
} from "./anleggsenhet-display-overrides";
import type { SdAnleggsenhetPointAssignment } from "./anleggsenhet-point-assignments";
import {
  filterPointsForAnleggsenhet,
  inferAnleggsenheterFromPoints,
  SD_ANLEGG_UNGROUPED_UNIT_KEY,
  type SdAnleggsenhet,
} from "./infer-anleggsenheter";
import { resolveHeatingNavUnits } from "./heating-process-units";

export type SdDomainAnleggsenhet = {
  unit: SdAnleggsenhet;
  domainPoints: InfraspawnPointListItem[];
};

function mapDomainAnleggsenheter(
  points: readonly InfraspawnPointListItem[],
  sources: readonly { id: string; label: string }[],
  domain: InfraspawnSystemDomain,
  anleggsenhetDisplayOverrides: readonly SdAnleggAnleggsenhetDisplayOverride[] = [],
  pointAssignments: readonly SdAnleggsenhetPointAssignment[] = [],
): SdDomainAnleggsenhet[] {
  const heatingCurated = resolveHeatingNavUnits(points, sources, domain);
  if (heatingCurated.length > 0 && domain === InfraspawnSystemDomain.HEATING) {
    return applyAnleggsenhetDisplayOverridesToDomainEntries(
      heatingCurated,
      anleggsenhetDisplayOverrides,
    );
  }

  const { units } = inferAnleggsenheterFromPoints(points, sources, {
    pointAssignments,
  });

  const entries = units
    .filter((unit) => unit.unitKey !== SD_ANLEGG_UNGROUPED_UNIT_KEY)
    .map((unit) => {
      const unitPoints = filterPointsForAnleggsenhet(points, unit);
      const domainPoints = unitPoints.filter((point) =>
        pointMatchesInfraspawnSystemDomain(point, domain),
      );
      return { unit, domainPoints };
    });

  return applyAnleggsenhetDisplayOverridesToDomainEntries(
    entries,
    anleggsenhetDisplayOverrides,
  ).sort((a, b) =>
    a.unit.displayName.localeCompare(b.unit.displayName, "nb"),
  );
}

/** Kun enheter med minst ett signal i domenet (ruting, faner, KPI). */
export function resolveDomainAnleggsenheter(
  points: readonly InfraspawnPointListItem[],
  sources: readonly { id: string; label: string }[],
  domain: InfraspawnSystemDomain,
  anleggsenhetDisplayOverrides: readonly SdAnleggAnleggsenhetDisplayOverride[] = [],
  pointAssignments: readonly SdAnleggsenhetPointAssignment[] = [],
): SdDomainAnleggsenhet[] {
  return mapDomainAnleggsenheter(
    points,
    sources,
    domain,
    anleggsenhetDisplayOverrides,
    pointAssignments,
  ).filter((entry) => entry.domainPoints.length > 0);
}

/** Domene-navigasjon — kun enheter med minst ett signal i domenet. */
export function resolveDomainAnleggsenhetNavEntries(
  points: readonly InfraspawnPointListItem[],
  sources: readonly { id: string; label: string }[],
  domain: InfraspawnSystemDomain,
  anleggsenhetDisplayOverrides: readonly SdAnleggAnleggsenhetDisplayOverride[] = [],
  pointAssignments: readonly SdAnleggsenhetPointAssignment[] = [],
): SdDomainAnleggsenhet[] {
  return resolveDomainAnleggsenheter(
    points,
    sources,
    domain,
    anleggsenhetDisplayOverrides,
    pointAssignments,
  );
}

function pickPreferredDomainUnit(
  entries: readonly SdDomainAnleggsenhet[],
): SdDomainAnleggsenhet | null {
  if (entries.length === 0) return null;
  return [...entries].sort(
    (a, b) => b.domainPoints.length - a.domainPoints.length,
  )[0]!;
}

export function findDomainAnleggsenhetBySlug(
  entries: readonly SdDomainAnleggsenhet[],
  unitSlug: string,
): SdDomainAnleggsenhet | null {
  return entries.find((entry) => entry.unit.slug === unitSlug) ?? null;
}

export function resolveSdAnleggDomainHref(
  buildingSlug: string,
  domain: InfraspawnSystemDomain,
  points: readonly InfraspawnPointListItem[] | undefined,
  sources: readonly { id: string; label: string }[],
): string {
  const rawSegment = systemDomainToPathSegment(domain);
  const segment: SdAnleggDomainSegment =
    rawSegment === "ventilasjon" || rawSegment === "varme" || rawSegment === "annet"
      ? rawSegment
      : "annet";
  if (points?.length) {
    const matching = resolveDomainAnleggsenheter(points, sources, domain);
    if (matching.length === 1) {
      return sdAnleggDomainHref(buildingSlug, segment, matching[0]!.unit.slug);
    }
    if (domain === InfraspawnSystemDomain.HEATING && matching.length > 0) {
      const fjernvarme =
        matching.find((e) => e.unit.unitKey === "3200013") ?? matching[0];
      return sdAnleggDomainHref(buildingSlug, segment, fjernvarme!.unit.slug);
    }
    const preferred = pickPreferredDomainUnit(matching);
    if (preferred) {
      const only = preferred.unit;
      const skipDirect =
        matching.length > 1 &&
        (only.unitKey === SD_ANLEGG_UNGROUPED_UNIT_KEY ||
          only.detectionConfidence === "low");
      if (!skipDirect) {
        return sdAnleggDomainHref(buildingSlug, segment, only.slug);
      }
    }
  }
  return sdAnleggDomainHref(buildingSlug, segment);
}
