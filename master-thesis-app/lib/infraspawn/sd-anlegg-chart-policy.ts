export const SD_ANLEGG_SERIES_HOURS = 72;
export const SD_ANLEGG_MAX_SERIES_HOURS = 720;

export const SD_ANLEGG_CHART_RANGE_OPTIONS = [
  { hours: 24, label: "24 t" },
  { hours: 72, label: "72 t" },
  { hours: 168, label: "7 d" },
  { hours: 720, label: "30 d" },
] as const;

export type SdAnleggChartRangeHours =
  (typeof SD_ANLEGG_CHART_RANGE_OPTIONS)[number]["hours"];

export const SD_ANLEGG_MIRROR_BUCKET_MS = 15 * 60_000;
/** Sync/graf-tillegg — ikke brukt for live visnings-poll. */
export const SD_ANLEGG_INFLUX_TAIL_MAX_HOURS = 2;
export const SD_ANLEGG_INFLUX_TAIL_MIN_MINUTES = 15;
export const SD_ANLEGG_LIST_LOOKBACK_MINUTES = 15;

export {
  SD_ANLEGG_LIVE_INFLUX_CHUNK_SIZE,
  SD_ANLEGG_LIVE_INFLUX_LOOKBACK_MINUTES,
  SD_ANLEGG_LIVE_POLL_MS,
} from "@/lib/infraspawn/live-display-policy";

import { SD_ANLEGG_LIVE_POLL_MS } from "@/lib/infraspawn/live-display-policy";

/** @deprecated Bruk SD_ANLEGG_LIVE_POLL_MS */
export const SD_ANLEGG_LIST_POLL_MS = SD_ANLEGG_LIVE_POLL_MS;
/** @deprecated Bruk SD_ANLEGG_LIVE_POLL_MS */
export const SD_ANLEGG_WORKSPACE_POLL_MS = SD_ANLEGG_LIVE_POLL_MS;

export const SD_ANLEGG_CHART_POLL_MS = SD_ANLEGG_MIRROR_BUCKET_MS;
