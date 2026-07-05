import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function pointKey(point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">) {
  return `${point.sourceId}:${point.objectId}`;
}

/** Behold forrige verdi i klienten når poll returnerer null — til ny Influx-rad kommer. */
export function retainPointValuesAcrossPolls(
  incoming: readonly InfraspawnPointListItem[],
  previousByKey: ReadonlyMap<string, InfraspawnPointListItem>,
): InfraspawnPointListItem[] {
  return incoming.map((point) => {
    if (point.lastValue != null && !Number.isNaN(point.lastValue)) {
      return point;
    }

    const prior = previousByKey.get(pointKey(point));
    if (prior?.lastValue == null || Number.isNaN(prior.lastValue)) {
      return point;
    }

    return {
      ...point,
      lastValue: prior.lastValue,
      lastSampledAt: prior.lastSampledAt ?? point.lastSampledAt,
      valueSource: prior.valueSource,
    };
  });
}

export function indexPointsByKey(
  points: readonly InfraspawnPointListItem[],
): Map<string, InfraspawnPointListItem> {
  return new Map(points.map((point) => [pointKey(point), point]));
}
