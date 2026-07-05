"use client";

import Link from "next/link";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { AhuSlotRole } from "@/lib/sd-anlegg/ahu-blueprint";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import {
  formatInfraspawnAlarmTimestamp,
  formatInfraspawnPointLabel,
} from "@/lib/infraspawn/display-format";
import { formatSdAnleggPointDisplayValue } from "@/lib/sd-anlegg/format-process-slot-display";
import { resolveSchemaSlotStyringHref } from "@/lib/sd-anlegg/schema-styring-links";
import { formatInfraspawnPointTechnicalRef } from "@/lib/infraspawn/point-vocabulary";
import { filterSdAnleggChartPointsForSlot } from "@/lib/sd-anlegg/sd-anlegg-chart-point-filter";
import { resolveInfraspawnPointDisplayStatus } from "@/lib/infraspawn/point-status";
import { sdAnleggPointKey } from "../sd-anlegg-point-key";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { SdAnleggChartSeries } from "../sd-anlegg-chart-data";
import { SdAnleggPointChart } from "../sd-anlegg-point-chart";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_FILTER_ACTIVE,
  SD_ANLEGG_FILTER_BTN,
  SD_ANLEGG_FILTER_IDLE,
  SD_ANLEGG_STATUS_FAULT_BADGE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { SD_ANLEGG_PROCESS_VALUE, SD_ANLEGG_PROCESS_VALUE_CHIP } from "./styles/process-schematic-styles";

const EMPTY_CHART_POINT_KEYS: readonly string[] = [];

export type SdAnleggSchemaHistoryTarget = {
  code: string;
  roleLabel: string;
  slotId?: string;
  slotRole?: AhuSlotRole;
  primaryPoint?: InfraspawnPointListItem;
  relatedPoints: InfraspawnPointListItem[];
  displayValue: string | null;
  stateLabel?: string | null;
};

type Props = {
  target: SdAnleggSchemaHistoryTarget | null;
  open: boolean;
  onCloseAction: () => void;
  buildingSlug?: string;
  chartSeries: SdAnleggChartSeries[];
  dataCoverage: string | null;
  chartHours: number;
  chartRangeOptions: ReadonlyArray<{ hours: SdAnleggChartRangeHours; label: string }>;
  onChartHoursChangeAction?: (hours: SdAnleggChartRangeHours) => void;
  seriesLoading: boolean;
  seriesError: Error | null;
  seriesFetching: boolean;
  chartPointKeys?: readonly string[];
  onSelectChartPointAction?: (point: InfraspawnPointListItem) => void;
};

function statusBadge(point: InfraspawnPointListItem) {
  const status = resolveInfraspawnPointDisplayStatus(point);
  if (status === "alarm") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Alarm
      </Badge>
    );
  }
  if (status === "fault") {
    return (
      <Badge variant="outline" className={SD_ANLEGG_STATUS_FAULT_BADGE}>
        Feil
      </Badge>
    );
  }
  return null;
}

function historyPointHint(point: InfraspawnPointListItem): string | null {
  return formatInfraspawnPointTechnicalRef(point);
}

function formatDialogTitle(target: SdAnleggSchemaHistoryTarget | null): string {
  if (!target) return "Historikk";
  if (target.roleLabel && target.code) {
    return `${target.roleLabel} · ${target.code}`;
  }
  return target.roleLabel || target.code || "Historikk";
}

