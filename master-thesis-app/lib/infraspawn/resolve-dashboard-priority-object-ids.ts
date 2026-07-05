import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  type InfraspawnKeyPointRole,
  matchesInfraspawnAlarmName,
  scoreInfraspawnDashboardRole,
} from "@/lib/infraspawn/point-vocabulary";
import { infraspawnPointHaystack } from "@/lib/infraspawn/point-haystack";
import { isInfraspawnActiveAlarmPoint } from "@/lib/infraspawn/point-status";

export const INFRASPAWN_DASHBOARD_ROLES: readonly InfraspawnKeyPointRole[] = [
  "supply_air_temp",
  "supply_temp",
  "return_temp",
  "outdoor_temp",
  "power",
  "energy",
  "flow",
  "volume",
  "valve",
  "pump",
  "alarm",
];

export function pickBestPointForDashboardRole(
  points: readonly InfraspawnPointListItem[],
  role: InfraspawnKeyPointRole,
): InfraspawnPointListItem | null {
  if (role === "alarm") {
    let best: InfraspawnPointListItem | null = null;
    let bestScore = 0;
    for (const point of points) {
      if (!isInfraspawnActiveAlarmPoint(point)) continue;
      const score =
        6 +
        (matchesInfraspawnAlarmName(infraspawnPointHaystack(point)) ? 2 : 0);
      if (score > bestScore) {
        best = point;
        bestScore = score;
      }
    }
    return best;
  }

  let best: InfraspawnPointListItem | null = null;
  let bestScore = 0;
  for (const point of points) {
    const score = scoreInfraspawnDashboardRole(role, point);
    if (score > bestScore) {
      best = point;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function resolveDashboardPriorityObjectIds(
  points: readonly InfraspawnPointListItem[],
): string[] {
  const ids = new Set<string>();
  for (const role of INFRASPAWN_DASHBOARD_ROLES) {
    const best = pickBestPointForDashboardRole(points, role);
    if (best) ids.add(best.objectId);
  }
  return [...ids];
}
