import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { formatInfraspawnPointLabel } from "@/lib/infraspawn/display-format";
import {
  OVERVIEW_KEY_POINT_DISPLAY_ROLES,
  selectOverviewKeyPoints,
  type OverviewDashboard,
  type OverviewKeyPointCard,
} from "@/lib/infraspawn/dashboard-overview";
import {
  INFRASPAWN_DASHBOARD_ROLE_LABELS,
  type InfraspawnKeyPointRole,
} from "@/lib/infraspawn/point-vocabulary";
import { pickBestPointForDashboardRole, INFRASPAWN_DASHBOARD_ROLES } from "@/lib/infraspawn/resolve-dashboard-priority-object-ids";
import { isInfraspawnActiveAlarmPoint } from "@/lib/infraspawn/point-status";

export type { InfraspawnKeyPointRole };

export type InfraspawnKeyPointCard = OverviewKeyPointCard;

export type InfraspawnBuildingDashboard = OverviewDashboard & {
  activeAlarmCount: number;
  dataCoverageHours: number | null;
};

export { OVERVIEW_KEY_POINT_DISPLAY_ROLES, selectOverviewKeyPoints };

function computeCoverageHours(
  points: readonly InfraspawnPointListItem[],
): number | null {
  const timestamps = points
    .map((point) => point.lastSampledAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) return null;

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  return Math.max(0, Math.round((max - min) / (60 * 60 * 1000)));
}

export function buildInfraspawnBuildingDashboard(
  points: readonly InfraspawnPointListItem[],
): InfraspawnBuildingDashboard {
  const usedKeys = new Set<string>();
  const keyPoints: InfraspawnKeyPointCard[] = [];

  for (const role of INFRASPAWN_DASHBOARD_ROLES) {
    const point = pickBestPointForDashboardRole(points, role);
    if (!point) continue;

    const key = `${point.sourceId}:${point.objectId}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);

    keyPoints.push({
      role,
      label: INFRASPAWN_DASHBOARD_ROLE_LABELS[role],
      point: {
        ...point,
        objectName: point.objectName ?? formatInfraspawnPointLabel(point),
      },
    });
  }

  const supply = keyPoints.find((card) => card.role === "supply_temp")?.point;
  const ret = keyPoints.find((card) => card.role === "return_temp")?.point;
  const supplyReturnDelta =
    supply?.lastValue != null &&
    ret?.lastValue != null &&
    !Number.isNaN(supply.lastValue) &&
    !Number.isNaN(ret.lastValue)
      ? supply.lastValue - ret.lastValue
      : null;

  return {
    keyPoints,
    supplyReturnDelta,
    activeAlarmCount: points.filter(isInfraspawnActiveAlarmPoint).length,
    dataCoverageHours: computeCoverageHours(points),
  };
}
