"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import type { AhuSlotRole } from "@/lib/sd-anlegg/ahu-blueprint";
import {
  buildHeatingDistrictPresentationModel,
  type HeatingDistrictLane,
  type HeatingDistrictSlot,
} from "@/lib/sd-anlegg/heating-district-presentation";
import { isSdAnleggPointSelected } from "../sd-anlegg-point-key";
import type { SdAnleggChartSeries } from "../sd-anlegg-chart-data";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_SCHEMATIC_CANVAS,
  SD_ANLEGG_SCHEMATIC_HEADER,
  SD_ANLEGG_SCHEMATIC_LANE,
  SD_ANLEGG_SCHEMATIC_LANE_BAND,
  SD_ANLEGG_SCHEMATIC_LANE_LABEL,
  SD_ANLEGG_SCHEMATIC_SHELL,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { SD_ANLEGG_PROCESS_VALUE } from "./styles/process-schematic-styles";
import {
  SdAnleggSchemaHistoryDialog,
  type SdAnleggSchemaHistoryTarget,
} from "./sd-anlegg-schema-history-dialog";
import { ProcessSchematicEquipmentSlot } from "./process-schematic-equipment-slot";
import {
  SCHEMATIC_EMPTY_CHART_RANGE_OPTIONS,
  SCHEMATIC_EMPTY_CHART_SERIES,
  SCHEMATIC_EMPTY_POINTS,
  SCHEMATIC_EMPTY_SELECTED_KEYS,
} from "./schematic-defaults";
import { useSchemaHistoryDialog } from "./use-schema-history-dialog";

