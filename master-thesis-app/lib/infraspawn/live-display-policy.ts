import { resolveInfluxMaxLookbackHours } from "@/lib/infraspawn/bucket-aggregate";

export const SD_ANLEGG_LIVE_POLL_MS = 15_000;
export const SD_ANLEGG_LIVE_POLL_TAIL_INTERVAL_MS = 15_000;
export const SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES = 5;

export const SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES =
  SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES + 1;

export function sdAnleggLiveInfluxQueryLookbackHours(): number {
  return resolveInfluxMaxLookbackHours();
}

/** @deprecated Bruk sdAnleggLiveInfluxQueryLookbackHours() */
export const SD_ANLEGG_LIVE_INFLUX_QUERY_LOOKBACK_HOURS =
  sdAnleggLiveInfluxQueryLookbackHours();

/** @deprecated Bruk SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES */
export const SD_ANLEGG_LIVE_INFLUX_LOOKBACK_MINUTES =
  SD_ANLEGG_LIVE_INFLUX_STREAM_LOOKBACK_MINUTES;

export const SD_ANLEGG_LIVE_INFLUX_CHUNK_SIZE = 40;
export const SD_ANLEGG_LIVE_INFLUX_BATCH_PARALLEL = 4;
export const SD_ANLEGG_LIVE_INFLUX_OBJECT_QUERY_PARALLEL = 8;
export const SD_ANLEGG_INITIAL_TAIL_MAX_OBJECT_IDS = 48;
export const SD_ANLEGG_POLL_TAIL_MAX_OBJECT_IDS = 24;

export type SdAnleggLiveLoadProfile = "initial-paint" | "poll";

export function isFreshInfluxLiveSample(
  sampledAt: string,
  now: Date = new Date(),
): boolean {
  const ageMs = now.getTime() - new Date(sampledAt).getTime();
  if (Number.isNaN(ageMs)) return false;
  return ageMs <= SD_ANLEGG_LIVE_STREAM_FRESH_MINUTES * 60_000;
}
