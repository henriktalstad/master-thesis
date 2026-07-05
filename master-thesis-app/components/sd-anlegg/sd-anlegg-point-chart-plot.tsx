"use client";

import { useRechartsModules } from "@/components/charts/use-recharts-modules";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { SubtlePendingStrip } from "@/components/ui/subtle-pending-indicator";
import { cn } from "@/lib/utils";
import {
  formatSdAnleggChartAxisTime,
  resolveSdAnleggChartAnalogUnitLabel,
  resolveSdAnleggChartMsvAxis,
  resolveSdAnleggChartYDomain,
  type SdAnleggChartRow,
  type SdAnleggChartSeries,
} from "./sd-anlegg-chart-data";
import { SD_ANLEGG_CHART_SHELL } from "@/components/sd-anlegg/sd-anlegg-ui";
import type {
  SdAnleggPointChartMarker,
  SdAnleggPointChartReferenceValue,
} from "./sd-anlegg-point-chart-types";
import {
  binaryAxisTick,
  CHART_AXIS_FONT_SIZE,
  CHART_AXIS_LABEL_STYLE,
  CHART_Y_AXIS_FORMATTER,
  msvAxisTick,
  seriesByKey,
  type SdAnleggPointChartTooltipPayload,
} from "./sd-anlegg-point-chart-formatting";
import { SdAnleggPointChartTooltipContent } from "./sd-anlegg-point-chart-utils";

const EMPTY_ANALOG_UNIT_LABELS: readonly string[] = [];

type Props = {
  series: SdAnleggChartSeries[];
  rows: SdAnleggChartRow[];
  domainStart: number;
  domainEnd: number;
  spanMs: number;
  compact: boolean;
  markers: readonly SdAnleggPointChartMarker[];
  referenceValues: readonly SdAnleggPointChartReferenceValue[];
  footnote: string | null;
  mixedAnalogUnits: boolean;
  mixedAnalogUnitLabels?: readonly string[];
};

