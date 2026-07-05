"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  formatAlarmCycleDuration,
  resolveAlarmGroupDisplayCycle,
  type AlarmCycleHistoryRow,
  type InfraspawnAlarmPointGroup,
} from "@/lib/infraspawn/group-alarm-events";
import {
  formatInfraspawnAlarmTimestamp,
  formatInfraspawnPointValue,
} from "@/lib/infraspawn/display-format";
import { INFRASPAWN_ALARM_SEVERITY_LABELS } from "@/lib/infraspawn/alarm-severity";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SdAnleggPointChart, type SdAnleggPointChartMarker } from "./sd-anlegg-point-chart";
import {
  SD_ANLEGG_ALARM_SEVERITY_ACCENT,
  SD_ANLEGG_ALARM_SEVERITY_BADGE,
  SD_ANLEGG_BTN_PRESS,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { useSdAnleggAlarmChart } from "./use-sd-anlegg-alarm-chart";
import { sdAnleggChartFallbackFootnote } from "@/lib/sd-anlegg/chart-fallback-samples";
import { SdAnleggPointLocationEditor } from "./sd-anlegg-point-location-editor";
import {
  useSdAnleggCanEditProfile,
  useSdAnleggSiteProfile,
} from "./sd-anlegg-site-profile-context";
import { cn } from "@/lib/utils";

const DEFAULT_HISTORY_ROWS = 6;

type Props = {
  buildingSlug: string;
  group: InfraspawnAlarmPointGroup;
  livePoint?: Pick<
    InfraspawnPointListItem,
    "lastValue" | "lastSampledAt" | "valueSource" | "unit"
  > | null;
};

export function SdAnleggAlarmDetail({
  buildingSlug,
  group,
  livePoint = null,
}: Props) {
  const profile = useSdAnleggSiteProfile();
  const canEditProfile = useSdAnleggCanEditProfile();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { chartSeries, chartHours, chartFallbackSource, isPending: chartPending } =
    useSdAnleggAlarmChart({
      buildingSlug,
      group,
      livePoint,
    });

  const currentValue = livePoint?.lastValue ?? group.currentValue;

  const chartFootnote = sdAnleggChartFallbackFootnote(chartFallbackSource);

  const displayCycle = resolveAlarmGroupDisplayCycle(group);
  const isActive = group.activeEvent != null;
  const duration = formatAlarmCycleDuration(
    displayCycle.activatedAt,
    displayCycle.clearedAt,
  );
  const canExpand = group.historyRows.length > 1;

  const chartMarkers = useMemo((): SdAnleggPointChartMarker[] => {
    const markers: SdAnleggPointChartMarker[] = [
      { timestamp: displayCycle.activatedAt, label: "Aktiv siden" },
    ];
    if (displayCycle.clearedAt) {
      markers.push({
        timestamp: displayCycle.clearedAt,
        label: "Inaktiv",
        color: "var(--chart-2)",
      });
    }
    return markers;
  }, [displayCycle.activatedAt, displayCycle.clearedAt]);

  const chartReferenceValues = useMemo(() => {
    if (group.thresholdValue == null) return [];
    return [
      {
        value: group.thresholdValue,
        label: "Terskel",
      },
    ];
  }, [group.thresholdValue]);

  return (
    <div
      className={cn(
        "rounded-lg border border-border/80",
        "border-l-[3px]",
        SD_ANLEGG_ALARM_SEVERITY_ACCENT[group.severity],
        isActive && "bg-amber-50/30 dark:bg-amber-950/10",
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("size-8 shrink-0", SD_ANLEGG_BTN_PRESS)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Skjul historikk" : "Vis syklushistorikk"}
              onClick={() => setIsExpanded((value) => !value)}
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-150 ease-out",
                  isExpanded && "rotate-180",
                )}
              />
            </Button>
          ) : (
            <span className="size-8 shrink-0" aria-hidden />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "h-5 px-1.5 text-[10px] font-semibold",
                  SD_ANLEGG_ALARM_SEVERITY_BADGE[group.severity],
                )}
              >
                {INFRASPAWN_ALARM_SEVERITY_LABELS[group.severity]}
              </Badge>
              <h3 className="font-medium text-foreground">{group.primaryTitle}</h3>
              {canEditProfile && profile ? (
                <SdAnleggPointLocationEditor
                  buildingSlug={buildingSlug}
                  sourceId={group.sourceId}
                  objectId={group.objectId}
                  profile={profile}
                  canEdit={canEditProfile}
                  signalHint={group.signalLabel}
                  equipmentRef={group.equipmentRef}
                  variant="button"
                />
              ) : null}
              {isActive ? (
                <Badge
                  variant="outline"
                  className="border-amber-600/30 bg-amber-100/80 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  Pågår
                </Badge>
              ) : null}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {group.secondaryLine}
              {group.sourceLabel ? ` · ${group.sourceLabel}` : ""}
            </p>

            {group.cycleCount > 1 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {group.cycleCount} alarmutløsninger
              </p>
            ) : null}

            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <AlarmMetric
                label="Aktiv siden"
                value={formatInfraspawnAlarmTimestamp(displayCycle.activatedAt)}
                valueClassName={isActive ? "text-red-700 dark:text-red-300" : undefined}
              />
              <AlarmMetric
                label="Inaktiv"
                value={
                  displayCycle.clearedAt
                    ? formatInfraspawnAlarmTimestamp(displayCycle.clearedAt)
                    : "—"
                }
                valueClassName={
                  displayCycle.clearedAt
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground"
                }
              />
              <AlarmMetric label="Varighet" value={duration} />
              <AlarmMetric
                label="Verdi ved alarm"
                value={formatInfraspawnPointValue(
                  displayCycle.valueAtActivation,
                  group.unit,
                )}
              />
              {currentValue != null ? (
                <AlarmMetric
                  label="Nåverdi"
                  value={formatInfraspawnPointValue(
                    currentValue,
                    livePoint?.unit ?? group.unit,
                  )}
                />
              ) : null}
              {group.thresholdValue != null ? (
                <AlarmMetric
                  label="Terskelverdi"
                  value={formatInfraspawnPointValue(
                    group.thresholdValue,
                    group.thresholdUnit ?? group.unit,
                  )}
                  hint={
                    group.thresholdSource === "setpoint"
                      ? "Fra tilhørende setpunkt"
                      : undefined
                  }
                />
              ) : null}
            </dl>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Verdi siste 24 timer
              </p>
              {chartPending ? (
                <Skeleton className="h-24 w-full rounded-lg" />
              ) : (
                <SdAnleggPointChart
                  series={chartSeries}
                  hours={chartHours}
                  compact
                  markers={chartMarkers}
                  referenceValues={chartReferenceValues}
                  footnote={chartFootnote}
                />
              )}
            </div>
          </div>
        </div>

        {isExpanded && canExpand ? (
          <AlarmCycleHistory
            historyRows={group.historyRows}
            unit={group.unit}
            showAll={showAllHistory}
            onToggleShowAllAction={() => setShowAllHistory((value) => !value)}
          />
        ) : null}
      </div>
    </div>
  );
}

