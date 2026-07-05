import {
  isInfraspawnActiveAlarmPoint,
  isInfraspawnActiveFaultPoint,
} from "@/lib/infraspawn/point-status";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { findBestBindingRuleMatch } from "./match-binding-rule";
import type { SchemaTemplate, TemplateLane } from "./types";

export type CuratedPointListGroup =
  | "all"
  | TemplateLane
  | "alarm_fault"
  | "no_value"
  | "other";

export const CURATED_POINT_LIST_GROUPS = [
  "all",
  "supply",
  "exhaust",
  "heat_recovery",
  "heating",
  "status",
  "alarm_fault",
  "no_value",
  "other",
] as const satisfies readonly CuratedPointListGroup[];

export const CURATED_POINT_LIST_SECTION_ORDER: readonly CuratedPointListGroup[] =
  [
    "supply",
    "exhaust",
    "heat_recovery",
    "heating",
    "status",
    "other",
    "alarm_fault",
    "no_value",
  ];

export const CURATED_POINT_LIST_GROUP_LABELS: Record<
  CuratedPointListGroup,
  string
> = {
  all: "Alle",
  supply: "Tilluft",
  exhaust: "Avtrekk",
  heat_recovery: "Varmegjenvinner",
  heating: "Varmebatteri",
  status: "Drift",
  alarm_fault: "Alarm/feil",
  no_value: "Uten verdi",
  other: "Øvrige",
};

export type CuratedPointSection = {
  group: CuratedPointListGroup;
  label: string;
  points: InfraspawnPointListItem[];
};

export type TemplatePointClassification = {
  laneByKey: Map<string, TemplateLane>;
  counts: Record<CuratedPointListGroup, number>;
  sections: CuratedPointSection[];
  visibleGroups: CuratedPointListGroup[];
};

function pointKey(point: InfraspawnPointListItem): string {
  return `${point.sourceId}:${point.objectId}`;
}

function hasActiveIssue(point: InfraspawnPointListItem): boolean {
  return (
    isInfraspawnActiveFaultPoint(point) ||
    isInfraspawnActiveAlarmPoint(point) ||
    point.statusOutOfService
  );
}

export function buildTemplatePointLaneMap(
  template: SchemaTemplate,
  points: readonly InfraspawnPointListItem[],
  elementKey?: string | null,
): Map<string, TemplateLane> {
  const laneByKey = new Map<string, TemplateLane>();
  const usedKeys = new Set<string>();

  for (const def of template.nodes) {
    const available = points.filter(
      (point) => !usedKeys.has(pointKey(point)),
    );
    const point = findBestBindingRuleMatch(available, def.bind, elementKey);
    if (!point) continue;

    usedKeys.add(pointKey(point));
    laneByKey.set(pointKey(point), def.lane);
  }

  return laneByKey;
}

export function classifyTemplatePoint(
  point: InfraspawnPointListItem,
  laneByKey: ReadonlyMap<string, TemplateLane>,
): CuratedPointListGroup {
  if (hasActiveIssue(point)) return "alarm_fault";
  if (point.lastValue == null || Number.isNaN(point.lastValue)) {
    return "no_value";
  }
  return laneByKey.get(pointKey(point)) ?? "other";
}

function buildCountsFromLaneMap(
  points: readonly InfraspawnPointListItem[],
  laneByKey: ReadonlyMap<string, TemplateLane>,
): Record<CuratedPointListGroup, number> {
  const counts: Record<CuratedPointListGroup, number> = {
    all: points.length,
    supply: 0,
    exhaust: 0,
    heat_recovery: 0,
    heating: 0,
    status: 0,
    alarm_fault: 0,
    no_value: 0,
    other: 0,
  };

  for (const point of points) {
    counts[classifyTemplatePoint(point, laneByKey)] += 1;
  }

  return counts;
}

export function buildTemplatePointClassification(
  points: readonly InfraspawnPointListItem[],
  template: SchemaTemplate,
  elementKey?: string | null,
): TemplatePointClassification {
  const laneByKey = buildTemplatePointLaneMap(template, points, elementKey);
  const counts = buildCountsFromLaneMap(points, laneByKey);
  const visibleGroups = CURATED_POINT_LIST_GROUPS.filter(
    (group) => group === "all" || counts[group] > 0,
  );
  const sections = CURATED_POINT_LIST_SECTION_ORDER.flatMap((group) => {
    if (counts[group] === 0) return [];
    return [
      {
        group,
        label: CURATED_POINT_LIST_GROUP_LABELS[group],
        points: points.filter(
          (point) => classifyTemplatePoint(point, laneByKey) === group,
        ),
      },
    ];
  });

  return { laneByKey, counts, sections, visibleGroups };
}

export function filterTemplatePointsByGroup(
  points: readonly InfraspawnPointListItem[],
  template: SchemaTemplate,
  group: CuratedPointListGroup,
  elementKey?: string | null,
  classification?: TemplatePointClassification,
): InfraspawnPointListItem[] {
  if (group === "all") return [...points];

  const laneByKey =
    classification?.laneByKey ??
    buildTemplatePointLaneMap(template, points, elementKey);
  return points.filter(
    (point) => classifyTemplatePoint(point, laneByKey) === group,
  );
}

export function countTemplatePointsByGroup(
  points: readonly InfraspawnPointListItem[],
  template: SchemaTemplate,
  elementKey?: string | null,
  classification?: TemplatePointClassification,
): Record<CuratedPointListGroup, number> {
  if (classification) return classification.counts;
  return buildTemplatePointClassification(points, template, elementKey).counts;
}

export function listVisibleTemplatePointGroups(
  points: readonly InfraspawnPointListItem[],
  template: SchemaTemplate,
  elementKey?: string | null,
  classification?: TemplatePointClassification,
): CuratedPointListGroup[] {
  if (classification) return classification.visibleGroups;
  return buildTemplatePointClassification(points, template, elementKey).visibleGroups;
}

export function resolveTemplatePointGroupSelection(
  selected: CuratedPointListGroup,
  visibleGroups: readonly CuratedPointListGroup[],
): CuratedPointListGroup {
  if (selected === "all") return "all";
  return visibleGroups.includes(selected) ? selected : "all";
}

export function groupTemplatePointsIntoSections(
  points: readonly InfraspawnPointListItem[],
  template: SchemaTemplate,
  elementKey?: string | null,
  classification?: TemplatePointClassification,
): CuratedPointSection[] {
  if (classification) return classification.sections;
  return buildTemplatePointClassification(points, template, elementKey).sections;
}