export function SdAnleggSchemaHistoryDialog({
  target,
  open,
  onCloseAction,
  buildingSlug,
  chartSeries,
  dataCoverage,
  chartHours,
  chartRangeOptions,
  onChartHoursChangeAction,
  seriesLoading,
  seriesError,
  seriesFetching,
  chartPointKeys = EMPTY_CHART_POINT_KEYS,
  onSelectChartPointAction,
}: Props) {
  const primaryPoint = target?.primaryPoint ?? null;
  const relatedPoints = target?.relatedPoints ?? [];
  const chartablePoints = filterSdAnleggChartPointsForSlot(
    target?.slotRole,
    relatedPoints,
  );
  const chartableKeys = new Set(chartablePoints.map((point) => sdAnleggPointKey(point)));
  const activeChartKeys = new Set(chartPointKeys);
  const chartLabel =
    chartSeries.length === 1 ? chartSeries[0]?.label : null;
  const primaryHint = primaryPoint
    ? formatInfraspawnPointTechnicalRef(primaryPoint)
    : null;
  const sampledAt = primaryPoint?.lastSampledAt
    ? formatInfraspawnAlarmTimestamp(primaryPoint.lastSampledAt)
    : null;
  const styringLink =
    buildingSlug && target?.slotId
      ? resolveSchemaSlotStyringHref(buildingSlug, target.slotId)
      : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCloseAction()}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,46rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl",
          "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100",
          "motion-reduce:data-[state=open]:slide-in-from-top-0 motion-reduce:data-[state=closed]:slide-out-to-top-0",
          "motion-reduce:duration-0",
        )}
      >
        <div className="border-b border-border/70 px-4 py-4 sm:px-6">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base leading-snug">
              {formatDialogTitle(target)}
              {primaryPoint ? statusBadge(primaryPoint) : null}
            </DialogTitle>
            {primaryHint ? (
              <p className="font-mono text-xs text-muted-foreground">{primaryHint}</p>
            ) : null}
            <DialogDescription>
              {chartLabel
                ? `Trend for ${chartLabel.toLowerCase()}.`
                : "Verdier og trend for valgt utstyr."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {target?.displayValue ? (
                  <span
                    className={cn(
                      SD_ANLEGG_PROCESS_VALUE_CHIP,
                      SD_ANLEGG_PROCESS_VALUE,
                      "text-2xl",
                    )}
                  >
                    {target.displayValue}
                  </span>
                ) : null}
                {target?.stateLabel ? (
                  <span
                    className={cn(
                      SD_ANLEGG_PROCESS_VALUE_CHIP,
                      "text-sm font-medium text-muted-foreground",
                    )}
                  >
                    {target.stateLabel}
                  </span>
                ) : null}
              </div>
              {sampledAt ? (
                <p className="text-xs text-muted-foreground">
                  Sist målt {sampledAt}
                </p>
              ) : null}
              {dataCoverage ? (
                <p className="text-xs text-muted-foreground">{dataCoverage}</p>
              ) : null}
              {styringLink ? (
                <Link
                  href={styringLink.href}
                  className="inline-block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Se {styringLink.label} i styring
                </Link>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {chartRangeOptions.map((option) => (
                <button
                  key={option.hours}
                  type="button"
                  onClick={() => onChartHoursChangeAction?.(option.hours)}
                  className={cn(
                    SD_ANLEGG_FILTER_BTN,
                    SD_ANLEGG_BTN_PRESS,
                    "h-8 px-2.5 text-xs",
                    chartHours === option.hours
                      ? SD_ANLEGG_FILTER_ACTIVE
                      : SD_ANLEGG_FILTER_IDLE,
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {seriesLoading ? (
              <div
                className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border/70 bg-muted/20"
                aria-busy="true"
                aria-live="polite"
              >
                <Spinner variant="ring" size={28} label="Laster graf …" />
                <p className="text-sm text-muted-foreground">Henter historikk for valgt signal …</p>
              </div>
            ) : seriesError ? (
              <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                {seriesError.message}
              </p>
            ) : (
              <div
                className={cn(
                  "relative transition-opacity duration-150 ease-out",
                  seriesFetching && chartSeries.length > 0 && "opacity-60",
                )}
              >
                {seriesFetching && chartSeries.length > 0 ? (
                  <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
                    <Spinner variant="dots" size={16} label="Oppdaterer graf …" />
                  </div>
                ) : null}
                <SdAnleggPointChart series={chartSeries} hours={chartHours} />
              </div>
            )}
          </div>

          {relatedPoints.length > 1 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Velg signal for graf
                {chartablePoints.length < relatedPoints.length
                  ? " · trykk og andre uforenlige verdier vises kun som sanntid"
                  : null}
              </p>
              <ul className="space-y-1.5">
              {relatedPoints.map((point) => {
                const label = formatInfraspawnPointLabel(point);
                const hint = historyPointHint(point);
                const pointKey = sdAnleggPointKey(point);
                const chartSelectable = chartableKeys.has(pointKey);
                const chartActive = chartSelectable && activeChartKeys.has(pointKey);
                const rowClassName = cn(
                  "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm text-left transition-colors",
                  chartActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/70 bg-muted/20",
                  chartSelectable && "hover:bg-muted/40",
                );

                const valueNode = (
                  <span
                    className={cn(
                      SD_ANLEGG_PROCESS_VALUE_CHIP,
                      "shrink-0 tabular-nums",
                      point.lastValue == null || Number.isNaN(point.lastValue)
                        ? "text-muted-foreground"
                        : SD_ANLEGG_PROCESS_VALUE,
                    )}
                  >
                    {formatSdAnleggPointDisplayValue(point, target?.slotRole)}
                  </span>
                );

                const labelNode = (
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {label}
                      {chartActive ? (
                        <span className="ml-2 text-xs font-normal text-primary">
                          I graf
                        </span>
                      ) : null}
                    </span>
                    {hint ? (
                      <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                        {hint}
                      </span>
                    ) : null}
                  </div>
                );

                if (!chartSelectable || !onSelectChartPointAction) {
                  return (
                    <li key={pointKey} className={rowClassName}>
                      {labelNode}
                      {valueNode}
                    </li>
                  );
                }

                return (
                  <li key={pointKey}>
                    <button
                      type="button"
                      className={rowClassName}
                      aria-pressed={chartActive}
                      onClick={() => onSelectChartPointAction(point)}
                    >
                      {labelNode}
                      {valueNode}
                    </button>
                  </li>
                );
              })}
              </ul>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
