"use client";

import { useMemo } from "react";
import { useRechartsModules } from "@/components/charts/use-recharts-modules";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import type { MpcForwardPlan } from "@/lib/sd-anlegg/control/control-types";
import type {
  MpcComfortPoint,
  MpcCostTimelinePoint,
  MpcReplayEffectSummary,
} from "@/lib/sd-anlegg/control/build-mpc-replay-profiles";
import { cn } from "@/lib/utils";
import { ControlChartSkeleton } from "@/components/sd-anlegg/control/shared/chart-shared";
import {
  CONTROL_CHART_HEIGHT,
  breakSeriesAtTimeGaps,
  controlTemperatureYDomain,
  formatControlHourLabel,
  formatControlTimeLabel,
  formatKrShort,
} from "@/lib/sd-anlegg/control/chart-utils";
import { formatProxyKr } from "@/components/sd-anlegg/control/format-proxy-kr";
import {
  CONTROL_DISPLAY,
  CONTROL_EFFECT_UI,
} from "@/lib/sd-anlegg/control/control-display-labels";
import type { ControlStrategyRow } from "@/lib/sd-anlegg/control/build-control-strategy-comparison";
import type { PriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import { PRICE_BAND_ORDER, type PriceBand } from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";

export function SdAnleggControlMpcEffectChart({
  effect,
}: {
  effect: MpcReplayEffectSummary;
}) {
  const recharts = useRechartsModules();
  const data = useMemo(
    () => [
      { label: CONTROL_DISPLAY.predicted.short, costKr: effect.baselineCostKr },
      { label: CONTROL_DISPLAY.simulatedControl.short, costKr: effect.mpcCostKr },
    ],
    [effect],
  );

  const yDomain = useMemo(() => {
    const min = Math.min(effect.baselineCostKr, effect.mpcCostKr);
    const max = Math.max(effect.baselineCostKr, effect.mpcCostKr);
    const span = max - min;
    const pad = span > 0 ? Math.max(span * 0.35, 0.5) : Math.max(max * 0.08, 1);
    return [Math.max(0, min - pad), max + pad];
  }, [effect]);

  if (!recharts) return <ControlChartSkeleton />;

  const { Bar, BarChart, CartesianGrid, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{ costKr: { label: "Kost (kr)", color: "var(--chart-1)" } }}
      className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
    >
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          domain={yDomain}
          tickFormatter={(v) => formatKrShort(Number(v))}
        />
        <ChartTooltip
          content={({ payload, label }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!row) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                <p className="font-medium">{label}</p>
                <p>{formatProxyKr(row.costKr)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="costKr" fill="var(--color-costKr)" radius={[4, 4, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ChartContainer>
  );
}

export function SdAnleggControlPolicyCostChart({
  rows,
}: {
  rows: readonly ControlStrategyRow[];
}) {
  const recharts = useRechartsModules();
  const data = useMemo(
    () =>
      rows.map((row) => ({
        label:
          row.id === "simulated"
            ? CONTROL_DISPLAY.simulatedControl.chart
            : row.id === "predicted"
              ? CONTROL_DISPLAY.predicted.chart
              : row.id === "demand"
                ? CONTROL_DISPLAY.demand.chart
                : CONTROL_DISPLAY.observed.chart,
        costKr: row.totalCostKr,
        isMpc: row.id === "simulated",
        isReference: row.id === "observed",
      })),
    [rows],
  );

  const xDomain = useMemo(() => {
    const values = data.map((d) => d.costKr);
    if (values.length === 0) return [0, 100] as [number, number];
    const max = Math.max(...values);
    return [0, Math.ceil(max * 1.08)] as [number, number];
  }, [data]);

  if (!recharts || data.length === 0) return <ControlChartSkeleton />;

  const { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{ costKr: { label: "Kost (kr)", color: "var(--chart-1)" } }}
      className={cn("aspect-auto h-[min(220px,38vh)] w-full")}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 16, top: 4, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis
          type="number"
          domain={xDomain}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatKrShort(Number(v))}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={108}
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          content={({ payload, label }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!row) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                <p className="font-medium">{label}</p>
                <p>{formatProxyKr(row.costKr)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="costKr" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={
                entry.isMpc
                  ? "var(--primary)"
                  : entry.isReference
                    ? "var(--chart-1)"
                    : "var(--chart-3)"
              }
              fillOpacity={entry.isMpc ? 1 : 0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function SdAnleggControlMpcCostTimelineChart({
  points,
}: {
  points: MpcCostTimelinePoint[];
}) {
  const recharts = useRechartsModules();
  const data = useMemo(() => {
    const broken = breakSeriesAtTimeGaps(
      points,
      (p) => p.hour,
      ["baselineCostKr", "mpcCostKr", "deltaCostKr"],
    );
    return broken.map((p) => ({
      label: formatControlHourLabel(p.hour),
      baseline: p.baselineCostKr,
      mpc: p.mpcCostKr,
      delta: p.deltaCostKr,
    }));
  }, [points]);

  if (!recharts || data.length === 0) return <ControlChartSkeleton />;

  const { CartesianGrid, Line, LineChart, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{
        baseline: { label: CONTROL_DISPLAY.predicted.chart, color: "var(--chart-3)" },
        mpc: { label: CONTROL_DISPLAY.simulatedControl.chart, color: "var(--primary)" },
      }}
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
          minTickGap={28}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => formatKrShort(Number(v))}
        />
        <ChartTooltip
          content={({ payload, label }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!row) return null;
            if (row.baseline == null && row.mpc == null) {
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">{label}</p>
                  <p className="text-muted-foreground">Ingen replay-data i timen</p>
                </div>
              );
            }
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                <p className="font-medium">{label}</p>
                {row.baseline != null ? (
                  <p>{CONTROL_DISPLAY.predicted.short}: {Math.round(row.baseline)} kr</p>
                ) : null}
                {row.mpc != null ? (
                  <p>{CONTROL_DISPLAY.simulatedControl.short}: {Math.round(row.mpc)} kr</p>
                ) : null}
                {row.delta != null ? (
                  <p
                    className={
                      row.delta < 0
                        ? "text-emerald-600"
                        : row.delta > 0
                          ? "text-amber-600"
                          : ""
                    }
                  >
                    Forskjell {row.delta > 0 ? "+" : ""}
                    {Math.round(row.delta)} kr
                  </p>
                ) : null}
              </div>
            );
          }}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="baseline"
          name="baseline"
          stroke="var(--color-baseline)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="mpc"
          name="mpc"
          stroke="var(--color-mpc)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function SdAnleggControlMpcComfortChart({
  points,
  comfortBand,
  focus = false,
}: {
  points: MpcComfortPoint[];
  comfortBand?: { min: number; max: number };
  focus?: boolean;
}) {
  const recharts = useRechartsModules();
  const resolvedBand = useMemo(() => {
    if (comfortBand) return comfortBand;
    if (points.length === 0) return { min: 18, max: 24 };
    return {
      min: Math.min(...points.map((p) => p.comfortBandMinC)),
      max: Math.max(...points.map((p) => p.comfortBandMaxC)),
    };
  }, [comfortBand, points]);

  const data = useMemo(() => {
    const spanMs =
      points.length >= 2
        ? new Date(points[points.length - 1]!.t).getTime() -
          new Date(points[0]!.t).getTime()
        : 0;
    const broken = breakSeriesAtTimeGaps(
      points,
      (p) => p.t,
      ["measuredC", "emulatedC", "mpcC", "demandC"],
      20 * 60_000,
    );
    return broken.map((p) => ({
      label: formatControlTimeLabel(p.t, 15, spanMs),
      measured: p.measuredC,
      emulated: p.emulatedC,
      mpc: p.mpcC,
      demand: p.demandC,
      bandMin: p.comfortBandMinC,
      bandMax: p.comfortBandMaxC,
      violationMpc: p.comfortViolationMpc,
    }));
  }, [points]);

  const yDomain = useMemo(
    () =>
      controlTemperatureYDomain([
        ...data.map((d) => d.measured),
        ...data.map((d) => d.emulated),
        ...data.map((d) => d.mpc),
        ...data.map((d) => d.demand),
        resolvedBand.min,
        resolvedBand.max,
      ]) ?? [resolvedBand.min - 2, resolvedBand.max + 2],
    [data, resolvedBand.max, resolvedBand.min],
  );

  const violationHours = useMemo(
    () => Math.round((points.filter((p) => p.comfortViolationMpc).length * 15) / 60),
    [points],
  );

  if (!recharts || data.length === 0) return <ControlChartSkeleton />;

  const { CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis } = recharts;

  return (
    <div className="space-y-2">
      <ChartContainer
        config={{
          measured: { label: "Målt avtrekk", color: "var(--chart-1)" },
          emulated: { label: CONTROL_DISPLAY.predicted.chart, color: "var(--chart-3)" },
          mpc: { label: CONTROL_DISPLAY.simulatedControl.chart, color: "var(--primary)" },
          demand: { label: CONTROL_DISPLAY.demand.chart, color: "var(--chart-4)" },
        }}
        className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
      >
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <ReferenceArea
            y1={resolvedBand.min}
            y2={resolvedBand.max}
            fill="var(--chart-2)"
            fillOpacity={0.08}
            strokeOpacity={0}
          />
          <XAxis
            dataKey="label"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={36}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={yDomain}
            tickFormatter={(v) => `${v}°`}
          />
          <ChartTooltip
            content={({ payload, label }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return null;
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">{label}</p>
                  {row.measured != null ? (
                    <p>{CONTROL_DISPLAY.observed.short}: {row.measured.toFixed(1)} °C</p>
                  ) : null}
                  {row.emulated != null ? (
                    <p>{CONTROL_DISPLAY.predicted.short}: {row.emulated.toFixed(1)} °C</p>
                  ) : null}
                  {row.mpc != null ? (
                    <p>{CONTROL_DISPLAY.simulatedControl.short}: {row.mpc.toFixed(1)} °C</p>
                  ) : null}
                  {row.demand != null ? (
                    <p>{CONTROL_DISPLAY.demand.short}: {row.demand.toFixed(1)} °C</p>
                  ) : null}
                  <p className="text-muted-foreground">
                    Band {row.bandMin}–{row.bandMax} °C
                    {row.violationMpc ? " · simulert utenfor band" : ""}
                  </p>
                </div>
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="monotone"
            dataKey="measured"
            name="measured"
            stroke="var(--color-measured)"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {!focus ? (
            <Line
              type="monotone"
              dataKey="emulated"
              name="baseline"
              stroke="var(--color-emulated)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="mpc"
            name="mpc"
            stroke="var(--color-mpc)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {!focus ? (
            <Line
              type="monotone"
              dataKey="demand"
              name="demand"
              stroke="var(--color-demand)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ChartContainer>
      {violationHours > 0 ? (
        <p className="text-xs text-muted-foreground">
          {CONTROL_EFFECT_UI.chartComfortViolationNote(violationHours)}
        </p>
      ) : null}
    </div>
  );
}

type ForwardSignalSpec = {
  id: string;
  tabLabel: string;
  unit: string;
  emulatedKey: "supplySetpointC" | "supplyFanPct" | "exhaustFanPct" | "heatingValvePct";
  mpcKey: "supplySetpointC" | "supplyFanPct" | "exhaustFanPct" | "heatingValvePct";
};

const FORWARD_SIGNALS: ForwardSignalSpec[] = [
  { id: "sp", tabLabel: "Tilluft SP", unit: "°C", emulatedKey: "supplySetpointC", mpcKey: "supplySetpointC" },
  { id: "fan", tabLabel: "Tilluftvifte", unit: "%", emulatedKey: "supplyFanPct", mpcKey: "supplyFanPct" },
  { id: "exhaust", tabLabel: "Avtrekk", unit: "%", emulatedKey: "exhaustFanPct", mpcKey: "exhaustFanPct" },
  { id: "heat", tabLabel: "Varmebatteri", unit: "%", emulatedKey: "heatingValvePct", mpcKey: "heatingValvePct" },
];

export function SdAnleggControlMpcForwardSignalsChart({
  forwardPlan,
  activeSignalId,
}: {
  forwardPlan: MpcForwardPlan;
  activeSignalId: string;
}) {
  const recharts = useRechartsModules();
  const spec = FORWARD_SIGNALS.find((s) => s.id === activeSignalId) ?? FORWARD_SIGNALS[0]!;

  const data = useMemo(
    () =>
      forwardPlan.planSteps.map((step) => ({
        label: formatControlTimeLabel(step.t, forwardPlan.stepMinutes === 15 ? 15 : 60),
        emulated: step.uBmsSim[spec.emulatedKey],
        mpc: step.uMpc[spec.mpcKey],
        spotKrPerKwh: step.spotKrPerKwh,
        outdoorTempC: step.outdoorTempC,
      })),
    [forwardPlan.planSteps, forwardPlan.stepMinutes, spec],
  );

  if (!recharts) return <ControlChartSkeleton className="h-[280px]" />;

  const { CartesianGrid, Line, LineChart, XAxis, YAxis } = recharts;
  const unitSuffix = spec.unit === "°C" ? "°" : spec.unit;

  return (
    <ChartContainer
      config={{
        emulated: { label: CONTROL_DISPLAY.predicted.chart, color: "var(--chart-3)" },
        mpc: { label: CONTROL_DISPLAY.simulatedControl.chart, color: "var(--primary)" },
      }}
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
          tickFormatter={(v) => `${v}${unitSuffix}`}
        />
        <ChartTooltip
          content={({ payload, label }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!row) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                <p className="font-medium">{label}</p>
                <p>{CONTROL_DISPLAY.predicted.short}: {row.emulated}{spec.unit}</p>
                <p>{CONTROL_DISPLAY.simulatedControl.short}: {row.mpc}{spec.unit}</p>
              </div>
            );
          }}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="emulated"
          name="emulated"
          stroke="var(--color-emulated)"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="6 4"
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="mpc"
          name="mpc"
          stroke="var(--color-mpc)"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  high: "Høy pris",
  medium: "Middels",
  low: "Lav pris",
};

export function SdAnleggControlPriceBandChart({
  analysis,
}: {
  analysis: PriceLoadShiftAnalysis;
}) {
  const recharts = useRechartsModules();
  const data = useMemo(
    () =>
      PRICE_BAND_ORDER.map((band) => ({
        label: PRICE_BAND_LABELS[band],
        baseline: analysis.bands[band].baselineKwh,
        mpc: analysis.bands[band].mpcKwh,
      })),
    [analysis.bands],
  );

  if (!recharts) return <ControlChartSkeleton />;

  const { Bar, BarChart, CartesianGrid, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{
        baseline: { label: CONTROL_DISPLAY.predicted.chart, color: "var(--chart-3)" },
        mpc: { label: CONTROL_DISPLAY.simulatedControl.chart, color: "var(--primary)" },
      }}
      className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
    >
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => `${Number(v).toFixed(0)}`}
        />
        <ChartTooltip
          content={({ payload, label }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!row) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                <p className="font-medium">{label}</p>
                <p>
                  {CONTROL_DISPLAY.predicted.short}: {row.baseline.toFixed(1)} kWh
                </p>
                <p>
                  {CONTROL_DISPLAY.simulatedControl.short}: {row.mpc.toFixed(1)} kWh
                </p>
              </div>
            );
          }}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="baseline"
          name="baseline"
          fill="var(--color-baseline)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          dataKey="mpc"
          name="mpc"
          fill="var(--color-mpc)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  );
}

export { FORWARD_SIGNALS as MPC_FORWARD_SIGNAL_SPECS };
