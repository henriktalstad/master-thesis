import {
  formatRelativeMeasurementAge,
  minutesSinceIso,
} from "@/lib/infraspawn/display-format";
import { SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES } from "@/lib/infraspawn/live-display-policy";
import { isInfluxLivePointSource, isInfluxSamplePointSource } from "@/lib/infraspawn/point-value-source";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggDomainSegment } from "@/lib/sd-anlegg/anleggsenhet-routes";
import {
  resolveLatestInfraspawnPointSampleIso,
  resolveScopedLivePointsForFreshness,
} from "@/lib/sd-anlegg/overview-key-point-freshness";

export function resolveLatestSampleIsoForValueSource(
  points: readonly Pick<
    InfraspawnPointListItem,
    "lastSampledAt" | "valueSource"
  >[],
  source: InfraspawnPointListItem["valueSource"],
): string | null {
  return resolveLatestInfraspawnPointSampleIso(
    points.filter((point) => point.valueSource === source),
  );
}

export function hasActiveInfluxLiveStream(
  points: readonly Pick<
    InfraspawnPointListItem,
    "lastSampledAt" | "valueSource"
  >[],
  now: Date = new Date(),
): boolean {
  const latestInfluxIso = resolveLatestSampleIsoForValueSource(
    points,
    "influx-live",
  );
  if (!latestInfluxIso) return false;
  const ageMinutes = minutesSinceIso(latestInfluxIso, now);
  return (
    ageMinutes != null && ageMinutes <= SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES
  );
}

export function resolveSdAnleggLiveDisplaySubtitle(input: {
  livePoints: readonly InfraspawnPointListItem[];
  unitObjectIds?: readonly string[];
  domain?: SdAnleggDomainSegment | null;
  oldestSuccessfulSyncAt: string | null;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  const scoped = resolveScopedLivePointsForFreshness(input.livePoints, {
    unitObjectIds: input.unitObjectIds,
    domain: input.domain ?? null,
  });

  if (scoped.length === 0) {
    return input.oldestSuccessfulSyncAt
      ? `Lagret · ${formatRelativeMeasurementAge(input.oldestSuccessfulSyncAt, now)}`
      : null;
  }

  const latestInfluxIso = resolveLatestInfraspawnPointSampleIso(
    scoped.filter((point) => isInfluxSamplePointSource(point.valueSource)),
  );
  const latestSyncIso = resolveLatestSampleIsoForValueSource(
    scoped,
    "postgres-sync",
  );

  if (latestInfluxIso && scoped.some((point) => isInfluxLivePointSource(point.valueSource))) {
    const ageMinutes = minutesSinceIso(latestInfluxIso, now);
    const isStreamFresh =
      ageMinutes != null && ageMinutes <= SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES;

    if (isStreamFresh) {
      return `Live · ${formatRelativeMeasurementAge(latestInfluxIso, now)}`;
    }
  }

  const savedIso =
    latestSyncIso ?? latestInfluxIso ?? input.oldestSuccessfulSyncAt;
  if (savedIso) {
    return `Lagret · ${formatRelativeMeasurementAge(savedIso, now)}`;
  }

  return null;
}
