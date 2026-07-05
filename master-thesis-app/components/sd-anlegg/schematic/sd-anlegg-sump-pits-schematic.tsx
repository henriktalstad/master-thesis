"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import {
  buildSumpPitsPresentationModel,
  type HeatingProcessSlot,
  type SumpPitBranch,
} from "@/lib/sd-anlegg/heating-process-presentation";
import type { SdAnleggChartSeries } from "../sd-anlegg-chart-data";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_SCHEMATIC_CANVAS,
  SD_ANLEGG_SCHEMATIC_HEADER,
  SD_ANLEGG_SCHEMATIC_SHELL,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { SdAnleggSchemaHistoryDialog } from "./sd-anlegg-schema-history-dialog";
import {
  SCHEMATIC_EMPTY_CHART_RANGE_OPTIONS,
  SCHEMATIC_EMPTY_CHART_SERIES,
  SCHEMATIC_EMPTY_POINTS,
  SCHEMATIC_EMPTY_SELECTED_KEYS,
} from "./schematic-defaults";
import { useSchemaHistoryDialog } from "./use-schema-history-dialog";

type Props = {
  buildingSlug: string;
  points?: InfraspawnPointListItem[];
  selectedKeys?: string[];
  onPointSelectAction?: (point: InfraspawnPointListItem) => void;
  onSelectPointsAction?: (points: InfraspawnPointListItem[]) => void;
  className?: string;
  unitDisplayName?: string;
  chartSeries?: SdAnleggChartSeries[];
  dataCoverage?: string | null;
  chartHours?: number;
  chartRangeOptions?: ReadonlyArray<{
    hours: SdAnleggChartRangeHours;
    label: string;
  }>;
  onChartHoursChangeAction?: (hours: SdAnleggChartRangeHours) => void;
  seriesLoading?: boolean;
  seriesError?: Error | null;
  seriesFetching?: boolean;
};

function formatBinary(slot: HeatingProcessSlot): string {
  if (slot.displayValue) return slot.displayValue;
  const v = slot.primaryPoint?.lastValue;
  if (v == null) return "—";
  return Number(v) >= 1 ? "PÅ" : "AV";
}

function PitCard({
  pit,
  onActivate,
}: {
  pit: SumpPitBranch;
  onActivate?: (points: InfraspawnPointListItem[]) => void;
}) {
  const points = pit.drift.relatedPoints.filter(Boolean);
  const driftOn = Number(pit.drift.primaryPoint?.lastValue ?? 0) >= 1;
  const alarmOn = Number(pit.alarm.primaryPoint?.lastValue ?? 0) >= 1;

  return (
    <button
      type="button"
      className={cn(
        "flex min-w-40 flex-1 flex-col items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-center",
        onActivate && SD_ANLEGG_BTN_PRESS,
      )}
      onClick={() => onActivate?.(points)}
      disabled={!onActivate || points.length === 0}
    >
      <p className="text-sm font-semibold">{pit.title}</p>
      <div className="relative h-16 w-24 rounded-b-lg border-x-2 border-b-2 border-muted-foreground/40">
        <div
          className="absolute inset-x-0 bottom-0 rounded-b-md bg-primary/20"
          style={{ height: "55%" }}
          aria-hidden
        />
        <div className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/3 items-center justify-center rounded-full border-2 border-primary/40 bg-background text-xs font-bold text-primary">
          ▶
        </div>
      </div>
      <p className="text-sm font-medium text-primary">{pit.pumpCode}</p>
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        <span
          className={cn(
            "rounded-full px-2 py-0.5",
            driftOn ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          Drift: {formatBinary(pit.drift)}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5",
            alarmOn ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
          )}
        >
          Alarm: {formatBinary(pit.alarm)}
        </span>
      </div>
    </button>
  );
}

export function SdAnleggSumpPitsSchematic({
  buildingSlug,
  points = SCHEMATIC_EMPTY_POINTS,
  selectedKeys = SCHEMATIC_EMPTY_SELECTED_KEYS,
  onPointSelectAction,
  onSelectPointsAction,
  className,
  unitDisplayName,
  chartSeries = SCHEMATIC_EMPTY_CHART_SERIES,
  dataCoverage = null,
  chartHours = 72,
  chartRangeOptions = SCHEMATIC_EMPTY_CHART_RANGE_OPTIONS,
  onChartHoursChangeAction,
  seriesLoading = false,
  seriesError = null,
  seriesFetching = false,
}: Props) {
  const model = useMemo(() => buildSumpPitsPresentationModel(points), [points]);

  const selectPoints = useCallback(
    (slotPoints: readonly InfraspawnPointListItem[]) => {
      if (slotPoints.length === 0) return;
      if (onSelectPointsAction) {
        onSelectPointsAction([...slotPoints]);
        return;
      }
      onPointSelectAction?.(slotPoints[0]!);
    },
    [onSelectPointsAction, onPointSelectAction],
  );

  const { activeTarget, dialogOpen, openTarget, closeDialog, selectChartPoint } =
    useSchemaHistoryDialog(selectPoints, buildingSlug);

  const activatePit = useCallback(
    (pitPoints: InfraspawnPointListItem[]) => {
      if (pitPoints.length === 0) return;
      openTarget({
        code: pitPoints[0]?.objectName ?? "Pumpe",
        roleLabel: "Pumpekum",
        primaryPoint: pitPoints[0],
        relatedPoints: pitPoints,
        displayValue: null,
        stateLabel: null,
      });
    },
    [openTarget],
  );

  const canActivate = Boolean(onSelectPointsAction || onPointSelectAction);

  return (
    <div className={cn(SD_ANLEGG_SCHEMATIC_SHELL, className)}>
      <div className={SD_ANLEGG_SCHEMATIC_HEADER}>
        {unitDisplayName ?? "310.010 Pumpekummer"}
      </div>

      <div className={cn(SD_ANLEGG_SCHEMATIC_CANVAS, "py-2")}>
        <div className="flex flex-wrap justify-center gap-6">
          {model.pits.map((pit) => (
            <PitCard
              key={pit.id}
              pit={pit}
              onActivate={canActivate ? activatePit : undefined}
            />
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Vannstand er illustrasjon — ingen nivåsensor i Infraspawn for dette anlegget.
        </p>
      </div>

      <SdAnleggSchemaHistoryDialog
        target={activeTarget}
        open={dialogOpen}
        onCloseAction={closeDialog}
        chartSeries={chartSeries}
        dataCoverage={dataCoverage}
        chartHours={chartHours}
        chartRangeOptions={chartRangeOptions}
        onChartHoursChangeAction={onChartHoursChangeAction}
        seriesLoading={seriesLoading}
        seriesError={seriesError}
        seriesFetching={seriesFetching}
        chartPointKeys={selectedKeys}
        onSelectChartPointAction={selectChartPoint}
      />
    </div>
  );
}
