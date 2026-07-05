import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export function sdAnleggPointKey(
  point: Pick<InfraspawnPointListItem, "sourceId" | "objectId">,
): string {
  return `${point.sourceId}:${point.objectId}`;
}

export function isSdAnleggPointSelected(
  point: Pick<InfraspawnPointListItem, "sourceId" | "objectId"> | undefined,
  selectedKeys: ReadonlySet<string>,
): boolean {
  if (!point) return false;
  return selectedKeys.has(sdAnleggPointKey(point));
}

export function buildSdAnleggPointMap(
  points: readonly InfraspawnPointListItem[],
): Map<string, InfraspawnPointListItem> {
  return new Map(points.map((point) => [sdAnleggPointKey(point), point]));
}

export function resolveSdAnleggSelectedPoints(
  selectedKeys: readonly string[],
  pointsByKey: ReadonlyMap<string, InfraspawnPointListItem>,
): InfraspawnPointListItem[] {
  const resolved: InfraspawnPointListItem[] = [];
  for (const key of selectedKeys) {
    const point = pointsByKey.get(key);
    if (point) resolved.push(point);
  }
  return resolved;
}

export function initialSdAnleggSelectedKeys(
  points: InfraspawnPointListItem[],
): string[] {
  const first = points[0];
  return first ? [sdAnleggPointKey(first)] : [];
}
