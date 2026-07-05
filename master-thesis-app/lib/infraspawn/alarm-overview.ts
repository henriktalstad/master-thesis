import {
  buildInfraspawnAlarmPointKey,
  groupInfraspawnAlarmEventsByPoint,
  type InfraspawnAlarmPointGroup,
  type InfraspawnAlarmPointGroupCore,
} from "@/lib/infraspawn/group-alarm-events";
import type {
  InfraspawnAlarmEventListItem,
  InfraspawnSeverityCounts,
} from "@/lib/infraspawn/alarm-event-types";
import { resolveAlarmThreshold } from "@/lib/infraspawn/resolve-alarm-threshold";
import { buildInfraspawnPointDisplayMapping } from "@/lib/infraspawn/build-infraspawn-point-display-mapping";
import { resolveAlarmDisplayContext } from "@/lib/infraspawn/resolve-alarm-display-context";
import type { SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export type AlarmThresholdStatus = "not_available" | "partial" | "available";

export type InfraspawnAlarmOverview = {
  allGroups: InfraspawnAlarmPointGroup[];
  thresholdStatus: AlarmThresholdStatus;
};

export function parseAlarmModalParam(
  param: string | null | undefined,
): { sourceId: string; objectId: string } | null {
  if (!param?.trim()) return null;
  const colon = param.indexOf(":");
  if (colon <= 0 || colon >= param.length - 1) return null;
  return {
    sourceId: param.slice(0, colon),
    objectId: param.slice(colon + 1),
  };
}

export function formatAlarmModalParam(
  sourceId: string,
  objectId: string,
): string {
  return buildInfraspawnAlarmPointKey(sourceId, objectId);
}

export function enrichAlarmGroupsWithDisplay(
  groups: InfraspawnAlarmPointGroupCore[],
  input?: {
    featuredPointRefs?: readonly SdAnleggFeaturedPointRef[];
    pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[];
    livePoints?: readonly InfraspawnPointListItem[];
  },
): InfraspawnAlarmPointGroup[] {
  const livePoints = input?.livePoints;
  const mapping =
    livePoints && livePoints.length > 0
      ? buildInfraspawnPointDisplayMapping({
          points: livePoints,
          manualOverrides: input?.pointDisplayOverrides,
          manualFeatured: input?.featuredPointRefs,
        })
      : {
          pointDisplayOverrides: input?.pointDisplayOverrides ?? [],
          featuredPointRefs: input?.featuredPointRefs ?? [],
        };

  const pointByKey = new Map(
    (livePoints ?? []).map((point) => [
      buildInfraspawnAlarmPointKey(point.sourceId, point.objectId),
      point,
    ]),
  );

  return groups.map((group) => {
    const point = pointByKey.get(group.key);
    return {
      ...group,
      ...resolveAlarmDisplayContext({
        sourceId: group.sourceId,
        objectId: group.objectId,
        alarmText: group.alarmText,
        sourceLabel: point?.sourceLabel ?? null,
        objectName: point?.objectName ?? null,
        description: point?.description ?? null,
        featuredPointRefs: mapping.featuredPointRefs,
        pointDisplayOverrides: mapping.pointDisplayOverrides,
        relatedPoints: livePoints,
      }),
    };
  });
}

export function enrichAlarmGroupsWithThresholds(
  groups: InfraspawnAlarmPointGroup[],
  livePoints: readonly InfraspawnPointListItem[] | undefined,
  events: readonly InfraspawnAlarmEventListItem[],
): InfraspawnAlarmPointGroup[] {
  const metadataByKey = new Map<string, Record<string, unknown> | null>();
  for (const event of events) {
    metadataByKey.set(`${event.sourceId}:${event.objectId}`, event.metadata);
  }

  return groups.map((group) => {
    const threshold = resolveAlarmThreshold({
      sourceId: group.sourceId,
      objectId: group.objectId,
      unit: group.unit,
      metadata: metadataByKey.get(group.key) ?? null,
      livePoints,
    });

    if (!threshold) return group;

    return {
      ...group,
      thresholdValue: threshold.value,
      thresholdUnit: threshold.unit,
      thresholdSource: threshold.source,
    };
  });
}

export function resolveAlarmThresholdStatus(
  groups: readonly InfraspawnAlarmPointGroup[],
): AlarmThresholdStatus {
  if (groups.length === 0) return "not_available";
  const withThreshold = groups.filter((group) => group.thresholdValue != null).length;
  if (withThreshold === 0) return "not_available";
  if (withThreshold === groups.length) return "available";
  return "partial";
}

export function buildInfraspawnAlarmOverview(input: {
  events: InfraspawnAlarmEventListItem[];
  livePoints?: InfraspawnPointListItem[];
  featuredPointRefs?: readonly SdAnleggFeaturedPointRef[];
  pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[];
}): InfraspawnAlarmOverview {
  const grouped = groupInfraspawnAlarmEventsByPoint(input.events);
  const withDisplay = enrichAlarmGroupsWithDisplay(grouped, {
    featuredPointRefs: input.featuredPointRefs,
    pointDisplayOverrides: input.pointDisplayOverrides,
    livePoints: input.livePoints,
  });
  const allGroups = enrichAlarmGroupsWithThresholds(
    withDisplay,
    input.livePoints,
    input.events,
  );

  return {
    allGroups,
    thresholdStatus: resolveAlarmThresholdStatus(allGroups),
  };
}

export type SeverityLaneId = "A" | "B" | "C" | "FAULT";

export const ALARM_SEVERITY_LANES: readonly SeverityLaneId[] = [
  "A",
  "B",
  "C",
  "FAULT",
] as const;

const severityCountKey: Record<
  SeverityLaneId,
  keyof InfraspawnSeverityCounts
> = {
  A: "a",
  B: "b",
  C: "c",
  FAULT: "fault",
};

export function todayCountForSeverity(
  counts: InfraspawnSeverityCounts,
  severity: SeverityLaneId,
): number {
  return counts[severityCountKey[severity]];
}

export function sumTodayAlarmEventCounts(
  counts: InfraspawnSeverityCounts,
): number {
  return counts.a + counts.b + counts.c + counts.fault;
}

export function activeCountForSeverity(
  counts: InfraspawnSeverityCounts,
  severity: SeverityLaneId,
): number {
  return counts[severityCountKey[severity]];
}

export const ALARM_SEVERITY_LANE_LABELS: Record<SeverityLaneId, string> = {
  A: "A-alarmer",
  B: "B-alarmer",
  C: "C-alarmer",
  FAULT: "Feil",
};

export function groupActiveEventsBySeverity(
  events: readonly InfraspawnAlarmEventListItem[],
): Record<SeverityLaneId, InfraspawnAlarmEventListItem[]> {
  const lanes: Record<SeverityLaneId, InfraspawnAlarmEventListItem[]> = {
    A: [],
    B: [],
    C: [],
    FAULT: [],
  };

  for (const event of events) {
    if (event.clearedAt != null) continue;
    lanes[event.severity].push(event);
  }

  for (const severity of ALARM_SEVERITY_LANES) {
    lanes[severity].sort(
      (a, b) =>
        new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime(),
    );
  }

  return lanes;
}

export function findAlarmGroupByKey(
  groups: readonly InfraspawnAlarmPointGroup[],
  key: string,
): InfraspawnAlarmPointGroup | null {
  return groups.find((group) => group.key === key) ?? null;
}
