"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import {
  buildTapWaterPresentationModel,
  resolveHeatingHistoryGroup,
  type HeatingProcessSlot,
} from "@/lib/sd-anlegg/heating-process-presentation";
import type { SdAnleggChartSeries } from "../sd-anlegg-chart-data";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_SCHEMATIC_CANVAS,
  SD_ANLEGG_SCHEMATIC_HEADER,
  SD_ANLEGG_SCHEMATIC_SHELL,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import {
  SdAnleggSchemaHistoryDialog,
  type SdAnleggSchemaHistoryTarget,
} from "./sd-anlegg-schema-history-dialog";
import {
  SCHEMATIC_EMPTY_CHART_RANGE_OPTIONS,
  SCHEMATIC_EMPTY_CHART_SERIES,
  SCHEMATIC_EMPTY_POINTS,
  SCHEMATIC_EMPTY_SELECTED_KEYS,
} from "./schematic-defaults";
import { useSchemaHistoryDialog } from "./use-schema-history-dialog";
import { TapWaterFlowSchematicFromModel } from "./tap-water-flow-schematic-from-model";

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

function slotToTarget(slot: HeatingProcessSlot): SdAnleggSchemaHistoryTarget {
  return {
    code: slot.equipmentCode,
    roleLabel: slot.label,
    primaryPoint: slot.primaryPoint,
    relatedPoints: slot.relatedPoints,
    displayValue: slot.displayValue,
    stateLabel: null,
  };
}

export function SdAnleggTapWaterSchematic({
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
  const model = useMemo(() => buildTapWaterPresentationModel(points), [points]);
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);

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

  const activateSlot = useCallback(
    (slot: HeatingProcessSlot) => {
      openTarget(slotToTarget(slot));
    },
    [openTarget],
  );

  const canActivate = Boolean(onSelectPointsAction || onPointSelectAction);

  return (
    <div className={cn(SD_ANLEGG_SCHEMATIC_SHELL, className)}>
      <div
        className={cn(
          SD_ANLEGG_SCHEMATIC_HEADER,
          "flex items-center justify-between gap-3 text-left",
        )}
      >
        <span>{unitDisplayName ?? "310.001 Forbruksvann"}</span>
        {model.setpoint.displayValue ? (
          <span className="text-xs font-normal text-muted-foreground">
            SP{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {model.setpoint.displayValue}
            </span>
          </span>
        ) : null}
      </div>

      <div className={SD_ANLEGG_SCHEMATIC_CANVAS}>
        <TapWaterFlowSchematicFromModel
          className="px-1 pb-1"
          model={model}
          selectedKeys={selected}
          onActivate={canActivate ? activateSlot : undefined}
        />

        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Primær tilførsel fra 320.001 · settpunkt TR001{" "}
          {model.setpoint.displayValue ? (
            <button
              type="button"
              disabled={!canActivate}
              className={cn(
                "font-semibold tabular-nums text-foreground",
                canActivate && SD_ANLEGG_BTN_PRESS,
              )}
              onClick={() => {
                const group = resolveHeatingHistoryGroup("tap.regulation", points);
                if (group.length > 0) selectPoints(group);
              }}
            >
              {model.setpoint.displayValue}
            </button>
          ) : (
            "—"
          )}
        </p>
      </div>

      <SdAnleggSchemaHistoryDialog
        target={activeTarget}
        open={dialogOpen}
        onCloseAction={closeDialog}
        buildingSlug={buildingSlug}
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
