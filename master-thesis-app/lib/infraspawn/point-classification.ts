import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  infraspawnObjectPrefix,
  infraspawnPointHaystack,
} from "@/lib/infraspawn/point-haystack";
import {
  classifyInfraspawnHaystack,
  matchesInfraspawnAlarmName,
} from "@/lib/infraspawn/point-vocabulary";
import {
  isInfraspawnActiveAlarmPoint,
  isInfraspawnActiveFaultPoint,
} from "@/lib/infraspawn/point-status";

export const INFRASPAWN_POINT_CATEGORIES = [
  "all",
  "temperature",
  "pressure",
  "energy",
  "flow",
  "pumps_valves",
  "alarm_fault",
  "no_value",
  "other",
] as const;

export type InfraspawnPointCategory =
  (typeof INFRASPAWN_POINT_CATEGORIES)[number];

export const INFRASPAWN_POINT_CATEGORY_LABELS: Record<
  InfraspawnPointCategory,
  string
> = {
  all: "Alle",
  temperature: "Temperatur",
  pressure: "Trykk",
  energy: "Energi/effekt",
  flow: "Strøm og volum",
  pumps_valves: "Pumper/ventiler",
  alarm_fault: "Alarm/feil",
  no_value: "Uten verdi",
  other: "Øvrige",
};

type ClassifyInput = Pick<
  InfraspawnPointListItem,
  | "objectId"
  | "objectName"
  | "description"
  | "unit"
  | "lastValue"
  | "quality"
  | "statusFault"
  | "statusInAlarm"
  | "statusOutOfService"
>;

function hasActiveIssue(point: ClassifyInput): boolean {
  return (
    isInfraspawnActiveFaultPoint(point) ||
    isInfraspawnActiveAlarmPoint(point) ||
    point.statusOutOfService
  );
}

export function classifyInfraspawnPoint(
  point: ClassifyInput,
): InfraspawnPointCategory {
  if (hasActiveIssue(point)) {
    return "alarm_fault";
  }

  if (point.lastValue == null || Number.isNaN(point.lastValue)) {
    return "no_value";
  }

  const haystack = infraspawnPointHaystack(point);
  const semantic = classifyInfraspawnHaystack({
    haystack,
    unit: point.unit?.toLowerCase() ?? "",
    prefix: infraspawnObjectPrefix(point.objectId),
  });
  if (semantic) return semantic;

  if (matchesInfraspawnAlarmName(haystack)) {
    return "alarm_fault";
  }

  return "other";
}

export function filterInfraspawnPointsByCategory(
  points: readonly InfraspawnPointListItem[],
  category: InfraspawnPointCategory,
): InfraspawnPointListItem[] {
  if (category === "all") return [...points];
  return points.filter((point) => classifyInfraspawnPoint(point) === category);
}

export function countInfraspawnPointsByCategory(
  points: readonly InfraspawnPointListItem[],
): Record<InfraspawnPointCategory, number> {
  const counts: Record<InfraspawnPointCategory, number> = {
    all: points.length,
    temperature: 0,
    pressure: 0,
    energy: 0,
    flow: 0,
    pumps_valves: 0,
    alarm_fault: 0,
    no_value: 0,
    other: 0,
  };

  for (const point of points) {
    counts[classifyInfraspawnPoint(point)] += 1;
  }

  return counts;
}

export function listVisibleInfraspawnPointCategories(
  points: readonly InfraspawnPointListItem[],
): InfraspawnPointCategory[] {
  const counts = countInfraspawnPointsByCategory(points);
  return INFRASPAWN_POINT_CATEGORIES.filter(
    (category) => category === "all" || counts[category] > 0,
  );
}

export function resolveInfraspawnPointCategorySelection(
  selected: InfraspawnPointCategory,
  visibleCategories: readonly InfraspawnPointCategory[],
): InfraspawnPointCategory {
  if (selected === "all") return "all";
  return visibleCategories.includes(selected) ? selected : "all";
}
