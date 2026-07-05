export const INFRASPAWN_SAMPLE_RESOLUTIONS = ["15m", "hour", "day"] as const;

export type InfraspawnSampleResolution =
  (typeof INFRASPAWN_SAMPLE_RESOLUTIONS)[number];

export const INFRASPAWN_RESOLUTION_15M = "15m" as const;
export const INFRASPAWN_RESOLUTION_HOUR = "hour" as const;
export const INFRASPAWN_RESOLUTION_DAY = "day" as const;

/** Default antall dager vi beholder 15m-rader før rollup til hour. */
export function getInfraspawn15mRetentionDays(): number {
  const raw = process.env.INFRASPAWN_15M_RETENTION_DAYS;
  const parsed = raw ? Number.parseInt(raw, 10) : 90;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
}

/** Velg primær oppløsning for lesing basert på antall timer i vinduet. */
export function resolvePrimaryResolutionForHours(
  hours: number,
): InfraspawnSampleResolution {
  if (hours <= 90 * 24) return INFRASPAWN_RESOLUTION_15M;
  if (hours <= 730 * 24) return INFRASPAWN_RESOLUTION_HOUR;
  return INFRASPAWN_RESOLUTION_DAY;
}

/** Map intern DB-oppløsning til UI time-series-format. */
export function toTimeSeriesResolution(
  resolution: InfraspawnSampleResolution,
): "15min" | "hour" | "day" {
  if (resolution === INFRASPAWN_RESOLUTION_15M) return "15min";
  if (resolution === INFRASPAWN_RESOLUTION_DAY) return "day";
  return "hour";
}

/** Lavere rank = finere oppløsning (matcher DISTINCT ON i latest-postgres-samples). */
export function infraspawnSampleResolutionRank(resolution: string): number {
  if (resolution === INFRASPAWN_RESOLUTION_15M) return 0;
  if (resolution === INFRASPAWN_RESOLUTION_HOUR) return 1;
  if (resolution === INFRASPAWN_RESOLUTION_DAY) return 2;
  return 3;
}