type Props = {
  buildingSlug: string;
  points: InfraspawnPointListItem[];
  elementKey?: string | null;
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

function resolveHeatingSlotRole(slot: HeatingDistrictSlot): AhuSlotRole {
  const segment = slot.roleId.split(".").pop() ?? "";
  if (
    segment === "pump" ||
    segment === "valve" ||
    segment === "temp" ||
    segment === "damper"
  ) {
    return segment;
  }
  if (slot.componentType === "sensor.temperature") return "temp";
  if (slot.componentType === "hvac.pump") return "pump";
  if (slot.componentType === "hvac.valve") return "valve";
  return "status";
}

function slotToHistoryTarget(
  slot: HeatingDistrictSlot,
): SdAnleggSchemaHistoryTarget {
  return {
    code: slot.equipmentCode,
    roleLabel: slot.label,
    slotId: slot.roleId,
    primaryPoint: slot.primaryPoint,
    relatedPoints: slot.relatedPoints,
    displayValue: slot.displayValue,
    stateLabel: null,
  };
}

function HeatingProcessSlot({
  slot,
  selectedKeys,
  onActivate,
}: {
  slot: HeatingDistrictSlot;
  selectedKeys: Set<string>;
  onActivate?: (slot: HeatingDistrictSlot) => void;
}) {
  const selected = isSdAnleggPointSelected(slot.primaryPoint, selectedKeys);
  const missing = slot.confidence === "missing";
  const body = (
    <ProcessSchematicEquipmentSlot
      equipmentCode={slot.equipmentCode}
      slotRole={resolveHeatingSlotRole(slot)}
      componentType={slot.componentType}
      displayLines={
        slot.displayValue
          ? [{ displayValue: slot.displayValue, role: "value" }]
          : []
      }
      subtitle={slot.label}
      selected={selected}
      missing={missing}
      alarm={slot.alarm}
      layout="stack"
      className="w-18 sm:w-20"
    />
  );

  if (!slot.primaryPoint || !onActivate) {
    return (
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${slot.x}%`, top: "50%" }}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-md text-left transition-[transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        SD_ANLEGG_BTN_PRESS,
      )}
      style={{ left: `${slot.x}%`, top: "50%" }}
      onClick={() => onActivate(slot)}
      aria-haspopup="dialog"
      aria-label={`Vis historikk for ${slot.equipmentCode}`}
    >
      {body}
    </button>
  );
}

function HeatingPipeLane({
  lane,
  selectedKeys,
  onActivate,
}: {
  lane: HeatingDistrictLane;
  selectedKeys: Set<string>;
  onActivate?: (slot: HeatingDistrictSlot) => void;
}) {
  if (lane.slots.length === 0) return null;

  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-stretch gap-2 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-3">
      <div className="flex items-center py-2">
        <p className={cn(SD_ANLEGG_SCHEMATIC_LANE_LABEL, "leading-snug")}>
          {lane.label}
        </p>
      </div>
      <div className={SD_ANLEGG_SCHEMATIC_LANE}>
        <div
          className={cn(
            "pointer-events-none absolute inset-x-4 top-1/2 h-3 -translate-y-1/2 rounded-full",
            SD_ANLEGG_SCHEMATIC_LANE_BAND.pipe,
          )}
          aria-hidden
        />
        <div className="relative min-h-26 px-3 py-2.5">
          {lane.slots.map((slot) => (
            <HeatingProcessSlot
              key={slot.roleId}
              slot={slot}
              selectedKeys={selectedKeys}
              onActivate={onActivate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeatingStatusStrip({
  slots,
  selectedKeys,
  onActivate,
}: {
  slots: HeatingDistrictSlot[];
  selectedKeys: Set<string>;
  onActivate?: (slot: HeatingDistrictSlot) => void;
}) {
  if (slots.length === 0) return null;

  return (
    <section className="overflow-x-auto rounded-lg border border-border/70 bg-muted/30">
      <div className="flex min-w-max divide-x divide-border/60">
        {slots.map((slot) => {
          const selected = isSdAnleggPointSelected(
            slot.primaryPoint,
            selectedKeys,
          );
          const missing = slot.confidence === "missing";
          const inner = (
            <>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {slot.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 text-sm font-semibold tabular-nums",
                  slot.alarm ? "text-destructive" : SD_ANLEGG_PROCESS_VALUE,
                  missing && "text-muted-foreground",
                )}
              >
                {slot.displayValue ?? "—"}
              </span>
            </>
          );

          const className = cn(
            "flex min-w-[7rem] flex-col px-4 py-2.5 text-left",
            selected && "bg-primary/5",
            slot.primaryPoint &&
              onActivate &&
              cn(
                SD_ANLEGG_BTN_PRESS,
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
              ),
          );

          if (!slot.primaryPoint || !onActivate) {
            return (
              <div key={slot.roleId} className={className}>
                {inner}
              </div>
            );
          }

          return (
            <button
              key={slot.roleId}
              type="button"
              className={className}
              onClick={() => onActivate(slot)}
              aria-haspopup="dialog"
              aria-label={`Vis historikk for ${slot.label}`}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function SdAnleggHeatingDistrictSchematic({
  buildingSlug,
  points = SCHEMATIC_EMPTY_POINTS,
  elementKey = null,
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
  const model = useMemo(
    () => buildHeatingDistrictPresentationModel(points, { elementKey }),
    [points, elementKey],
  );
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const selectSlotPoints = useCallback(
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
    useSchemaHistoryDialog(selectSlotPoints, buildingSlug);

  const activateSlot = useCallback(
    (slot: HeatingDistrictSlot) => {
      openTarget(slotToHistoryTarget(slot));
    },
    [openTarget],
  );

  const canActivate = Boolean(onSelectPointsAction || onPointSelectAction);
  const outdoorDisplay = model.outdoorTemp?.displayValue;

  return (
    <div className={cn(SD_ANLEGG_SCHEMATIC_SHELL, className)}>
      <div
        className={cn(
          SD_ANLEGG_SCHEMATIC_HEADER,
          "flex flex-wrap items-baseline justify-between gap-2",
        )}
      >
        <span>{unitDisplayName ?? model.regulationLabel}</span>
        {outdoorDisplay ? (
          <span className="text-sm font-normal tabular-nums text-primary">
            Utetemperatur: {outdoorDisplay}
          </span>
        ) : null}
      </div>

      <div className={cn(SD_ANLEGG_SCHEMATIC_CANVAS, "space-y-3")}>
        {model.lanes.map((lane) => (
          <HeatingPipeLane
            key={lane.id}
            lane={lane}
            selectedKeys={selected}
            onActivate={canActivate ? activateSlot : undefined}
          />
        ))}

        <HeatingStatusStrip
          slots={model.statusSlots}
          selectedKeys={selected}
          onActivate={canActivate ? activateSlot : undefined}
        />
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
