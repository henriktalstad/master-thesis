"use client";

import { useMemo } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import {
  ALARM_SEVERITY_LANES,
  groupActiveEventsBySeverity,
  type SeverityLaneId,
} from "@/lib/infraspawn/alarm-overview";
import type { InfraspawnAlarmSummary } from "@/lib/infraspawn/alarm-event-types";
import {
  formatActiveAlarmAge,
  formatInfraspawnAlarmTimestamp,
  formatInfraspawnPointValue,
} from "@/lib/infraspawn/display-format";
import { INFRASPAWN_ALARM_SEVERITY_LABELS } from "@/lib/infraspawn/alarm-severity";
import { resolveAlarmDisplayForEvent } from "@/lib/infraspawn/resolve-alarm-display-for-event";
import { Badge } from "@/components/ui/badge";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggOverviewAlarmsData } from "@/queries/infraspawn";
import { useSdAnleggOpenAlarm } from "./sd-anlegg-alarm-modal";
import { useSdAnleggEffectivePointMapping } from "./use-sd-anlegg-effective-point-mapping";
import { SdAnleggOverviewWidget } from "./sd-anlegg-overview-widget";
import { SdAnleggOverviewWidgetSkeleton } from "./sd-anlegg-overview-widget-skeleton";
import {
  SD_ANLEGG_ALARM_SEVERITY_ACCENT,
  SD_ANLEGG_ALARM_SEVERITY_BADGE,
  SD_ANLEGG_BTN_PRESS,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn, osloYmdFromDate } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  overviewData: SdAnleggOverviewAlarmsData | undefined;
  livePoints: InfraspawnPointListItem[] | undefined;
  isPending: boolean;
  isError: boolean;
};

function formatActiveAlarmTime(activatedAt: string): string {
  const eventYmd = osloYmdFromDate(new Date(activatedAt));
  const todayYmd = osloYmdFromDate(new Date());
  if (eventYmd === todayYmd) {
    return formatInfraspawnAlarmTimestamp(activatedAt);
  }
  return formatActiveAlarmAge(activatedAt);
}

export function SdAnleggOverviewAlarmsCard({
  buildingSlug,
  overviewData,
  livePoints,
  isPending,
  isError,
}: Props) {
  const { openAlarmAction } = useSdAnleggOpenAlarm();
  const { featuredPointRefs, pointDisplayOverrides, livePoints: livePointsFromMapping } =
    useSdAnleggEffectivePointMapping(buildingSlug);

  const summary = overviewData?.summary;
  const lanes = groupActiveEventsBySeverity(overviewData?.events ?? []);
  const hasActiveAlarms = (summary?.activeCount ?? 0) > 0;

  const activeAlarms = useMemo(() => {
    const items: Array<{
      severity: SeverityLaneId;
      event: NonNullable<(typeof lanes)[SeverityLaneId][number]>;
      extraCount: number;
    }> = [];

    for (const severity of ALARM_SEVERITY_LANES) {
      const laneEvents = lanes[severity];
      const topEvent = laneEvents[0];
      if (!topEvent) continue;
      items.push({
        severity,
        event: topEvent,
        extraCount: laneEvents.length > 1 ? laneEvents.length - 1 : 0,
      });
    }

    return items;
  }, [lanes]);

  const resolvedLivePoints = livePoints ?? livePointsFromMapping;

  return (
    <SdAnleggOverviewWidget
      title="Aktive alarmer"
      titleId="sd-anlegg-overview-alarms-title"
      subtitle={isPending ? "Laster …" : buildActiveSubtitle(summary)}
      icon={Bell}
      iconClassName={hasActiveAlarms ? "text-warning" : undefined}
      footer={{
        href: `/sd-anlegg/${buildingSlug}/alarmer`,
        label: "Åpne alarmlogg",
      }}
    >
      {isPending ? (
        <SdAnleggOverviewWidgetSkeleton rows={2} />
      ) : isError ? (
        <p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Kunne ikke laste alarmer.
        </p>
      ) : !hasActiveAlarms ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-border/70 bg-muted/15 px-3 py-3">
          <CheckCircle2
            className="size-5 shrink-0 text-emerald-600/85 dark:text-emerald-400/85"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            Ingen aktive alarmer akkurat nå.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {activeAlarms.map(({ severity, event, extraCount }) => {
            const display = resolveAlarmDisplayForEvent(event, {
              featuredPointRefs,
              pointDisplayOverrides,
              livePoints: resolvedLivePoints,
            });
            const currentValue =
              event.currentValue != null
                ? formatInfraspawnPointValue(event.currentValue, event.unit)
                : null;

            return (
              <li key={`${event.sourceId}:${event.objectId}`}>
                <button
                  type="button"
                  onClick={() =>
                    openAlarmAction(event.sourceId, event.objectId)
                  }
                  className={cn(
                    "group/alarm-row w-full rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-left",
                    "border-l-[3px] transition-[background-color,transform] duration-150 ease-out",
                    SD_ANLEGG_ALARM_SEVERITY_ACCENT[severity],
                    SD_ANLEGG_BTN_PRESS,
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/45",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Badge
                      className={cn(
                        "mt-0.5 h-5 shrink-0 px-1.5 text-[10px] font-semibold",
                        SD_ANLEGG_ALARM_SEVERITY_BADGE[severity],
                      )}
                    >
                      {INFRASPAWN_ALARM_SEVERITY_LABELS[severity]}
                    </Badge>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {display.primaryTitle}
                        </span>
                        {extraCount > 0 ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            +{extraCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {display.secondaryLine}
                      </p>
                    </div>

                    <div className="shrink-0 text-right leading-tight">
                      {currentValue ? (
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {currentValue}
                        </p>
                      ) : null}
                      <time
                        dateTime={event.activatedAt}
                        className={cn(
                          "block text-[11px] tabular-nums text-muted-foreground",
                          currentValue && "mt-0.5",
                        )}
                      >
                        {formatActiveAlarmTime(event.activatedAt)}
                      </time>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SdAnleggOverviewWidget>
  );
}

function buildActiveSubtitle(summary: InfraspawnAlarmSummary | undefined): string {
  if (!summary || summary.activeCount === 0) {
    return "Ingen aktive alarmer akkurat nå.";
  }
  return summary.activeCount === 1
    ? "1 aktiv hendelse"
    : `${summary.activeCount} aktive hendelser`;
}