export function SdAnleggPointChartPlot({
  series,
  rows,
  domainStart,
  domainEnd,
  spanMs,
  compact,
  markers,
  referenceValues,
  footnote,
  mixedAnalogUnits,
  mixedAnalogUnitLabels = EMPTY_ANALOG_UNIT_LABELS,
}: Props) {
  const recharts = useRechartsModules();
  const seriesMap = seriesByKey(series);
  const chartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  );

  const analogSeries = series.filter((entry) => entry.scale === "analog");
  const binarySeries = series.filter((entry) => entry.scale === "binary");
  const msvSeries = series.filter((entry) => entry.scale === "msv");
  const dualAxis =
    analogSeries.length > 0 && (binarySeries.length > 0 || msvSeries.length > 0);
  const binaryOnly = binarySeries.length === series.length;
  const msvOnly = msvSeries.length === series.length && msvSeries.length > 0;
  const msvAxis = msvOnly ? resolveSdAnleggChartMsvAxis(series, rows) : null;
  const msvSecondaryAxis =
    dualAxis && msvSeries.length > 0
      ? resolveSdAnleggChartMsvAxis(msvSeries, rows)
      : null;
  const analogDomain = resolveSdAnleggChartYDomain(analogSeries, rows, "analog");
  const valueDomain = binaryOnly
    ? ([-0.05, 1.05] as [number, number])
    : msvOnly && msvAxis
      ? msvAxis.domain
      : resolveSdAnleggChartYDomain(series, rows, "analog");
  const analogUnitLabel = resolveSdAnleggChartAnalogUnitLabel(series);
  const msvAxisWidth = msvOnly ? 104 : msvSecondaryAxis ? 88 : 56;

  if (!recharts) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          compact ? "min-h-[5rem]" : "min-h-[16rem]",
        )}
      >
        <SubtlePendingStrip />
      </div>
    );
  }

  const { CartesianGrid, Label, Line, LineChart, ReferenceLine, XAxis, YAxis } =
    recharts;
  const primaryAxisId = dualAxis ? "analog" : "value";
  const chartMargin = {
    top: 8,
    right: dualAxis ? (msvSecondaryAxis ? 88 : 44) : 12,
    left: msvOnly ? 8 : analogUnitLabel ? 4 : 0,
    bottom: 4,
  };

  return (
    <div
      className={cn(
        SD_ANLEGG_CHART_SHELL,
        compact ? "min-h-[5rem] w-full" : "min-h-[18rem] w-full",
      )}
    >
      <ChartContainer
        className={cn(
          "aspect-auto h-full w-full",
          compact ? "min-h-[5rem]" : "min-h-[18rem] aspect-auto",
        )}
        config={chartConfig}
      >
        <LineChart data={rows} margin={chartMargin}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={[domainStart, domainEnd]}
            scale="time"
            tickLine={false}
            axisLine={false}
            minTickGap={48}
            fontSize={CHART_AXIS_FONT_SIZE}
            tickFormatter={(v) => formatSdAnleggChartAxisTime(Number(v), spanMs)}
          />
          <YAxis
            yAxisId={primaryAxisId}
            tickLine={false}
            axisLine={false}
            width={analogUnitLabel ? 52 : msvAxisWidth}
            fontSize={CHART_AXIS_FONT_SIZE}
            domain={dualAxis ? analogDomain : valueDomain}
            ticks={
              binaryOnly
                ? [0, 1]
                : msvOnly && msvAxis
                  ? msvAxis.ticks
                  : undefined
            }
            tickFormatter={(v) => {
              if (typeof v !== "number") return "";
              if (binaryOnly) return binaryAxisTick(v);
              if (msvOnly) return msvAxisTick(v, msvSeries);
              return CHART_Y_AXIS_FORMATTER.format(v, analogUnitLabel);
            }}
          >
            {analogUnitLabel ? (
              <Label
                value={analogUnitLabel}
                angle={-90}
                position="insideLeft"
                offset={8}
                style={CHART_AXIS_LABEL_STYLE}
              />
            ) : null}
          </YAxis>
          {dualAxis && binarySeries.length > 0 ? (
            <YAxis
              yAxisId="binary"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={44}
              fontSize={CHART_AXIS_FONT_SIZE}
              domain={[-0.05, 1.05]}
              ticks={[0, 1]}
              tickFormatter={binaryAxisTick}
            >
              <Label
                value="Status"
                angle={90}
                position="insideRight"
                offset={4}
                style={CHART_AXIS_LABEL_STYLE}
              />
            </YAxis>
          ) : null}
          {dualAxis && msvSeries.length > 0 && msvSecondaryAxis ? (
            <YAxis
              yAxisId="msv"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={88}
              fontSize={CHART_AXIS_FONT_SIZE}
              domain={msvSecondaryAxis.domain}
              ticks={msvSecondaryAxis.ticks}
              tickFormatter={(v) => msvAxisTick(Number(v), msvSeries)}
            />
          ) : null}
          <ChartTooltip
            content={({ active, payload, label }) => (
              <SdAnleggPointChartTooltipContent
                active={active}
                payload={payload as SdAnleggPointChartTooltipPayload | undefined}
                label={label}
                seriesMap={seriesMap}
                spanMs={spanMs}
              />
            )}
          />
          {referenceValues.map((reference) => (
            <ReferenceLine
              key={`${reference.label}-${reference.value}`}
              yAxisId={primaryAxisId}
              y={reference.value}
              stroke={reference.color ?? "var(--muted-foreground)"}
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
          ))}
          {markers.map((marker) => {
            const ts = new Date(marker.timestamp).getTime();
            if (Number.isNaN(ts)) return null;
            return (
              <ReferenceLine
                key={`${marker.timestamp}-${marker.label ?? "marker"}`}
                x={ts}
                stroke={marker.color ?? "var(--destructive)"}
                strokeDasharray="3 3"
                yAxisId={primaryAxisId}
              />
            );
          })}
          {series.map((s) => (
            <Line
              key={s.key}
              yAxisId={
                s.scale === "binary" && dualAxis
                  ? "binary"
                  : s.scale === "msv" && dualAxis
                    ? "msv"
                    : primaryAxisId
              }
              type={s.scale === "msv" ? "stepAfter" : "monotone"}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.scale === "binary" ? 1.5 : 2}
              strokeDasharray={s.scale === "binary" ? "4 3" : undefined}
              dot={false}
              connectNulls
              isAnimationActive={false}
              legendType="none"
            />
          ))}
        </LineChart>
      </ChartContainer>
      {mixedAnalogUnits ? (
        <p className="px-2 pb-1 text-xs text-muted-foreground">
          {mixedAnalogUnitLabels.length > 0
            ? `${mixedAnalogUnitLabels.join(", ")} deles om venstre akse — bruk tooltip for nøyaktige verdier.`
            : "Flere enheter deles om venstre akse — bruk tooltip for nøyaktige verdier."}
        </p>
      ) : null}
      {footnote ? (
        <p className="px-2 pb-1 text-xs text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  );
}
