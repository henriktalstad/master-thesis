"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRechartsModules } from "@/components/charts/use-recharts-modules";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  buildControlLoopSeries,
  CONTROL_LOOP_SERIES_LEGEND,
  controlLoopSeriesToStepTableSeries,
  type ControlLoopSeries,
} from "@/lib/sd-anlegg/control/live/build-control-loop-series";
import type { ControlLoopDisplaySource } from "@/lib/sd-anlegg/control/resolve-control-loop-display-steps";
import { maxControlLoopGapMs } from "@/lib/sd-anlegg/control/resolve-control-loop-display-steps";
import type { MpcSignalComparison } from "@/lib/sd-anlegg/control/control-types";
import { CONTROL_STYRING_OPS } from "@/lib/sd-anlegg/control/control-display-labels";
import { isControlComparisonDeviation } from "@/lib/sd-anlegg/control/control-comparison-precision";
import { LOOP_TO_COMPARISON_SERIES } from "@/lib/sd-anlegg/control/ops-signal-series-map";
import { SdAnleggControlMpcStepTable } from "@/components/sd-anlegg/control/styring/mpc-step-table";
import { SdAnleggControlCollapsibleSection } from "@/components/sd-anlegg/control/shared/section";
import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { SdAnleggControlChartCard } from "@/components/sd-anlegg/control/shared/chart-card";
import { ControlChartSkeleton } from "@/components/sd-anlegg/control/shared/chart-shared";
import {
  CONTROL_CHART_HEIGHT,
  breakSeriesAtTimeGaps,
  controlPercentYDomain,
  controlSeriesTimeSpanMs,
  controlTemperatureYDomain,
  formatControlSignalValue,
  formatControlTimeLabel,
} from "@/lib/sd-anlegg/control/chart-utils";
import { downsampleReplayStepsForChart } from "@/lib/sd-anlegg/control/downsample-replay-steps-for-chart";
import {
  controlStyringHref,
  type ControlLookbackDays,
  type ControlPeriodMode,
  type StyringSignalGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const SPARSE_CHART_POINT_THRESHOLD = 8;
const LOW_COVERAGE_THRESHOLD = 0.5;

type Props = {
  steps: readonly MpcReplayStep[];
  source?: ControlLoopDisplaySource;
  coverageHint?: string | null;
  stepMinutes?: 1 | 5 | 15 | 60;
  signalComparison?: MpcSignalComparison | null;
  expectedStepCount?: number;
  coverageRatio?: number;
  resolutionNote?: string | null;
  lookbackLabel?: string;
  buildingSlug?: string;
  lookbackDays?: ControlLookbackDays;
  periodMode?: ControlPeriodMode;
  grain?: StyringSignalGrain;
  variant?: "default" | "ops";
};

type LoopChartRow = {
  ts: number;
  label: string;
  observed: number | null;
  emulated: number | null;
  demand: number | null;
  mpc: number | null;
  hasDeviation: boolean;
  isLastPoint: boolean;
};

const LOOP_CHART_CONFIG = {
  observed: { label: CONTROL_LOOP_SERIES_LEGEND.observed, color: "hsl(142 71% 38%)" },
  emulated: { label: CONTROL_LOOP_SERIES_LEGEND.emulated, color: "hsl(199 89% 42%)" },
  mpc: { label: CONTROL_LOOP_SERIES_LEGEND.mpc, color: "hsl(330 75% 52%)" },
  demand: { label: CONTROL_LOOP_SERIES_LEGEND.demand, color: "var(--chart-4)" },
} as const;

const SOURCE_LABEL: Record<ControlLoopDisplaySource, string> = {
  "live-replay": "Live skyggesimulering",
  "eval-replay": "Simulert periode",
};

function resolveSparseRecommendation(
  lookbackDays: ControlLookbackDays,
  grain: StyringSignalGrain,
  periodMode: ControlPeriodMode = "live",
): {
  periodMode: ControlPeriodMode;
  days?: ControlLookbackDays;
  grain: StyringSignalGrain;
  label: string;
} | null {
  if (periodMode === "eval") return null;
  if (lookbackDays > 1) {
    return { periodMode: "live", days: 1, grain: "15", label: "24 t · 15 min" };
  }
  if (grain === "15") {
    return { periodMode: "live", days: 1, grain: "5", label: "24 t · 5 min" };
  }
  return { periodMode: "live", days: 1, grain: "1", label: "24 t · 1 min" };
}

function buildLoopChartRows(
  series: ControlLoopSeries,
  stepMinutes: 1 | 5 | 15 | 60,
): LoopChartRow[] {
  const lastTs = series.points[series.points.length - 1]?.t ?? null;
  const spanMs = controlSeriesTimeSpanMs(series.points.map((p) => ({ hour: p.t })));
  const maxGapMs = maxControlLoopGapMs(stepMinutes);
  const rows = series.points.map((p) => ({
    ts: new Date(p.t).getTime(),
    label: formatControlTimeLabel(p.t, stepMinutes, spanMs),
    observed: p.observed ?? null,
    emulated: p.emulated ?? null,
    demand: p.demand ?? null,
    mpc: p.mpc ?? null,
    hasDeviation: isControlComparisonDeviation(p.observed, p.mpc, series.unit),
    isLastPoint: lastTs != null && p.t === lastTs,
  }));
  return breakSeriesAtTimeGaps(
    rows,
    (row) => new Date(row.ts).toISOString(),
    ["observed", "emulated", "demand", "mpc"],
    maxGapMs,
  );
}

function seriesHasValues(
  data: readonly LoopChartRow[],
  key: keyof Omit<LoopChartRow, "ts" | "label" | "hasDeviation" | "isLastPoint">,
): boolean {
  return data.some((row) => {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value);
  });
}

