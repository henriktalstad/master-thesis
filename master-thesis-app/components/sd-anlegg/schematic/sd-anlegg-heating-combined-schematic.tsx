"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import {
  resolveHeatingCombinedBranchLaneCopy,
} from "@/lib/sd-anlegg/heating-combined-blueprint";
import {
  buildHeatingCombinedPresentationModel,
  buildTapWaterPresentationModel,
  resolveHeatingHistoryGroup,
  type HeatingCombinedBranch,
  type HeatingProcessSlot,
} from "@/lib/sd-anlegg/heating-process-presentation";
import type { SdAnleggChartSeries } from "../sd-anlegg-chart-data";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_SCHEMATIC_CANVAS,
  SD_ANLEGG_SCHEMATIC_HEADER,
  SD_ANLEGG_SCHEMATIC_SHELL,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { SD_ANLEGG_PROCESS_VALUE, SD_ANLEGG_PROCESS_SCHEMATIC_ROOT } from "./styles/process-schematic-styles";
import {
  SdAnleggSchemaHistoryDialog,
  type SdAnleggSchemaHistoryTarget,
} from "./sd-anlegg-schema-history-dialog";
import { HeatingHeatExchangerAssembly } from "./heating-process-symbols";
import { HeatingCombinedDriftStripe } from "./heating-combined-drift-stripe";
import {
  HeatingCombinedBranchDiagramGrid,
} from "./heating-combined-branch-diagram";
import { HEATING_COMBINED_LAYOUT as heatingCombinedLayoutStyles } from "./styles/heating-combined-styles";
import { HeatingCombinedDiagramShell } from "./heating-combined-diagram-shell";
import { HeatingCombinedBranchSecondarySchematic } from "./heating-combined-secondary-schematic";
import { HeatingCombinedTapWaterLink } from "./heating-combined-tap-water-strip";
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

function slotToTarget(slot: HeatingProcessSlot): SdAnleggSchemaHistoryTarget {
  return {
    code: slot.equipmentCode,
    roleLabel: slot.label,
    slotId: slot.slotId,
    primaryPoint: slot.primaryPoint,
    relatedPoints: slot.relatedPoints,
    displayValue: slot.displayValue,
    stateLabel: slot.stateLabel ?? null,
  };
}

function oeCompactLabel(slotId: string): string {
  if (slotId.endsWith(".supply")) return "Tur";
  if (slotId.endsWith(".return")) return "Retur";
  if (slotId.endsWith(".power")) return "kW";
  if (slotId.endsWith(".energy")) return "kWh";
  return "—";
}

function formatOeRowValue(slot: HeatingProcessSlot): string {
  if (!slot.displayValue) return "—";

  if (slot.slotId.endsWith(".power") && slot.primaryPoint?.lastValue != null) {
    const numeric = Number(slot.primaryPoint.lastValue);
    if (Number.isFinite(numeric)) {
      const formatted = numeric.toLocaleString("nb-NO", {
        maximumFractionDigits: numeric >= 100 ? 0 : 1,
      });
      const unit = slot.primaryPoint.unit?.replace(/^kilowatts?$/i, "kW") ?? "kW";
      return `${formatted} ${unit}`;
    }
  }

  if (slot.slotId.endsWith(".energy") && slot.primaryPoint?.lastValue != null) {
    const numeric = Number(slot.primaryPoint.lastValue);
    if (Number.isFinite(numeric)) {
      const formatted = numeric.toLocaleString("nb-NO", {
        maximumFractionDigits: numeric >= 1000 ? 0 : 1,
      });
      const unit = slot.primaryPoint.unit?.replace(/^kilowatt-hours?$/i, "kWh") ?? "kWh";
      return `${formatted} ${unit}`;
    }
  }

  return slot.displayValue;
}

