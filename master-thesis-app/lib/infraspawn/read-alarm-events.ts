import "server-only";

import type {
  InfraspawnAlarmKind,
  InfraspawnAlarmSeverity,
  InfraspawnSystemDomain,
} from "@/generated/client";
import { prisma } from "@/lib/db";
import {
  buildAlarmPointLookupKey,
  loadPointMetaForAlarmKeys,
} from "@/lib/infraspawn/load-point-meta-for-alarm-keys";
import { resolveOsloAlarmDayWindow } from "@/lib/infraspawn/oslo-alarm-day-window";
import type {
  InfraspawnAlarmEventListItem,
  InfraspawnAlarmSummary,
  InfraspawnSeverityCounts,
} from "@/lib/infraspawn/alarm-event-types";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildInfraspawnPointStub } from "@/lib/infraspawn/build-infraspawn-point-stub";

export type {
  InfraspawnAlarmEventListItem,
  InfraspawnAlarmSummary,
  InfraspawnSeverityCounts,
} from "@/lib/infraspawn/alarm-event-types";

function emptySeverityCounts(): InfraspawnSeverityCounts {
  return { a: 0, b: 0, c: 0, fault: 0 };
}

function severityCountsFromGroups(
  groups: readonly {
    severity: InfraspawnAlarmSeverity;
    _count: { severity: number };
  }[],
): InfraspawnSeverityCounts {
  const counts = emptySeverityCounts();
  for (const group of groups) {
    const count = group._count.severity;
    switch (group.severity) {
      case "A":
        counts.a = count;
        break;
      case "B":
        counts.b = count;
        break;
      case "C":
        counts.c = count;
        break;
      case "FAULT":
        counts.fault = count;
        break;
    }
  }
  return counts;
}

function mapEventRow(
  event: {
    id: string;
    sourceId: string;
    objectId: string;
    kind: InfraspawnAlarmKind;
    severity: InfraspawnAlarmSeverity;
    alarmText: string;
    valueAtActivation: number | null;
    valueAtClear: number | null;
    activatedAt: Date;
    clearedAt: Date | null;
    domain: InfraspawnSystemDomain | null;
    metadata: unknown;
    source: { label: string };
  },
  pointLookup: Map<string, InfraspawnPointListItem>,
): InfraspawnAlarmEventListItem {
  const pointKey = `${event.sourceId}:${event.objectId}`;
  const point = pointLookup.get(pointKey);
  const metadata =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : null;

  return {
    id: event.id,
    sourceId: event.sourceId,
    objectId: event.objectId,
    kind: event.kind,
    severity: event.severity,
    alarmText: event.alarmText,
    valueAtActivation: event.valueAtActivation,
    valueAtClear: event.valueAtClear,
    activatedAt: event.activatedAt.toISOString(),
    clearedAt: event.clearedAt?.toISOString() ?? null,
    domain: event.domain,
    sourceLabel: event.source.label,
    currentValue: point?.lastValue ?? null,
    unit: point?.unit ?? (metadata?.unit as string | null) ?? null,
    objectName: point?.objectName ?? null,
    description: point?.description ?? null,
    metadata,
  };
}

async function buildPointLookupForEvents(
  events: readonly { sourceId: string; objectId: string }[],
  livePoints: InfraspawnPointListItem[] | undefined,
): Promise<Map<string, InfraspawnPointListItem>> {
  const lookup = new Map(
    (livePoints ?? []).map((point) => [
      buildAlarmPointLookupKey(point.sourceId, point.objectId),
      point,
    ]),
  );

  if (livePoints?.length || events.length === 0) return lookup;

  const meta = await loadPointMetaForAlarmKeys(events);
  for (const event of events) {
    const key = buildAlarmPointLookupKey(event.sourceId, event.objectId);
    if (lookup.has(key)) continue;
    const row = meta.get(key);
    if (!row) continue;
    lookup.set(key, buildInfraspawnPointStub({
      sourceId: event.sourceId,
      objectId: event.objectId,
      objectName: row.objectName,
      description: row.description,
      unit: row.unit,
    }));
  }

  return lookup;
}

export async function listInfraspawnAlarmEventsForBuilding(input: {
  buildingId: string;
  limit?: number;
  activeOnly?: boolean;
  search?: string;
  domain?: InfraspawnSystemDomain;
  livePoints?: InfraspawnPointListItem[];
}): Promise<InfraspawnAlarmEventListItem[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const search = input.search?.trim();

  const events = await prisma.infraspawnAlarmEvent.findMany({
    where: {
      buildingId: input.buildingId,
      ...(input.activeOnly ? { clearedAt: null } : {}),
      ...(input.domain ? { domain: input.domain } : {}),
      ...(search
        ? {
            OR: [
              { alarmText: { contains: search, mode: "insensitive" } },
              { objectId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      source: { select: { label: true } },
    },
    orderBy: { activatedAt: "desc" },
    take: limit,
  });

  const pointLookup = await buildPointLookupForEvents(events, input.livePoints);

  return events.map((event) => mapEventRow(event, pointLookup));
}

export async function getInfraspawnAlarmSummaryForBuilding(input: {
  buildingId: string;
  livePoints?: InfraspawnPointListItem[];
}): Promise<InfraspawnAlarmSummary> {
  const { start: todayStart, end: todayEnd } = resolveOsloAlarmDayWindow();

  const [activeCount, activeSeverityGroups, todaySeverityGroups, latestActiveRow] =
    await Promise.all([
      prisma.infraspawnAlarmEvent.count({
        where: { buildingId: input.buildingId, clearedAt: null },
      }),
      prisma.infraspawnAlarmEvent.groupBy({
        by: ["severity"],
        where: { buildingId: input.buildingId, clearedAt: null },
        _count: { severity: true },
      }),
      prisma.infraspawnAlarmEvent.groupBy({
        by: ["severity"],
        where: {
          buildingId: input.buildingId,
          activatedAt: { gte: todayStart, lt: todayEnd },
        },
        _count: { severity: true },
      }),
      prisma.infraspawnAlarmEvent.findFirst({
        where: { buildingId: input.buildingId, clearedAt: null },
        include: { source: { select: { label: true } } },
        orderBy: { activatedAt: "desc" },
      }),
    ]);

  const bySeverity = severityCountsFromGroups(activeSeverityGroups);
  const todayCounts = severityCountsFromGroups(todaySeverityGroups);

  const summaryEvents = latestActiveRow ? [latestActiveRow] : [];
  const pointLookup = await buildPointLookupForEvents(
    summaryEvents,
    input.livePoints,
  );

  const latestActive = latestActiveRow
    ? mapEventRow(latestActiveRow, pointLookup)
    : null;

  return {
    activeCount,
    bySeverity,
    todayCounts,
    latestActive,
  };
}
