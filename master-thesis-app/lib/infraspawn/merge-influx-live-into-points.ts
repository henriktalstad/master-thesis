import { isFreshInfluxLiveSample } from "@/lib/infraspawn/live-display-policy";
import type { InfraspawnPointValueSource } from "@/lib/infraspawn/point-value-source";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function resolveInfluxValueSource(
  sampledAt: string,
  now: Date,
): InfraspawnPointValueSource {
  return isFreshInfluxLiveSample(sampledAt, now)
    ? "influx-live"
    : "influx-stale";
}

export function mergeInfluxLiveIntoPoints(
  points: readonly InfraspawnPointListItem[],
  latestByKey: ReadonlyMap<
    string,
    { value: number | null; sampledAt: string }
  >,
  now: Date = new Date(),
): InfraspawnPointListItem[] {
  if (latestByKey.size === 0) {
    return [...points];
  }

  return points.map((point) => {
    const live = latestByKey.get(`${point.sourceId}:${point.objectId}`);
    if (!live) {
      return point;
    }

    return {
      ...point,
      lastValue: live.value,
      lastSampledAt: live.sampledAt,
      valueSource: resolveInfluxValueSource(live.sampledAt, now),
    };
  });
}