function OeInlineMeter({
  branch,
  onActivate,
}: {
  branch: HeatingCombinedBranch;
  onActivate?: (slot: HeatingProcessSlot) => void;
}) {
  const rows: Array<{ slot: HeatingProcessSlot; emphasize?: boolean }> = [
    { slot: branch.oe.supply, emphasize: true },
    { slot: branch.oe.return, emphasize: true },
    { slot: branch.oe.power },
    { slot: branch.oe.energy },
  ];

  return (
    <div className={heatingCombinedLayoutStyles.oeMeter}>
      <span className="text-[0.72em] font-semibold uppercase tracking-wide text-muted-foreground">
        OE001
      </span>
      <div className={heatingCombinedLayoutStyles.oePanel}>
        <div className="space-y-0.5 border-b border-border/40 pb-1">
          {rows.slice(0, 2).map(({ slot, emphasize }) => {
            const valueClass = cn(
              heatingCombinedLayoutStyles.oeValue,
              "font-semibold",
              emphasize ? SD_ANLEGG_PROCESS_VALUE : "text-foreground",
              slot.confidence === "missing" && "text-muted-foreground",
            );
            const value = formatOeRowValue(slot);

            return (
              <div key={slot.slotId} className={heatingCombinedLayoutStyles.oeRow}>
                <span className="text-muted-foreground">{oeCompactLabel(slot.slotId)}</span>
                {slot.primaryPoint && onActivate ? (
                  <button
                    type="button"
                    className={cn(valueClass, SD_ANLEGG_BTN_PRESS)}
                    onClick={() => onActivate(slot)}
                    aria-haspopup="dialog"
                  >
                    {value}
                  </button>
                ) : (
                  <span className={valueClass}>{value}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="space-y-0.5 pt-1">
          {rows.slice(2).map(({ slot, emphasize }) => {
            const valueClass = cn(
              heatingCombinedLayoutStyles.oeValue,
              heatingCombinedLayoutStyles.oeValueCompact,
              "font-semibold",
              emphasize ? SD_ANLEGG_PROCESS_VALUE : "text-foreground",
              slot.confidence === "missing" && "text-muted-foreground",
            );
            const value = formatOeRowValue(slot);

            return (
              <div key={slot.slotId} className={heatingCombinedLayoutStyles.oeRow}>
                <span className="text-muted-foreground">{oeCompactLabel(slot.slotId)}</span>
                {slot.primaryPoint && onActivate ? (
                  <button
                    type="button"
                    className={cn(valueClass, SD_ANLEGG_BTN_PRESS)}
                    onClick={() => onActivate(slot)}
                    aria-haspopup="dialog"
                  >
                    {value}
                  </button>
                ) : (
                  <span className={valueClass}>{value}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BranchCardHeader({
  branch,
  onActivateBranch,
}: {
  branch: HeatingCombinedBranch;
  onActivateBranch?: (branch: HeatingCombinedBranch) => void;
}) {
  const laneCopy = resolveHeatingCombinedBranchLaneCopy(branch.id);

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/4 px-3 py-2 sm:px-4">
      <p className="text-sm font-semibold leading-none text-foreground">
        {laneCopy.elementLabel}
        <span className="ml-1.5 font-normal text-muted-foreground">
          {laneCopy.subtitle}
        </span>
      </p>
      {onActivateBranch ? (
        <button
          type="button"
          className={cn(
            "text-xs font-medium text-primary underline-offset-2 hover:underline",
            SD_ANLEGG_BTN_PRESS,
          )}
          onClick={() => onActivateBranch(branch)}
        >
          Historikk
        </button>
      ) : null}
    </header>
  );
}

function BranchDiagramCanvas({
  branch,
  selectedKeys,
  onActivateSlot,
}: {
  branch: HeatingCombinedBranch;
  selectedKeys: Set<string>;
  onActivateSlot?: (slot: HeatingProcessSlot) => void;
}) {
  const primary = useMemo(
    () => (
      <>
        <OeInlineMeter branch={branch} onActivate={onActivateSlot} />
        <HeatingHeatExchangerAssembly
          label={branch.heatExchangerLabel}
          className="origin-center scale-[0.82]"
        />
      </>
    ),
    [branch, onActivateSlot],
  );

  const secondary = useMemo(
    () => (
      <HeatingCombinedBranchSecondarySchematic
        branch={branch}
        selectedKeys={selectedKeys}
        onActivateSlot={onActivateSlot}
      />
    ),
    [branch, selectedKeys, onActivateSlot],
  );

  return (
    <HeatingCombinedBranchDiagramGrid primary={primary} secondary={secondary} />
  );
}

function CombinedBranchesLayout({
  branches,
  selectedKeys,
  onActivateBranch,
  onActivateSlot,
}: {
  branches: readonly HeatingCombinedBranch[];
  selectedKeys: Set<string>;
  onActivateBranch?: (branch: HeatingCombinedBranch) => void;
  onActivateSlot?: (slot: HeatingProcessSlot) => void;
}) {
  return (
    <div className="w-full min-w-0">
      <div className="space-y-3">
        {branches.map((branch) => (
          <section
            key={branch.id}
            className="w-full min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-sm"
          >
            <BranchCardHeader
              branch={branch}
              onActivateBranch={onActivateBranch}
            />
            <BranchDiagramCanvas
              branch={branch}
              selectedKeys={selectedKeys}
              onActivateSlot={onActivateSlot}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

export function SdAnleggHeatingCombinedSchematic({
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
  const model = useMemo(
    () => buildHeatingCombinedPresentationModel(points),
    [points],
  );
  const tapWaterModel = useMemo(() => {
    if (!model.tapWaterLink) return null;
    return buildTapWaterPresentationModel(points);
  }, [model.tapWaterLink, points]);
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

  const activateBranch = useCallback(
    (branch: HeatingCombinedBranch) => {
      const groupId =
        branch.id === "residential" ? "res.regulation" : "com.regulation";
      const group = resolveHeatingHistoryGroup(groupId, points);
      if (group.length > 0) {
        selectPoints(group);
      }
    },
    [points, selectPoints],
  );

  const canActivate = Boolean(onSelectPointsAction || onPointSelectAction);

  return (
    <div className={cn(SD_ANLEGG_SCHEMATIC_SHELL, className)}>
      <div className={SD_ANLEGG_SCHEMATIC_HEADER}>
        <span>{unitDisplayName ?? "320.001-3 Fjernvarme"}</span>
      </div>

      <div className={SD_ANLEGG_SCHEMATIC_CANVAS}>
        <HeatingCombinedDiagramShell className={SD_ANLEGG_PROCESS_SCHEMATIC_ROOT}>
          <div className="min-w-0 px-2 py-3 sm:px-3 md:px-4">
            <CombinedBranchesLayout
              branches={model.branches}
              selectedKeys={selected}
              onActivateBranch={canActivate ? activateBranch : undefined}
              onActivateSlot={canActivate ? activateSlot : undefined}
            />

            {tapWaterModel ? (
              <HeatingCombinedTapWaterLink
                buildingSlug={buildingSlug}
                model={tapWaterModel}
                selectedKeys={selectedKeys}
                onActivateSlotAction={canActivate ? activateSlot : undefined}
              />
            ) : null}
          </div>

          <HeatingCombinedDriftStripe
            branches={model.branches}
            outdoorTemp={model.outdoorTemp}
            selectedKeys={selected}
            onActivateSlot={canActivate ? activateSlot : undefined}
            showOutdoorTemp={false}
          />
        </HeatingCombinedDiagramShell>
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
