"use client";

import { useCallback, useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import {
  buildAhuPresentationModel,
  type AhuEquipmentSlot,
  type AhuStatusSlot,
} from "@/lib/sd-anlegg/ahu-equipment-identification";
import { prepareAhuSchematicModel } from "@/lib/sd-anlegg/ahu-derived-slot-enrichment";
import { resolveSchemaSlotBoundaryHint } from "@/lib/sd-anlegg/schema-styring-links";
import {
  buildSchematicAlarmHistoryTarget,
  buildLowEfficiencyHistoryTarget,
  resolveAhuSchematicAlarms,
  resolveHxLowEfficiencyAlarm,
  type SchematicAlarmItem,
} from "@/lib/sd-anlegg/ahu-schematic-alarm-indicators";
import { resolveProcessSchematicDisplayLines } from "@/lib/sd-anlegg/format-process-slot-display";
import {
  blueprintPercentToLayoutX,
  PROCESS_SCHEMATIC_VIEWBOX,
  resolveBlueprintSlotLayoutX,
  resolveProcessHeatingBranchSide,
} from "@/lib/sd-anlegg/process-schematic-geometry";
import {
  resolveProcessEquipmentAnchorY,
  resolveProcessSlotAnchorY,
} from "@/lib/sd-anlegg/process-schematic-slot-anchors";
import type { AhuProcessSettingsItem } from "@/lib/sd-anlegg/ahu-process-settings";
import { isSdAnleggPointSelected } from "../sd-anlegg-point-key";
import { useSdAnleggEffectiveIdentification } from "../use-sd-anlegg-effective-identification";
import type { SdAnleggChartSeries } from "../sd-anlegg-chart-data";
import {
  SD_ANLEGG_PROCESS_ALARM_BAND,
  SD_ANLEGG_PROCESS_CANVAS,
  SD_ANLEGG_PROCESS_CANVAS_SCENE,
  SD_ANLEGG_PROCESS_DIAGRAM_BODY,
  SD_ANLEGG_PROCESS_SCHEMATIC_ROOT,
  SD_ANLEGG_PROCESS_SCHEMATIC_WRAPPER,
} from "./styles/process-schematic-styles";
import {
  SdAnleggSchemaHistoryDialog,
  type SdAnleggSchemaHistoryTarget,
} from "./sd-anlegg-schema-history-dialog";
import { ProcessSchematicLaneLabels } from "./process-schematic-lane-labels";
import { ProcessDuctCanvas } from "./process-duct-canvas";
import { ProcessSchematicFlowLinks } from "./process-schematic-flow-links";
import { ProcessDriftStripe } from "./process-drift-stripe";
import { ProcessSchematicAnchoredSlot } from "./process-schematic-anchored-slot";
import { ProcessSchematicEquipmentSlot } from "./process-schematic-equipment-slot";
import { ProcessSchematicSidePanel } from "./process-schematic-side-panel";
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
  chartRangeOptions?: ReadonlyArray<{ hours: SdAnleggChartRangeHours; label: string }>;
  onChartHoursChangeAction?: (hours: SdAnleggChartRangeHours) => void;
  seriesLoading?: boolean;
  seriesError?: Error | null;
  seriesFetching?: boolean;
  schemaTemplateId?: string | null;
};

function resolveCoilVariant(slotId: string): "heat" | "cool" | undefined {
  if (slotId === "heating.cool_valve") return "cool";
  if (slotId === "heating.valve") return "heat";
  return undefined;
}

