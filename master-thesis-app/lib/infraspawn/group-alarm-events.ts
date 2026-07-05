import type { InfraspawnAlarmEventListItem } from "@/lib/infraspawn/alarm-event-types";
import type { AlarmDisplayContext } from "@/lib/infraspawn/resolve-alarm-display-context";

export type InfraspawnAlarmPointGroupCore = {
  key: string;
  sourceId: string;
  objectId: string;
  alarmText: string;
  severity: InfraspawnAlarmEventListItem["severity"];
  sourceLabel: string | null;
  unit: string | null;
  currentValue: number | null;
  thresholdValue: number | null;
  thresholdUnit: string | null;
  thresholdSource: "metadata" | "setpoint" | null;
  events: InfraspawnAlarmEventListItem[];
  activeEvent: InfraspawnAlarmEventListItem | null;
  cycleCount: number;
  historyRows: AlarmCycleHistoryRow[];
};

export type InfraspawnAlarmPointGroup = InfraspawnAlarmPointGroupCore &
  AlarmDisplayContext;

export type AlarmCycleHistoryRow =
  | { type: "cycle"; event: InfraspawnAlarmEventListItem }
  | {
      type: "flap";
      count: number;
      firstActivatedAt: string;
      lastClearedAt: string;
      unit: string | null;
    };

const SHORT_CYCLE_MS = 2 * 60_000;

export function isValidAlarmCycleEvent(
  event: Pick<InfraspawnAlarmEventListItem, "activatedAt" | "clearedAt">,
): boolean {
  if (!event.clearedAt) return true;
  return (
    new Date(event.clearedAt).getTime() >= new Date(event.activatedAt).getTime()
  );
}

function sanitizeAlarmEventsForGrouping(
  events: InfraspawnAlarmEventListItem[],
): InfraspawnAlarmEventListItem[] {
  return events.filter(isValidAlarmCycleEvent);
}

function pointKey(event: InfraspawnAlarmEventListItem): string {
  return buildInfraspawnAlarmPointKey(event.sourceId, event.objectId);
}

export function buildInfraspawnAlarmPointKey(
  sourceId: string,
  objectId: string,
): string {
  return `${sourceId}:${objectId}`;
}

function cycleDurationMs(
  activatedAt: string,
  clearedAt: string | null,
): number | null {
  if (!clearedAt) return null;
  return new Date(clearedAt).getTime() - new Date(activatedAt).getTime();
}

function isShortFlapCycle(event: InfraspawnAlarmEventListItem): boolean {
  if (!event.clearedAt) return false;
  const ms = cycleDurationMs(event.activatedAt, event.clearedAt);
  return ms != null && ms >= 0 && ms < SHORT_CYCLE_MS;
}

function eventFingerprint(event: InfraspawnAlarmEventListItem): string {
  return [
    event.activatedAt,
    event.clearedAt ?? "",
    event.valueAtActivation ?? "",
  ].join("|");
}

export function dedupeAlarmEvents(
  events: InfraspawnAlarmEventListItem[],
): InfraspawnAlarmEventListItem[] {
  const seen = new Set<string>();
  const result: InfraspawnAlarmEventListItem[] = [];
  for (const event of events) {
    const fingerprint = eventFingerprint(event);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    result.push(event);
  }
  return result;
}

export function sortAlarmEventsForDisplay(
  events: InfraspawnAlarmEventListItem[],
): InfraspawnAlarmEventListItem[] {
  const actives = events
    .filter((event) => event.clearedAt == null)
    .sort(
      (a, b) =>
        new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime(),
    );
  const cleared = events
    .filter((event) => event.clearedAt != null)
    .sort(
      (a, b) =>
        new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime(),
    );
  return [...actives, ...cleared];
}

export function buildAlarmCycleHistoryRows(
  events: InfraspawnAlarmEventListItem[],
): AlarmCycleHistoryRow[] {
  const sorted = sortAlarmEventsForDisplay(dedupeAlarmEvents(events));
  const rows: AlarmCycleHistoryRow[] = [];
  let index = 0;

  while (index < sorted.length) {
    const event = sorted[index]!;

    if (isShortFlapCycle(event)) {
      let end = index + 1;
      while (end < sorted.length && isShortFlapCycle(sorted[end]!)) {
        end += 1;
      }
      if (end - index >= 2) {
        rows.push({
          type: "flap",
          count: end - index,
          firstActivatedAt: sorted[index]!.activatedAt,
          lastClearedAt: sorted[end - 1]!.clearedAt!,
          unit: sorted[index]!.unit,
        });
        index = end;
        continue;
      }
    }

    rows.push({ type: "cycle", event });
    index += 1;
  }

  return rows;
}

export function resolveAlarmGroupDisplayCycle(
  group: Pick<InfraspawnAlarmPointGroup, "activeEvent" | "events">,
): InfraspawnAlarmEventListItem {
  return group.activeEvent ?? group.events[0]!;
}

export function groupInfraspawnAlarmEventsByPoint(
  events: InfraspawnAlarmEventListItem[],
): InfraspawnAlarmPointGroupCore[] {
  const byPoint = new Map<string, InfraspawnAlarmEventListItem[]>();

  for (const event of sanitizeAlarmEventsForGrouping(events)) {
    const key = pointKey(event);
    const bucket = byPoint.get(key);
    if (bucket) bucket.push(event);
    else byPoint.set(key, [event]);
  }

  const groups = [...byPoint.values()].map((groupEvents) => {
    const sorted = sortAlarmEventsForDisplay(groupEvents);
    const deduped = dedupeAlarmEvents(sorted);
    const latest = sorted[0]!;
    const activeEvent = sorted.find((event) => event.clearedAt == null) ?? null;

    return {
      key: pointKey(latest),
      sourceId: latest.sourceId,
      objectId: latest.objectId,
      alarmText: latest.alarmText,
      severity: latest.severity,
      sourceLabel: latest.sourceLabel,
      unit: latest.unit,
      currentValue: latest.currentValue,
      thresholdValue: null,
      thresholdUnit: null,
      thresholdSource: null,
      events: sorted,
      activeEvent,
      cycleCount: deduped.length,
      historyRows: buildAlarmCycleHistoryRows(groupEvents),
    };
  });

  return groups.sort((a, b) => {
    if (a.activeEvent && !b.activeEvent) return -1;
    if (!a.activeEvent && b.activeEvent) return 1;
    const aTime = resolveAlarmGroupDisplayCycle(a).activatedAt;
    const bTime = resolveAlarmGroupDisplayCycle(b).activatedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export function formatAlarmCycleDuration(
  activatedAt: string,
  clearedAt: string | null,
): string {
  if (!clearedAt) return "Pågår";

  const ms = new Date(clearedAt).getTime() - new Date(activatedAt).getTime();
  if (ms < 0) return "Ugyldig tidsrekke";
  if (ms <= 0) return "Under 1 min";

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Under 1 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes > 0 ? `${hours} t ${restMinutes} min` : `${hours} t`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days} d ${restHours} t` : `${days} d`;
}
