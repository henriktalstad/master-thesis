"use client";

import { cn } from "@/lib/utils";
import { formatInfraspawnUnit } from "@/lib/infraspawn/format-unit";
import {
  mergeSdAnleggChartRows,
  resolveSdAnleggChartTimeDomain,
} from "./sd-anlegg-chart-data";
import { sdAnleggChartPeriodLabel } from "@/components/sd-anlegg/sd-anlegg-ui";
import { SdAnleggPointChartPlot } from "./sd-anlegg-point-chart-plot";
import {
  EMPTY_CHART_MARKERS,
  EMPTY_CHART_REFERENCE_VALUES,
  type SdAnleggPointChartMarker,
  type SdAnleggPointChartProps,
  type SdAnleggPointChartReferenceValue,
} from "./sd-anlegg-point-chart-types";

export type {
  SdAnleggPointChartMarker,
  SdAnleggPointChartProps,
  SdAnleggPointChartReferenceValue,
};

export function SdAnleggPointChart({
  series,
  hours,
  compact = false,
  markers = EMPTY_CHART_MARKERS,
  referenceValues = EMPTY_CHART_REFERENCE_VALUES,
  footnote = null,
}: SdAnleggPointChartProps) {
  if (series.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground",
          compact ? "min-h-20" : "min-h-56",
        )}
      >
        Ingen grafdata
      </div>
    );
  }

  const rows = mergeSdAnleggChartRows(series);
  if (rows.length === 0) {
    const period = sdAnleggChartPeriodLabel(hours);
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground",
          compact ? "min-h-20" : "min-h-56",
        )}
      >
        <p className="font-medium text-foreground">Ingen historikk i valgt periode</p>
        {!compact ? (
          <p className="max-w-sm text-xs">
            {footnote ??
              `Grafen viser siste ${period}. Nye målinger vises når sync fra anlegget er ajour.`}
          </p>
        ) : null}
      </div>
    );
  }

  const [domainStart, domainEnd] = resolveSdAnleggChartTimeDomain(hours, rows);
  const spanMs = domainEnd - domainStart;
  const analogSeries = series.filter((entry) => entry.scale === "analog");
  const analogUnitLabels = new Set<string>();
  for (const entry of analogSeries) {
    const label = formatInfraspawnUnit(entry.unit);
    if (label) analogUnitLabels.add(label);
  }

  return (
    <SdAnleggPointChartPlot
      series={series}
      rows={rows}
      domainStart={domainStart}
      domainEnd={domainEnd}
      spanMs={spanMs}
      compact={compact}
      markers={markers}
      referenceValues={referenceValues}
      footnote={footnote}
      mixedAnalogUnits={analogUnitLabels.size > 1}
      mixedAnalogUnitLabels={[...analogUnitLabels]}
    />
  );
}