function resolveDefaultLoopSeriesId(
  seriesList: readonly ControlLoopSeries[],
): keyof MpcControlVector {
  for (const series of seriesList) {
    const lastPoint = series.points[series.points.length - 1];
    if (
      lastPoint &&
      isControlComparisonDeviation(lastPoint.observed, lastPoint.mpc, series.unit)
    ) {
      return series.id;
    }
  }
  return seriesList[0]?.id ?? "supplySetpointC";
}

function LoopSeriesChart({
  series,
  recharts,
  spanMs,
  stepMinutes,
  showDemand = true,
}: {
  series: ControlLoopSeries;
  recharts: NonNullable<ReturnType<typeof useRechartsModules>>;
  spanMs: number;
  stepMinutes: 1 | 5 | 15 | 60;
  showDemand?: boolean;
}) {
  const chartData = useMemo(
    () => buildLoopChartRows(series, stepMinutes),
    [series, stepMinutes],
  );

  const hasObserved = seriesHasValues(chartData, "observed");
  const hasEmulated = seriesHasValues(chartData, "emulated");
  const hasDemand = showDemand && seriesHasValues(chartData, "demand");
  const hasMpc = seriesHasValues(chartData, "mpc");
  const hasAnyData = hasObserved || hasEmulated || hasDemand || hasMpc;

  const yDomain = useMemo(() => {
    const values = chartData.flatMap((row) => [
      row.observed,
      row.emulated,
      showDemand ? row.demand : null,
      row.mpc,
    ]);
    if (series.unit === "%") return controlPercentYDomain(values);
    if (series.unit === "°C") return controlTemperatureYDomain(values);
    return undefined;
  }, [chartData, series.unit, showDemand]);

  const unitSuffix = series.unit === "°C" ? "°" : series.unit === "%" ? "%" : "";

  if (!hasAnyData) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        Ingen data for {series.label.toLowerCase()} i valgt periode.
      </p>
    );
  }

  const { CartesianGrid, Line, LineChart, XAxis, YAxis } = recharts;

  return (
    <div className="space-y-2">
      <ChartContainer
        className={cn("aspect-auto w-full", CONTROL_CHART_HEIGHT)}
        config={LOOP_CHART_CONFIG}
      >
        <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
          <XAxis
            type="number"
            scale="time"
            dataKey="ts"
            domain={["dataMin", "dataMax"]}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            minTickGap={56}
            tickFormatter={(ts) =>
              formatControlTimeLabel(new Date(ts as number).toISOString(), stepMinutes, spanMs)
            }
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
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as LoopChartRow | undefined;
              return row?.label ?? "—";
            }}
            content={({ payload }) => {
              const row = payload?.[0]?.payload as LoopChartRow | undefined;
              if (!row) return null;
              const fmt = (value: number | null) =>
                value != null ? formatControlSignalValue(value, series.unit) : "—";
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                  <p className="mb-1 font-medium">
                    {row.label}
                    {row.isLastPoint ? " · siste intervall" : ""}
                  </p>
                  {hasObserved ? (
                    <p className="text-chart-1">
                      {CONTROL_LOOP_SERIES_LEGEND.observed}: {fmt(row.observed)}
                    </p>
                  ) : null}
                  {hasEmulated ? (
                    <p className="text-chart-3">
                      {CONTROL_LOOP_SERIES_LEGEND.emulated}: {fmt(row.emulated)}
                    </p>
                  ) : null}
                  {hasDemand ? (
                    <p className="text-chart-4">
                      {CONTROL_LOOP_SERIES_LEGEND.demand}: {fmt(row.demand)}
                    </p>
                  ) : null}
                  {hasMpc ? (
                    <p className="text-chart-2">
                      {CONTROL_LOOP_SERIES_LEGEND.mpc}: {fmt(row.mpc)}
                    </p>
                  ) : null}
                  {row.hasDeviation ? (
                    <p className="mt-1 text-primary">
                      {CONTROL_STYRING_OPS.loopTooltipDeviation}
                    </p>
                  ) : null}
                </div>
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {hasEmulated ? (
            <Line
              type="linear"
              dataKey="emulated"
              name="emulated"
              stroke="var(--color-emulated)"
              dot={{ r: 2, fill: "var(--color-emulated)", strokeWidth: 0 }}
              strokeWidth={2}
              strokeDasharray="7 5"
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
          {hasObserved ? (
            <Line
              type="linear"
              dataKey="observed"
              name="observed"
              stroke="var(--color-observed)"
              dot={{ r: 2.5, fill: "var(--color-observed)", strokeWidth: 0 }}
              strokeWidth={2.5}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={{ r: 4, strokeWidth: 1.5, fill: "var(--color-observed)" }}
            />
          ) : null}
          {hasMpc ? (
            <Line
              type="linear"
              dataKey="mpc"
              name="mpc"
              stroke="var(--color-mpc)"
              dot={{ r: 2.5, fill: "var(--color-mpc)", strokeWidth: 0 }}
              strokeWidth={2.5}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={{ r: 4, strokeWidth: 1.5, fill: "var(--color-mpc)" }}
            />
          ) : null}
          {hasDemand ? (
            <Line
              type="linear"
              dataKey="demand"
              name="demand"
              stroke="var(--color-demand)"
              dot={false}
              strokeWidth={1.25}
              strokeDasharray="2 3"
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export function SdAnleggControlLoopChart({
  steps,
  source = "live-replay",
  coverageHint: _coverageHint = null,
  stepMinutes = 15,
  signalComparison = null,
  expectedStepCount,
  coverageRatio,
  resolutionNote: _resolutionNote = null,
  lookbackLabel: _lookbackLabel = "Valgt periode",
  buildingSlug,
  lookbackDays = 1,
  periodMode = "live",
  grain = "15",
  variant = "default",
}: Props) {
  const isOps = variant === "ops";
  const recharts = useRechartsModules();
  const totalStepCount = steps.length;
  const chartSteps = useMemo(
    () => downsampleReplayStepsForChart(steps),
    [steps],
  );
  const fullSeriesList = useMemo(
    () => buildControlLoopSeries(steps),
    [steps],
  );
  const seriesList = useMemo(
    () => buildControlLoopSeries(chartSteps),
    [chartSteps],
  );
  const preferredActiveId = useMemo(
    () =>
      resolveDefaultLoopSeriesId(
        fullSeriesList.length > 0 ? fullSeriesList : seriesList,
      ),
    [fullSeriesList, seriesList],
  );
  const [userActiveId, setUserActiveId] = useState<keyof MpcControlVector | null>(
    null,
  );
  const activeId =
    userActiveId != null && seriesList.some((s) => s.id === userActiveId)
      ? userActiveId
      : preferredActiveId;

  const activeComparisonSeries = useMemo(() => {
    const fullSeries = fullSeriesList.find((s) => s.id === activeId);
    if (fullSeries && isOps) {
      return controlLoopSeriesToStepTableSeries(fullSeries);
    }
    if (!signalComparison) return null;
    const comparisonId = LOOP_TO_COMPARISON_SERIES[activeId];
    if (!comparisonId) return null;
    return signalComparison.series.find((s) => s.id === comparisonId) ?? null;
  }, [activeId, fullSeriesList, isOps, signalComparison]);

  const spanMs = useMemo(
    () => controlSeriesTimeSpanMs(chartSteps.map((s) => ({ hour: s.t }))),
    [chartSteps],
  );

  const expectedCount = expectedStepCount ?? totalStepCount;
  const effectiveCoverage =
    coverageRatio ??
    Math.min(1, totalStepCount / Math.max(expectedCount, 1));
  const sparseChart = totalStepCount < SPARSE_CHART_POINT_THRESHOLD;
  const showSparseWarning =
    periodMode !== "eval" &&
    (sparseChart || effectiveCoverage < LOW_COVERAGE_THRESHOLD);
  const sparseRecommendation = resolveSparseRecommendation(
    lookbackDays,
    grain,
    periodMode,
  );
  const sparseHref =
    buildingSlug != null && sparseRecommendation
      ? controlStyringHref(buildingSlug, {
          periodMode: sparseRecommendation.periodMode,
          days: sparseRecommendation.days,
          tab: "na",
          grain: sparseRecommendation.grain,
        })
      : null;

  if (totalStepCount === 0) {
    return (
      <SdAnleggControlChartCard
        title={CONTROL_STYRING_OPS.loopTitle}
        description={CONTROL_STYRING_OPS.loopDescription}
      >
        <p className="py-8 text-center text-xs text-muted-foreground">
          Ingen data ennå — venter på simulering.
        </p>
      </SdAnleggControlChartCard>
    );
  }

  if (!recharts || seriesList.length === 0) {
    return <ControlChartSkeleton className="h-[280px]" />;
  }

  const title = isOps ? CONTROL_STYRING_OPS.loopTitle : "Styring over tid";
  const description = isOps
    ? CONTROL_STYRING_OPS.loopDescription
    : `${totalStepCount} intervaller à ${stepMinutes} min · ${SOURCE_LABEL[source]}`;

  const subtitle = isOps ? CONTROL_STYRING_OPS.loopDescriptionOps : undefined;

  return (
    <SdAnleggControlChartCard
      title={title}
      description={description}
      dataCoverage={subtitle}
    >
      {showSparseWarning ? (
        <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {CONTROL_STYRING_OPS.loopSparseDataWarning}{" "}
          {sparseHref && sparseRecommendation ? (
            <Link
              href={sparseHref}
              className="font-medium underline underline-offset-2"
            >
              {CONTROL_STYRING_OPS.loopSparseDataAction(sparseRecommendation.label)}
            </Link>
          ) : null}
        </p>
      ) : null}

      {sparseChart ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          For få punkter til meningsfull graf i valgt periode.
        </p>
      ) : (
        <Tabs
          value={activeId}
          onValueChange={(value) =>
            setUserActiveId(value as keyof MpcControlVector)
          }
        >
          <TabsList className="mb-3 h-auto flex-wrap gap-1 bg-transparent p-0">
            {seriesList.map((s) => (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className="h-8 rounded-lg border border-border/80 px-3 text-xs data-[state=active]:border-primary/40 data-[state=active]:bg-primary/5"
              >
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {seriesList.map((s) => (
            <TabsContent key={s.id} value={s.id} className="mt-0 space-y-4">
              <LoopSeriesChart
                series={s}
                recharts={recharts}
                spanMs={spanMs}
                stepMinutes={stepMinutes}
                showDemand={!isOps}
              />
              {activeComparisonSeries && activeId === s.id ? (
                <SdAnleggControlCollapsibleSection
                  title={CONTROL_STYRING_OPS.tableTitle}
                  description={CONTROL_STYRING_OPS.tableDescription(
                    activeComparisonSeries.tabLabel,
                    stepMinutes,
                  )}
                  badge={`${activeComparisonSeries.points.length}`}
                  defaultOpen={false}
                >
                  <SdAnleggControlMpcStepTable
                    series={activeComparisonSeries}
                    stepMinutes={stepMinutes}
                    plainLanguage
                    defaultSortMode="sd_vs_mpc"
                    emphasizeObservedVsSim
                  />
                </SdAnleggControlCollapsibleSection>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </SdAnleggControlChartCard>
  );
}
