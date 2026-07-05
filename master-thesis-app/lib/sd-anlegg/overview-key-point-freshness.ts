import { minutesSinceIso } from "@/lib/infraspawn/display-format";

import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  pointMatchesInfraspawnSystemDomain,
  systemDomainFromPathSegment,
} from "@/lib/infraspawn/system-domain";
import type { SdAnleggDomainSegment } from "./anleggsenhet-routes";

export type OverviewMeasurementFreshness = "fresh" | "aging" | "stale" | "unknown";

export function resolveLatestInfraspawnPointSampleIso(
  points: readonly { lastSampledAt: string | null }[],
): string | null {
  let latestMs = 0;
  let latestIso: string | null = null;
  for (const point of points) {
    const sampledAt = point.lastSampledAt;
    if (!sampledAt) continue;
    const ms = new Date(sampledAt).getTime();
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latestIso = sampledAt;
    }
  }
  return latestIso;
}

/** Begrens live-freshness til aktiv anleggsenhet eller fagdomene (ikke hele bygget). */
export function resolveScopedLivePointsForFreshness(
  livePoints: readonly InfraspawnPointListItem[],
  input: {
    unitObjectIds?: readonly string[];
    domain?: SdAnleggDomainSegment | null;
  },
): readonly InfraspawnPointListItem[] {
  if (input.unitObjectIds?.length) {
    const ids = new Set(input.unitObjectIds);
    return livePoints.filter((point) => ids.has(point.objectId));
  }
  if (input.domain) {
    const systemDomain = systemDomainFromPathSegment(input.domain);
    if (systemDomain) {
      return livePoints.filter((point) =>
        pointMatchesInfraspawnSystemDomain(point, systemDomain),
      );
    }
  }
  return livePoints;
}

/** Nyeste sampledAt blant viste nøkkelpunkter. */
export function latestOverviewKeyPointSampleIso(
  cards: { point: { lastSampledAt: string | null } }[],
): string | null {
  return resolveLatestInfraspawnPointSampleIso(cards.map((card) => card.point));
}

export function classifyOverviewMeasurementFreshness(
  sampledAt: string | null,
  now: Date = new Date(),
): OverviewMeasurementFreshness {
  const minutes = minutesSinceIso(sampledAt, now);
  if (minutes == null) return "unknown";
  if (minutes <= 20) return "fresh";
  if (minutes <= 120) return "aging";
  return "stale";
}

export function overviewMeasurementFreshnessLabel(
  freshness: OverviewMeasurementFreshness,
): string | null {
  switch (freshness) {
    case "fresh":
      return null;
    case "aging":
      return "Noen timer siden";
    case "stale":
      return "Data er gamle";
    case "unknown":
      return null;
  }
}