function collectSlotPoints(
  slot: AhuEquipmentSlot | AhuStatusSlot,
  extra: readonly InfraspawnPointListItem[] = [],
): InfraspawnPointListItem[] {
  const fromLines =
    "displayLines" in slot
      ? slot.displayLines
          .map((line) => line.point)
          .filter((point): point is InfraspawnPointListItem => point != null)
      : [];
  const merged = [...slot.relatedPoints, ...fromLines, ...extra];
  const seen = new Set<string>();
  return merged.filter((point) => {
    const key = `${point.sourceId}:${point.objectId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slotIsSelected(
  slot: AhuEquipmentSlot,
  selectedKeys: Set<string>,
  extraPoint?: InfraspawnPointListItem,
): boolean {
  return (
    isSdAnleggPointSelected(slot.primaryPoint, selectedKeys) ||
    slot.relatedPoints.some((point) => isSdAnleggPointSelected(point, selectedKeys)) ||
    isSdAnleggPointSelected(extraPoint, selectedKeys)
  );
}

const PROCESS_ROLE_LABEL: Record<AhuEquipmentSlot["role"], string> = {
  fan: "Vifte",
  damper: "Spjeld",
  filter: "Filter",
  pressure: "Trykk",
  temp: "Temperatur",
  hx: "Varmegjenvinner",
  coil: "Varmebatteri",
  pump: "Pumpe",
  valve: "Ventil",
  status: "Status",
};

function resolveProcessSlotRoleLabel(slot: AhuEquipmentSlot): string {
  if (slot.label?.trim()) return slot.label;
  const coilVariant = resolveCoilVariant(slot.slotId);
  if (coilVariant === "cool") return "Kjølebatteri";
  if (coilVariant === "heat") return "Varmebatteri";
  return PROCESS_ROLE_LABEL[slot.role] ?? "Signal";
}

function processSlotToTarget(
  slot: AhuEquipmentSlot,
  extraPoints: readonly InfraspawnPointListItem[] = [],
): SdAnleggSchemaHistoryTarget {
  return {
    code: slot.equipmentCode,
    roleLabel: resolveProcessSlotRoleLabel(slot),
    slotId: slot.slotId,
    slotRole: slot.role,
    primaryPoint: slot.primaryPoint,
    relatedPoints: collectSlotPoints(slot, extraPoints),
    displayValue: slot.displayValue,
    stateLabel: slot.stateLabel,
  };
}

function statusSlotToTarget(slot: AhuStatusSlot): SdAnleggSchemaHistoryTarget {
  return {
    code: slot.label,
    roleLabel: "Driftsstatus",
    slotId: slot.slotId,
    primaryPoint: slot.primaryPoint,
    relatedPoints: collectSlotPoints(slot),
    displayValue: slot.displayValue,
    stateLabel: null,
  };
}

function settingsItemToTarget(item: AhuProcessSettingsItem): SdAnleggSchemaHistoryTarget {
  return {
    code: item.label,
    roleLabel: "",
    primaryPoint: item.point,
    relatedPoints: [item.point],
    displayValue: item.displayValue,
    stateLabel: null,
  };
}

function ProcessSlot({
  slot,
  selectedKeys,
  onActivate,
}: {
  slot: AhuEquipmentSlot;
  selectedKeys: Set<string>;
  onActivate?: (slot: AhuEquipmentSlot, extraPoints?: InfraspawnPointListItem[]) => void;
}) {
  const isMissing = slot.confidence === "missing";
  const displayLines = resolveProcessSchematicDisplayLines({
    role: slot.role,
    displayLines: slot.displayLines,
    displayValue: slot.displayValue,
  });
  const selected = slotIsSelected(slot, selectedKeys);
  const anchorY = resolveProcessEquipmentAnchorY({
    slotId: slot.slotId,
    lane: slot.lane,
    role: slot.role,
    blueprintY: slot.y,
  });
  const slotPoints = collectSlotPoints(slot);
  const canActivate = Boolean(onActivate && slotPoints.length > 0);

  const heatingBranchSide = resolveProcessHeatingBranchSide(slot.slotId);
  const layoutX = resolveBlueprintSlotLayoutX(slot);

  return (
    <ProcessSchematicAnchoredSlot
      x={layoutX}
      anchorY={anchorY}
      slotRole={slot.role}
      lane={slot.lane}
      heatingBranchSide={heatingBranchSide}
      className={cn(
        "absolute",
        slot.lane === "heating" ? "z-12" : slot.lane === "supply" && (slot.role === "fan" || slot.role === "damper") ? "z-20" : "z-10",
        isMissing && "opacity-70",
      )}
      onActivate={canActivate ? () => onActivate?.(slot) : undefined}
      ariaLabel={`Vis historikk for ${slot.equipmentCode}`}
    >
      <ProcessSchematicEquipmentSlot
        equipmentCode={slot.equipmentCode}
        slotRole={slot.role}
        componentType={slot.componentType}
        displayLines={displayLines}
        stateLabel={slot.stateLabel}
        selected={selected}
        missing={isMissing}
        alarm={slot.alarm}
        coilVariant={resolveCoilVariant(slot.slotId)}
        heatingBranchSide={heatingBranchSide}
        lane={slot.lane}
        interactive={canActivate}
        subtitle={
          slot.confidence === "inferred" && slot.role === "damper"
            ? "Utledet"
            : resolveSchemaSlotBoundaryHint(slot.slotId) ?? undefined
        }
      />
    </ProcessSchematicAnchoredSlot>
  );
}

export function SdAnleggAhuProcessSchematic({
  buildingSlug,
  points = SCHEMATIC_EMPTY_POINTS,
  elementKey = null,
  selectedKeys = SCHEMATIC_EMPTY_SELECTED_KEYS,
  onPointSelectAction,
  onSelectPointsAction,
  className,
  chartSeries = SCHEMATIC_EMPTY_CHART_SERIES,
  dataCoverage = null,
  chartHours = 72,
  chartRangeOptions = SCHEMATIC_EMPTY_CHART_RANGE_OPTIONS,
  onChartHoursChangeAction,
  seriesLoading = false,
  seriesError = null,
  seriesFetching = false,
  schemaTemplateId = null,
}: Props) {
  const { schemaSlotOverrides } = useSdAnleggEffectiveIdentification();
  const model = useMemo(() => {
    return prepareAhuSchematicModel(
      buildAhuPresentationModel(points, {
        elementKey,
        schemaSlotOverrides,
        templateId: schemaTemplateId,
      }),
      points,
    );
  }, [points, elementKey, schemaSlotOverrides, schemaTemplateId]);
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

  const activateProcessSlot = useCallback(
    (slot: AhuEquipmentSlot, extraPoints: InfraspawnPointListItem[] = []) => {
      openTarget(processSlotToTarget(slot, extraPoints));
    },
    [openTarget],
  );

  const activateStatusSlot = useCallback(
    (slot: AhuStatusSlot) => {
      openTarget(statusSlotToTarget(slot));
    },
    [openTarget],
  );

  const activateSettingsItem = useCallback(
    (item: AhuProcessSettingsItem) => {
      openTarget(settingsItemToTarget(item));
    },
    [openTarget],
  );

  const schematicAlarms = useMemo(() => resolveAhuSchematicAlarms(points), [points]);
  const lowEfficiencyAlarm = useMemo(() => resolveHxLowEfficiencyAlarm(points), [points]);

  const activateAlarmItem = useCallback(
    (item: SchematicAlarmItem) => {
      openTarget(buildSchematicAlarmHistoryTarget(item, points));
    },
    [openTarget, points],
  );

  const activateLowEfficiencyAlarm = useCallback(() => {
    openTarget(buildLowEfficiencyHistoryTarget(lowEfficiencyAlarm));
  }, [openTarget, lowEfficiencyAlarm]);

  const canActivate = Boolean(onSelectPointsAction || onPointSelectAction);

  return (
    <div
      className={cn(SD_ANLEGG_PROCESS_SCHEMATIC_ROOT, className)}
      style={
        {
          "--process-schematic-viewbox-w": PROCESS_SCHEMATIC_VIEWBOX.width,
          "--process-schematic-viewbox-h": PROCESS_SCHEMATIC_VIEWBOX.height,
        } as CSSProperties
      }
    >
      <div className={SD_ANLEGG_PROCESS_SCHEMATIC_WRAPPER}>
        <div className={SD_ANLEGG_PROCESS_DIAGRAM_BODY}>
          <div className={SD_ANLEGG_PROCESS_ALARM_BAND}>
            <ProcessSchematicSidePanel
              alarms={schematicAlarms}
              lowEfficiencyActive={lowEfficiencyAlarm.active}
              onActivateAlarm={canActivate ? activateAlarmItem : undefined}
              onActivateLowEfficiency={
                canActivate && lowEfficiencyAlarm.point ? activateLowEfficiencyAlarm : undefined
              }
            />
          </div>
          <div className={SD_ANLEGG_PROCESS_CANVAS}>
            <div className={SD_ANLEGG_PROCESS_CANVAS_SCENE}>
              <ProcessDuctCanvas />
              <ProcessSchematicFlowLinks />
              <ProcessSchematicLaneLabels />
              {model.processSlots.map((slot) => {
            if (slot.slotId !== "heat_recovery.unit") {
              return (
                <ProcessSlot
                  key={slot.slotId}
                  slot={slot}
                  selectedKeys={selected}
                  onActivate={canActivate ? activateProcessSlot : undefined}
                />
              );
            }

            const hxDisplayLines = resolveProcessSchematicDisplayLines({
              role: "hx",
              displayLines: slot.displayLines,
              displayValue: slot.displayValue,
            });
            const hxPoints = collectSlotPoints(slot);
            const hxCanActivate = Boolean(canActivate && hxPoints.length > 0);

            return (
              <ProcessSchematicAnchoredSlot
                key={slot.slotId}
                x={blueprintPercentToLayoutX(slot.x)}
                anchorY={resolveProcessSlotAnchorY("heatRecovery")}
                slotRole="hx"
                lane="heatRecovery"
                anchorAlign="pipe-left"
                className={cn(
                  "absolute z-20",
                  slot.confidence === "missing" && "opacity-70",
                )}
                onActivate={
                  hxCanActivate ? () => activateProcessSlot(slot) : undefined
                }
                ariaLabel={`Vis historikk for ${slot.equipmentCode}`}
              >
                <ProcessSchematicEquipmentSlot
                  equipmentCode={slot.equipmentCode}
                  slotRole="hx"
                  componentType="ventilation.heat_recovery"
                  displayLines={hxDisplayLines}
                  selected={slotIsSelected(slot, selected)}
                  missing={slot.confidence === "missing"}
                  alarm={slot.alarm}
                  layout="hx"
                  lane="heatRecovery"
                  interactive={hxCanActivate}
                />
              </ProcessSchematicAnchoredSlot>
            );
          })}
            </div>
          </div>

          <ProcessDriftStripe
            slots={model.statusSlots}
            model={model}
            setpointPoints={points}
            selectedKeys={selected}
            onActivateStatus={canActivate ? activateStatusSlot : undefined}
            onActivateSettingsItem={canActivate ? activateSettingsItem : undefined}
          />
        </div>
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
