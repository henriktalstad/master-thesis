"use client";

import {
  activeCountForSeverity,
  ALARM_SEVERITY_LANE_LABELS,
  ALARM_SEVERITY_LANES,
  todayCountForSeverity,
  type SeverityLaneId,
} from "@/lib/infraspawn/alarm-overview";
import type { InfraspawnAlarmSummary } from "@/lib/infraspawn/alarm-event-types";
import { INFRASPAWN_ALARM_SEVERITY_LABELS } from "@/lib/infraspawn/alarm-severity";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SD_ANLEGG_ALARM_SEVERITY_BADGE } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  summary: InfraspawnAlarmSummary | undefined;
  className?: string;
  lanes?: readonly SeverityLaneId[];
};

function laneEmptyCopy(severity: SeverityLaneId): string {
  if (severity === "FAULT") return "Ingen feil i dag";
  return `Ingen ${severity}-alarmer i dag`;
}

function todayCountLabel(severity: SeverityLaneId, today: number): string {
  if (severity === "FAULT") {
    return today === 1 ? "1 feil i dag" : `${today} feil i dag`;
  }
  return today === 1
    ? `1 ${severity}-alarm i dag`
    : `${today} ${severity}-alarmer i dag`;
}

function laneStatsCopy(
  summary: InfraspawnAlarmSummary,
  severity: SeverityLaneId,
): { label: string; title?: string } {
  const today = todayCountForSeverity(summary.todayCounts, severity);
  const active = activeCountForSeverity(summary.bySeverity, severity);

  if (today === 0 && active === 0) {
    return { label: laneEmptyCopy(severity) };
  }

  if (active > 0 && today === 0) {
    return {
      label: `${active} aktiv · 0 i dag`,
      title: "Aktiv alarm som ikke ble aktivert i dag",
    };
  }

  if (active > 0 && today > 0 && active !== today) {
    return {
      label: `${active} aktiv · ${today} i dag`,
    };
  }

  return {
    label: todayCountLabel(severity, today),
  };
}

function SdAnleggAlarmSeverityLaneRow({
  severity,
  summary,
}: {
  severity: SeverityLaneId;
  summary: InfraspawnAlarmSummary | undefined;
}) {
  const stats = summary
    ? laneStatsCopy(summary, severity)
    : { label: laneEmptyCopy(severity) };
  const today = summary ? todayCountForSeverity(summary.todayCounts, severity) : 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Badge
          className={cn(
            "h-5 shrink-0 px-1.5 text-[10px] font-semibold",
            SD_ANLEGG_ALARM_SEVERITY_BADGE[severity],
          )}
        >
          {INFRASPAWN_ALARM_SEVERITY_LABELS[severity]}
        </Badge>
        <span className="truncate text-sm text-foreground">
          {ALARM_SEVERITY_LANE_LABELS[severity]}
        </span>
      </div>
      {stats.title ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "shrink-0 cursor-help text-sm tabular-nums",
                today > 0 || stats.label.includes("aktiv")
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {stats.label}
            </span>
          </TooltipTrigger>
          <TooltipContent>{stats.title}</TooltipContent>
        </Tooltip>
      ) : (
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums",
            today > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {stats.label}
        </span>
      )}
    </div>
  );
}

export function SdAnleggAlarmSeverityLanes({
  summary,
  className = "mt-4 space-y-2",
  lanes = ALARM_SEVERITY_LANES,
}: Props) {
  return (
    <ul className={className}>
      {lanes.map((severity) => (
        <li key={severity}>
          <SdAnleggAlarmSeverityLaneRow severity={severity} summary={summary} />
        </li>
      ))}
    </ul>
  );
}
