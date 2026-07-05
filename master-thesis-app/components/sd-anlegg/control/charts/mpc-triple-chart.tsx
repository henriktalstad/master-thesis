"use client";

import { useMemo } from "react";
import { useRechartsModules } from "@/components/charts/use-recharts-modules";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MpcSignalComparisonSeries } from "@/lib/sd-anlegg/control/control-types";
import { CONTROL_DISPLAY } from "@/lib/sd-anlegg/control/control-display-labels";
import { ControlChartSkeleton } from "@/components/sd-anlegg/control/shared/chart-shared";
import {
  CONTROL_CHART_HEIGHT,
  breakControlSeriesAtGaps,
  controlSeriesTimeSpanMs,
  formatControlTimeLabel,
} from "@/lib/sd-anlegg/control/chart-utils";
import { cn } from "@/lib/utils";

const DEVIATION_EPS = 0.05;

export function SdAnleggControlMpcTripleChart({
  series,
  showContext = false,
  stepMinutes = 60,
  plainLanguage = false,
}: {
  series: MpcSignalComparisonSeries;
  showContext?: boolean;
  stepMinutes?: 1 | 5 | 15 | 60;
  plainLanguage?: boolean;
}) {
  const recharts = useRechartsModules();
  const chartVariant = series.chartVariant ?? "policy";
  const showPolicyTracks = chartVariant === "policy";
  const showReference = chartVariant === "observed_with_reference";

  const spanMs = useMemo(() => controlSeriesTimeSpanMs(series.points), [series.points]);
  const brokenPoints = useMemo(
    () => breakControlSeriesAtGaps(series.points),
    [series.points],
  );

  const data = useMemo(
    () =>
      brokenPoints.map((p) => {
        const hasDeviation =
          showPolicyTracks &&
          p.observed != null &&
          p.mpc != null &&
          Math.abs(p.mpc - p.observed) > DEVIATION_EPS;
        return {
          label: formatControlTimeLabel(p.hour, stepMinutes, spanMs),
          observed: p.observed,
          emulated: p.emulated,
          mpc: p.mpc,
          reference: p.reference ?? null,
          hasDeviation,
        };
      }),
    [brokenPoints, stepMinutes, spanMs, showPolicyTracks],
  );

  const yDomain = useMemo(() => {
    const values = data.flatMap((row) =>
      [row.observed, row.emulated, row.mpc, row.reference].filter(
        (v): v is number => v != null && Number.isFinite(v),
      ),
    );
    if (values.length === 0) return undefined;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(0.5, (max - min) * 0.08);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [data]);

  const deviationCount = data.filter((d) => d.hasDeviation).length;
  const observedLegend = showReference ? series.label : CONTROL_DISPLAY.observed.chart;
  const referenceLegend = series.referenceLabel ?? "Referanse";

  const predictedLabel = plainLanguage
    ? CONTROL_DISPLAY.predicted.chart
    : CONTROL_DISPLAY.predicted.short;
  const simulatedLabel = plainLanguage
    ? CONTROL_DISPLAY.simulatedControl.opsShort
    : CONTROL_DISPLAY.simulatedControl.chart;

  const chartConfig = useMemo((): ChartConfig => {
    if (showReference) {
      return {
        observed: { label: observedLegend, color: "var(--chart-1)" },
        reference: { label: referenceLegend, color: "var(--chart-3)" },
      };
    }
    if (showPolicyTracks) {
      return {
        observed: { label: CONTROL_DISPLAY.observed.chart, color: "var(--chart-1)" },
        emulated: { label: CONTROL_DISPLAY.predicted.chart, color: "var(--chart-3)" },
        mpc: { label: simulatedLabel, color: "var(--primary)" },
      };
    }
    return {
      observed: { label: observedLegend, color: "var(--chart-1)" },
    };
  }, [showReference, showPolicyTracks, observedLegend, referenceLegend, simulatedLabel]);

  if (!recharts || data.length === 0) {
    return <ControlChartSkeleton className="h-[280px]" />;
  }

  const { CartesianGrid, Line, LineChart, ReferenceDot, XAxis, YAxis } = recharts;
  const unitSuffix =
    series.unit === "°C" ? "°" : series.unit === "%" ? "%" : "";
  const stepLabel = stepMinutes >= 60 ? "timer" : "intervaller";

  return (
    <div className="space-y-2">
      {showContext && showPolicyTracks && deviationCount > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {plainLanguage
            ? `${deviationCount} ${stepLabel} der simulert forslag avviker fra måling.`
            : `${deviationCount} ${stepLabel} der simulert forslag avviker mer enn ${DEVIATION_EPS}${series.unit} fra målt drift.`}
        </p>
      ) : null}
      {showContext && showReference ? (
        <p className="text-[11px] text-muted-foreground">
          Sammenligner operatør-innstilt og beregnet settpunkt.
        </p>
      ) : null}
      <ChartContainer
        config={chartConfig}
        className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
      >
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="label"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={48}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={yDomain}
            tickFormatter={(v) => `${v}${unitSuffix}`}
          />
          <ChartTooltip
            content={({ payload, label }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return null;
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">{label}</p>
                  <p className="text-muted-foreground">
                    {observedLegend}:{" "}
                    {row.observed != null ? `${row.observed}${series.unit}` : "—"}
                  </p>
                  {showReference ? (
                    <p className="text-muted-foreground">
                      {referenceLegend}:{" "}
                      {row.reference != null ? `${row.reference}${series.unit}` : "—"}
                    </p>
                  ) : null}
                  {showPolicyTracks ? (
                    <>
                      <p className="text-muted-foreground">
                        {predictedLabel}:{" "}
                        {row.emulated != null ? `${row.emulated}${series.unit}` : "—"}
                      </p>
                      <p className="text-muted-foreground">
                        {simulatedLabel}:{" "}
                        {row.mpc != null ? `${row.mpc}${series.unit}` : "—"}
                      </p>
                      {row.hasDeviation ? (
                        <p className="mt-1 text-primary">Endret pådrag dette intervallet</p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="monotone"
            dataKey="observed"
            name={observedLegend}
            stroke="var(--color-observed)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {showReference ? (
            <Line
              type="monotone"
              dataKey="reference"
              name={referenceLegend}
              stroke="var(--color-reference)"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="6 4"
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
          {showPolicyTracks ? (
            <>
              <Line
                type="monotone"
                dataKey="emulated"
                name={CONTROL_DISPLAY.predicted.chart}
                stroke="var(--color-emulated)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="6 4"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="mpc"
                name={simulatedLabel}
                stroke="var(--color-mpc)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </>
          ) : null}
          {showContext && showPolicyTracks
            ? data
                .filter((d): d is typeof d & { mpc: number } =>
                  d.hasDeviation && d.mpc != null,
                )
                .map((d, i) => (
                  <ReferenceDot
                    key={`${d.label}-${i}`}
                    x={d.label}
                    y={d.mpc}
                    r={3}
                    fill="var(--primary)"
                    stroke="var(--background)"
                    strokeWidth={1}
                  />
                ))
            : null}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
