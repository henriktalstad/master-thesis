import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { InfraspawnKeyPointRole } from "@/lib/infraspawn/point-vocabulary";

export type OverviewKeyPointCard = {
  role: InfraspawnKeyPointRole;
  label: string;
  point: InfraspawnPointListItem;
};

export type OverviewDashboard = {
  keyPoints: OverviewKeyPointCard[];
  supplyReturnDelta: number | null;
};

/** Roller som vises på oversikt (utetemp i header, alarm i alarmkort). */
export const OVERVIEW_KEY_POINT_DISPLAY_ROLES: readonly InfraspawnKeyPointRole[] = [
  "supply_temp",
  "return_temp",
  "power",
  "flow",
  "energy",
  "valve",
  "pump",
  "volume",
];

export function selectOverviewKeyPoints(
  dashboard: OverviewDashboard,
  limit = 6,
): OverviewKeyPointCard[] {
  const byRole = new Map(
    dashboard.keyPoints.map((card) => [card.role, card] as const),
  );
  const selected: OverviewKeyPointCard[] = [];

  for (const role of OVERVIEW_KEY_POINT_DISPLAY_ROLES) {
    const card = byRole.get(role);
    if (!card) continue;
    selected.push(card);
    if (selected.length >= limit) break;
  }

  return selected;
}
