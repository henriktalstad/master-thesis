"use client";

import { useMemo, useState } from "react";
import type { MpcSignalComparisonSeries } from "@/lib/sd-anlegg/control/control-types";
import {
  CONTROL_DISPLAY,
  CONTROL_TABLE_COLUMNS,
  CONTROL_TABLE_SORT,
} from "@/lib/sd-anlegg/control/control-display-labels";
import {
  controlComparisonDeviation,
  isControlComparisonDeviation,
} from "@/lib/sd-anlegg/control/control-comparison-precision";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatControlComparisonScalar,
  formatControlTimeLabel,
} from "@/lib/sd-anlegg/control/chart-utils";
import { cn } from "@/lib/utils";

type Props = {
  series: MpcSignalComparisonSeries;
  stepMinutes?: 1 | 5 | 15 | 60;
  maxRows?: number;
  plainLanguage?: boolean;
  defaultSortMode?: SortMode;
  emphasizeObservedVsSim?: boolean;
};

type SortMode = "mpc_vs_bms" | "sd_vs_mpc" | "time";

export function SdAnleggControlMpcStepTable({
  series,
  stepMinutes = 15,
  maxRows = 48,
  plainLanguage = false,
  defaultSortMode = "mpc_vs_bms",
  emphasizeObservedVsSim = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(defaultSortMode);
  const chartVariant = series.chartVariant ?? "policy";
  const showPolicyTracks = chartVariant === "policy";
  const showReference = chartVariant === "observed_with_reference";
  const unit = series.unit;

  const rows = useMemo(() => {
    const mapped: Array<{
      hour: string;
      label: string;
      observed: number | null;
      reference: number | null;
      emulated: number | null;
      mpc: number | null;
      mpcVsBmsError: number | null;
      sdVsMpcError: number | null;
      refDelta: number | null;
      mpcChanged: boolean;
      deltaCostKr: number | null;
    }> = [];

    for (const p of series.points) {
      const mpcVsBmsError = controlComparisonDeviation(p.mpc, p.emulated, unit);
      const sdVsMpcError = controlComparisonDeviation(p.observed, p.mpc, unit);
      const refDelta = controlComparisonDeviation(p.observed, p.reference, unit);
      const row = {
        hour: p.hour,
        label: formatControlTimeLabel(p.hour, stepMinutes),
        observed: p.observed,
        reference: p.reference ?? null,
        emulated: p.emulated,
        mpc: p.mpc,
        mpcVsBmsError,
        sdVsMpcError,
        refDelta,
        mpcChanged: isControlComparisonDeviation(p.mpc, p.emulated, unit),
        deltaCostKr: p.deltaCostKr ?? null,
      };
      const include = showPolicyTracks
        ? row.observed != null || row.mpc != null || row.emulated != null
        : row.observed != null || row.reference != null;
      if (include) mapped.push(row);
    }

    const sorted = mapped.toSorted((a, b) => {
      if (sortMode === "time") {
        return new Date(a.hour).getTime() - new Date(b.hour).getTime();
      }
      if (showReference) return (b.refDelta ?? 0) - (a.refDelta ?? 0);
      if (sortMode === "sd_vs_mpc") {
        return (b.sdVsMpcError ?? 0) - (a.sdVsMpcError ?? 0);
      }
      return (b.mpcVsBmsError ?? 0) - (a.mpcVsBmsError ?? 0);
    });
    return expanded ? sorted : sorted.slice(0, maxRows);
  }, [
    series.points,
    expanded,
    maxRows,
    stepMinutes,
    showPolicyTracks,
    showReference,
    sortMode,
    unit,
  ]);

  if (rows.length === 0) return null;

  const total = series.points.filter((p) =>
    showPolicyTracks
      ? p.observed != null || p.mpc != null || p.emulated != null
      : p.observed != null || p.reference != null,
  ).length;
  const hasCost = showPolicyTracks && series.points.some((p) => p.deltaCostKr != null);
  const mpcChangedCount =
    series.summary.stepsWithMpcVsEmulatedDelta ??
    series.points.filter((p) => isControlComparisonDeviation(p.mpc, p.emulated, unit))
      .length;
  const observedVsSimCount = series.points.filter((p) =>
    isControlComparisonDeviation(p.observed, p.mpc, unit),
  ).length;
  const changeCount = emphasizeObservedVsSim ? observedVsSimCount : mpcChangedCount;

  const simulatedLabel = plainLanguage
    ? CONTROL_DISPLAY.simulatedControl.opsShort
    : CONTROL_DISPLAY.simulatedControl.short;
  const predictedLabel = plainLanguage
    ? CONTROL_DISPLAY.predicted.chart
    : CONTROL_DISPLAY.predicted.short;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {stepMinutes >= 60 ? "Time" : `${stepMinutes} min`}
          {showReference
            ? " · sortert etter størst avvik operatør vs beregnet SP"
            : showPolicyTracks
              ? sortMode === "mpc_vs_bms"
                ? " · sortert etter simulert vs forventet"
                : sortMode === "sd_vs_mpc"
                  ? " · sortert etter måling vs simulert"
                  : " · kronologisk"
              : " · observert tidsserie"}
          {showPolicyTracks && changeCount > 0
            ? emphasizeObservedVsSim
              ? ` · ${changeCount} intervaller avviker fra måling`
              : ` · ${changeCount} intervaller med endring`
            : ""}
        </p>
        {showPolicyTracks ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setSortMode("mpc_vs_bms")}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                sortMode === "mpc_vs_bms"
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CONTROL_TABLE_SORT.simulatedVsBms}
            </button>
            <button
              type="button"
              onClick={() => setSortMode("sd_vs_mpc")}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                sortMode === "sd_vs_mpc"
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CONTROL_TABLE_SORT.observedVsSim}
            </button>
            <button
              type="button"
              onClick={() => setSortMode("time")}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                sortMode === "time"
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CONTROL_TABLE_SORT.time}
            </button>
          </div>
        ) : null}
        {total > maxRows ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-primary transition-transform duration-150 ease-out active:scale-[0.97] hover:underline"
          >
            {expanded ? "Vis færre" : `Vis alle ${total} intervaller`}
          </button>
        ) : null}
      </div>

      <div className="max-h-72 overflow-auto rounded-lg border border-border/80">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            <TableRow>
              <TableHead className="text-xs">Tid</TableHead>
              <TableHead className="text-right text-xs">
                {showReference ? series.label : CONTROL_DISPLAY.observed.short}
              </TableHead>
              {showReference ? (
                <TableHead className="text-right text-xs">
                  {series.referenceLabel ?? "Referanse"}
                </TableHead>
              ) : null}
              {showPolicyTracks ? (
                <>
                  <TableHead className="text-right text-xs">
                    {predictedLabel}
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    {simulatedLabel}
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    {CONTROL_TABLE_COLUMNS.diffSimulatedVsBms}
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    {CONTROL_TABLE_COLUMNS.diffObservedVsSim}
                  </TableHead>
                </>
              ) : null}
              {showReference ? (
                <TableHead className="text-right text-xs">
                  {CONTROL_TABLE_COLUMNS.diffOperatorVsCalc}
                </TableHead>
              ) : null}
              {hasCost ? (
                <TableHead className="text-right text-xs">
                  {CONTROL_TABLE_COLUMNS.costDiff}
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.hour}
                className={
                  emphasizeObservedVsSim
                    ? row.sdVsMpcError != null &&
                      isControlComparisonDeviation(
                        row.observed,
                        row.mpc,
                        unit,
                      )
                      ? "bg-primary/3"
                      : undefined
                    : row.mpcChanged
                      ? "bg-primary/3"
                      : undefined
                }
              >
                <TableCell className="text-xs whitespace-nowrap">{row.label}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatControlComparisonScalar(row.observed, unit)}
                  {row.observed != null ? unit : ""}
                </TableCell>
                {showReference ? (
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {formatControlComparisonScalar(row.reference, unit)}
                    {row.reference != null ? unit : ""}
                  </TableCell>
                ) : null}
                {showPolicyTracks ? (
                  <>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {formatControlComparisonScalar(row.emulated, unit)}
                      {row.emulated != null ? unit : ""}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatControlComparisonScalar(row.mpc, unit)}
                      {row.mpc != null ? unit : ""}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-xs tabular-nums",
                        row.mpcChanged ? "font-medium text-primary" : "text-muted-foreground",
                      )}
                    >
                      {formatControlComparisonScalar(row.mpcVsBmsError, unit)}
                      {row.mpcVsBmsError != null ? unit : ""}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-xs tabular-nums",
                        emphasizeObservedVsSim &&
                          isControlComparisonDeviation(
                            row.observed,
                            row.mpc,
                            unit,
                          )
                          ? "font-medium text-primary"
                          : row.sdVsMpcError != null &&
                              isControlComparisonDeviation(
                                row.observed,
                                row.mpc,
                                unit,
                              )
                            ? "text-chart-4"
                            : "text-muted-foreground",
                      )}
                    >
                      {formatControlComparisonScalar(row.sdVsMpcError, unit)}
                      {row.sdVsMpcError != null ? unit : ""}
                    </TableCell>
                  </>
                ) : null}
                {showReference ? (
                  <TableCell
                    className={cn(
                      "text-right text-xs tabular-nums",
                      row.refDelta != null && row.refDelta > 0.05
                        ? "font-medium text-chart-4"
                        : "",
                    )}
                  >
                    {formatControlComparisonScalar(row.refDelta, unit)}
                    {row.refDelta != null ? unit : ""}
                  </TableCell>
                ) : null}
                {hasCost ? (
                  <TableCell
                    className={cn(
                      "text-right text-xs tabular-nums",
                      row.deltaCostKr != null && row.deltaCostKr < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : row.deltaCostKr != null && row.deltaCostKr > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "",
                    )}
                  >
                    {row.deltaCostKr != null
                      ? `${row.deltaCostKr > 0 ? "+" : ""}${formatControlComparisonScalar(row.deltaCostKr, "kr")} kr`
                      : "—"}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