function AlarmMetric({
  label,
  value,
  valueClassName,
  hint,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-medium tabular-nums text-foreground",
          valueClassName,
        )}
      >
        {value}
      </dd>
      {hint ? (
        <dd className="mt-0.5 text-[11px] text-muted-foreground">{hint}</dd>
      ) : null}
    </div>
  );
}

function AlarmCycleHistory({
  historyRows,
  unit,
  showAll,
  onToggleShowAllAction,
}: {
  historyRows: AlarmCycleHistoryRow[];
  unit: string | null;
  showAll: boolean;
  onToggleShowAllAction: () => void;
}) {
  const visibleRows = showAll
    ? historyRows
    : historyRows.slice(0, DEFAULT_HISTORY_ROWS);
  const hiddenCount = historyRows.length - visibleRows.length;

  return (
    <div className="mt-4 border-t border-border/60 pt-4 pl-11">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Syklushistorikk
      </p>
      <ul className="space-y-2">
        {visibleRows.map((row, index) => (
          <HistoryRow key={historyRowKey(row, index)} row={row} unit={unit} />
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("mt-2 h-8 text-xs text-muted-foreground", SD_ANLEGG_BTN_PRESS)}
          onClick={onToggleShowAllAction}
        >
          Vis {hiddenCount} til
        </Button>
      ) : showAll && historyRows.length > DEFAULT_HISTORY_ROWS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("mt-2 h-8 text-xs text-muted-foreground", SD_ANLEGG_BTN_PRESS)}
          onClick={onToggleShowAllAction}
        >
          Vis færre
        </Button>
      ) : null}
    </div>
  );
}

function historyRowKey(row: AlarmCycleHistoryRow, index: number): string {
  if (row.type === "cycle") return row.event.id;
  return `flap-${row.firstActivatedAt}-${index}`;
}

function HistoryRow({
  row,
  unit,
}: {
  row: AlarmCycleHistoryRow;
  unit: string | null;
}) {
  if (row.type === "flap") {
    return (
      <li className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {row.count} korte utslag
        </span>
        {" · "}
        {formatInfraspawnAlarmTimestamp(row.firstActivatedAt)}
        {" – "}
        {formatInfraspawnAlarmTimestamp(row.lastClearedAt)}
        {" · under 2 min"}
      </li>
    );
  }

  const cycle = row.event;
  const isOngoing = cycle.clearedAt == null;

  return (
    <li
      className={cn(
        "rounded-lg border border-border/60 px-3 py-2 text-xs",
        isOngoing && "border-amber-600/20 bg-amber-50/50 dark:bg-amber-950/15",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "font-medium tabular-nums",
              isOngoing && "text-red-700 dark:text-red-300",
            )}
          >
            {formatInfraspawnAlarmTimestamp(cycle.activatedAt)}
          </span>
          <span className="text-muted-foreground">→</span>
          <span
            className={cn(
              "tabular-nums",
              cycle.clearedAt
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground",
            )}
          >
            {cycle.clearedAt
              ? formatInfraspawnAlarmTimestamp(cycle.clearedAt)
              : "—"}
          </span>
        </div>
        <div className="flex items-baseline gap-2 tabular-nums text-muted-foreground">
          <span>{formatAlarmCycleDuration(cycle.activatedAt, cycle.clearedAt)}</span>
          <span>·</span>
          <span className="text-foreground">
            {formatInfraspawnPointValue(cycle.valueAtActivation, unit)}
          </span>
        </div>
      </div>
    </li>
  );
}
