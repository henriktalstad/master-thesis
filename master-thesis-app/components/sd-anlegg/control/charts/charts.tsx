"use client";

import { useMemo } from "react";
import { useRechartsModules } from "@/components/charts/use-recharts-modules";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type {
  ControlEffectSummary,
  ControlForwardPlan,
  ControlLoadHourPoint,
  ControlMpcOutlook,
  ControlSignalImpact,
  ControlTrackingSummary,
} from "@/lib/sd-anlegg/control/control-types";
import { cn } from "@/lib/utils";
import { ControlChartSkeleton } from "@/components/sd-anlegg/control/shared/chart-shared";
import {
  CONTROL_CHART_HEIGHT,
  breakSeriesAtTimeGaps,
  formatControlDateTimeLabel,
  formatControlHourLabel,
  formatKrShort,
} from "@/lib/sd-anlegg/control/chart-utils";
import { CONTROL_DISPLAY } from "@/lib/sd-anlegg/control/control-display-labels";

export function SdAnleggControlMpcForecastChart({
  outlook,
}: {
  outlook: ControlMpcOutlook;
}) {
  const recharts = useRechartsModules();
  const data = useMemo(
    () =>
      outlook.forecastPoints.map((p) => ({
        hour: p.hour,
        label: formatControlHourLabel(p.hour),
        temp: p.outdoorTempC,
        price: p.spotKrPerKwh,
      })),
    [outlook.forecastPoints],
  );

  const hasTemp = data.some((p) => p.temp != null);
  const hasPrice = data.some((p) => p.price != null);

  if (!recharts) {
    return <ControlChartSkeleton />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        Ingen vær- eller prisprognose tilgjengelig
      </div>
    );
  }

  const { CartesianGrid, Line, LineChart, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{
        temp: { label: "Utetemp °C", color: "var(--chart-1)" },
        price: { label: "Spot kr/kWh", color: "var(--chart-4)" },
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
        {hasTemp ? (
          <YAxis
            yAxisId="temp"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => `${v}°`}
          />
        ) : null}
        {hasPrice ? (
          <YAxis
            yAxisId="price"
            orientation="right"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => Number(v).toFixed(2)}
          />
        ) : null}
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
                return row?.label ?? "";
              }}
              formatter={(value, name) => {
                if (value == null || Number.isNaN(Number(value))) return ["—", String(name)];
                if (name === "temp") return [`${Number(value).toFixed(1)} °C`, "Utetemp"];
                if (name === "price") return [`${Number(value).toFixed(2)} kr/kWh`, "Spot"];
                return [String(value), String(name)];
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {hasTemp ? (
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temp"
            name="temp"
            stroke="var(--color-temp)"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ) : null}
        {hasPrice ? (
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            name="price"
            stroke="var(--color-price)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 4"
            connectNulls
            isAnimationActive={false}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}

export function SdAnleggControlLoadChart({
  loadProfile,
  peakHour,
  showPrice = true,
  showObserved = false,
}: {
  loadProfile: readonly ControlLoadHourPoint[];
  peakHour?: string;
  showPrice?: boolean;
  showObserved?: boolean;
}) {
  const recharts = useRechartsModules();
  const data = useMemo(() => {
    const mapped = loadProfile.map((p) => ({
      hour: p.hour,
      label: formatControlHourLabel(p.hour),
      observed: p.observedKw,
      actual: p.actualKw,
      simulated: p.simulatedKw,
      price: p.spotKrPerKwh,
      isPeak: peakHour != null && p.hour === peakHour,
    }));
    return breakSeriesAtTimeGaps(
      mapped,
      (p) => p.hour,
      showObserved
        ? ["observed", "actual", "simulated"]
        : ["actual", "simulated"],
    );
  }, [loadProfile, peakHour, showObserved]);

  const hasPrice =
    showPrice && data.some((d) => d.price != null && Number.isFinite(d.price));

  if (!recharts || data.length === 0) {
    return <ControlChartSkeleton />;
  }

  const { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{
        observed: { label: CONTROL_DISPLAY.observed.chart, color: "var(--chart-5)" },
        actual: { label: CONTROL_DISPLAY.predicted.chart, color: "var(--chart-1)" },
        simulated: { label: CONTROL_DISPLAY.simulatedControl.chart, color: "var(--chart-2)" },
        price: { label: "Spot kr/kWh", color: "var(--chart-4)" },
      }}
      className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
    >
      <LineChart data={data} margin={{ left: 4, right: hasPrice ? 48 : 12, top: 8, bottom: 0 }}>
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
          yAxisId="load"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => `${v}`}
        />
        {hasPrice ? (
          <YAxis
            yAxisId="price"
            orientation="right"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => `${Number(v).toFixed(2)}`}
          />
        ) : null}
        <ChartTooltip
          content={({ payload, label }) => {
            const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!row) return null;
            const lines = payload ?? [];
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                <p className="font-medium">{label}</p>
                {lines.map((item) => {
                  const key = String(item.dataKey ?? item.name ?? "");
                  const value = item.value as number | null | undefined;
                  if (value == null || !Number.isFinite(Number(value))) return null;
                  if (key === "price") {
                    return (
                      <p key={key}>
                        Spot: {Number(value).toFixed(3)} kr/kWh
                      </p>
                    );
                  }
                  const seriesLabel =
                    key === "observed"
                      ? CONTROL_DISPLAY.observed.short
                      : key === "actual"
                        ? CONTROL_DISPLAY.predicted.short
                        : CONTROL_DISPLAY.simulatedControl.short;
                  return (
                    <p key={key}>
                      {seriesLabel}: {Number(value).toFixed(1)} kW
                    </p>
                  );
                })}
              </div>
            );
          }}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {showObserved && data.some((d) => d.observed != null) ? (
          <Line
            yAxisId="load"
            type="monotone"
            dataKey="observed"
            name="observed"
            stroke="var(--color-observed)"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ) : null}
        <Line
          yAxisId="load"
          type="monotone"
          dataKey="actual"
          name="actual"
          stroke="var(--color-actual)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        {data.some((d) => d.simulated != null) ? (
          <Line
            yAxisId="load"
            type="monotone"
            dataKey="simulated"
            name="simulated"
            stroke="var(--color-simulated)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 4"
            connectNulls={false}
            isAnimationActive={false}
          />
        ) : null}
        {hasPrice ? (
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            name="price"
            stroke="var(--color-price)"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="3 3"
            connectNulls
            isAnimationActive={false}
          />
        ) : null}
        {peakHour ? (
          <ReferenceLine
            x={formatControlHourLabel(peakHour)}
            stroke="var(--chart-4)"
            strokeDasharray="3 3"
            label={{
              value: "Topp",
              position: "insideTopRight",
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}

export function SdAnleggControlTrackingChart({
  tracking,
}: {
  tracking: ControlTrackingSummary;
}) {
  const recharts = useRechartsModules();
  const data = useMemo(
    () =>
      tracking.points.map((p) => ({
        label: formatControlDateTimeLabel(p.createdAt),
        predicted: p.predictedDeltaPctCostKr,
        actual: p.actualDeltaPctCostKr,
      })),
    [tracking.points],
  );

  if (!recharts || data.length === 0) {
    return null;
  }

  const { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{
        predicted: { label: "Predikert Δ%", color: "var(--chart-2)" },
        actual: { label: "Faktisk Δ%", color: "var(--chart-1)" },
      }}
      className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
    >
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => `${v}%`}
        />
        <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="predicted"
          name="predicted"
          stroke="var(--color-predicted)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-predicted)" }}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="actual"
          stroke="var(--color-actual)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-actual)" }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function SdAnleggControlSignalImpactChart({
  impacts,
}: {
  impacts: ControlSignalImpact[];
}) {
  const recharts = useRechartsModules();
  const data = useMemo(
    () =>
      impacts.slice(0, 5).map((i) => ({
        label: i.label,
        corr: i.correlationKwh ?? 0,
      })),
    [impacts],
  );

  if (!recharts || data.length === 0) return null;

  const { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{ corr: { label: "Korrelasjon kW", color: "var(--chart-3)" } }}
      className={cn("aspect-auto h-[min(200px,36vh)] w-full")}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis type="number" domain={[-1, 1]} fontSize={10} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine x={0} stroke="var(--border)" strokeWidth={1} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => {
                if (value == null || Number.isNaN(Number(value))) return ["—", "Korrelasjon"];
                return [Number(value).toFixed(2), "Korrelasjon"];
              }}
            />
          }
        />
        <Bar dataKey="corr" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={
                entry.corr >= 0 ? "var(--chart-1)" : "var(--chart-4)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function SdAnleggControlEffectChart({
  effect,
}: {
  effect: ControlEffectSummary;
}) {
  const recharts = useRechartsModules();
  const data = useMemo(
    () => [
      {
        label: "Gjeldende",
        kwh: effect.baselineKwh,
        costKr: effect.baselineCostKr,
      },
      {
        label: CONTROL_DISPLAY.demand.short,
        kwh: effect.scopedKwh,
        costKr: effect.scopedCostKr,
      },
    ],
    [effect],
  );

  if (!recharts) return <ControlChartSkeleton />;

  const { Bar, BarChart, CartesianGrid, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{
        costKr: { label: "Kost (kr)", color: "var(--chart-1)" },
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
          tickFormatter={(v) => formatKrShort(Number(v))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                if (value == null || Number.isNaN(Number(value))) return ["—", String(name)];
                return [
                  name === "costKr" ? `${Math.round(Number(value))} kr` : `${value} kWh`,
                  name === "costKr" ? "Kost" : "Energi",
                ];
              }}
            />
          }
        />
        <Bar dataKey="costKr" fill="var(--color-costKr)" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ChartContainer>
  );
}

export function SdAnleggControlForwardPlanChart({
  plan,
}: {
  plan: ControlForwardPlan;
}) {
  const recharts = useRechartsModules();
  const data = useMemo(
    () =>
      plan.planHours.map((h) => ({
        label: formatControlHourLabel(h.hour),
        spot: h.spotKrPerKwh,
        outdoor: h.outdoorTempC,
        deltaKr: h.expectedDeltaCostKr,
        spGjeldende: h.gjeldendeProfile?.supplySetpointC ?? null,
        spScoped: h.scopedProfile?.supplySetpointC ?? null,
      })),
    [plan.planHours],
  );

  const hasSetpoints = data.some(
    (row) => row.spGjeldende != null || row.spScoped != null,
  );

  const yDomain = useMemo(() => {
    const values = data.flatMap((row) =>
      [row.spGjeldende, row.spScoped].filter(
        (v): v is number => v != null && Number.isFinite(v),
      ),
    );
    if (values.length === 0) return undefined;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(0.5, (max - min) * 0.08);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [data]);

  if (!recharts || data.length === 0) return <ControlChartSkeleton />;

  if (!hasSetpoints) {
    return (
      <div className="flex h-[min(240px,40vh)] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center text-sm text-muted-foreground">
        <p>Ingen settpunkt i planen — mangler SD-historikk for typisk profil.</p>
        <p className="text-xs">Kjør sync-infraspawn og utvid lookback.</p>
      </div>
    );
  }

  const { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{
        spGjeldende: { label: `${CONTROL_DISPLAY.predicted.short} (mal)`, color: "var(--chart-1)" },
        spScoped: { label: `${CONTROL_DISPLAY.simulatedControl.short} (plan)`, color: "var(--primary)" },
      }}
      className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
    >
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="label" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={36}
          unit="°C"
          domain={yDomain}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        {data[0] ? (
          <ReferenceLine
            x={data[0]!.label}
            stroke="var(--border)"
            strokeDasharray="4 4"
            label={{
              value: "Nå",
              position: "insideTopLeft",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey="spGjeldende"
          name="spGjeldende"
          stroke="var(--color-spGjeldende)"
          strokeWidth={1.5}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="spScoped"
          name="spScoped"
          stroke="var(--color-spScoped)"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function SdAnleggControlPlanTimelineChart({
  historicalPoints,
  forwardPlan,
}: {
  historicalPoints: Array<{
    hour: string;
    gjeldende: number | null;
    scoped: number | null;
  }>;
  forwardPlan: ControlForwardPlan | null;
}) {
  const recharts = useRechartsModules();
  const data = useMemo(() => {
    const historical = historicalPoints.map((p) => ({
      label: formatControlHourLabel(p.hour),
      phase: "historisk" as const,
      spGjeldende: p.gjeldende,
      spScoped: p.scoped,
    }));
    const forward =
      forwardPlan?.planHours.map((h) => ({
        label: formatControlHourLabel(h.hour),
        phase: "plan" as const,
        spGjeldende: h.gjeldendeProfile?.supplySetpointC ?? null,
        spScoped: h.scopedProfile?.supplySetpointC ?? null,
      })) ?? [];
    return [...historical, ...forward];
  }, [historicalPoints, forwardPlan]);

  const hasData = data.some(
    (row) => row.spGjeldende != null || row.spScoped != null,
  );

  const yDomain = useMemo(() => {
    const values = data.flatMap((row) =>
      [row.spGjeldende, row.spScoped].filter(
        (v): v is number => v != null && Number.isFinite(v),
      ),
    );
    if (values.length === 0) return undefined;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(0.5, (max - min) * 0.08);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [data]);

  const boundaryLabel = useMemo(() => {
    if (historicalPoints.length === 0 || !forwardPlan?.planHours.length) {
      return null;
    }
    return formatControlHourLabel(forwardPlan.planHours[0]!.hour);
  }, [historicalPoints.length, forwardPlan]);

  if (!recharts || !hasData) return <ControlChartSkeleton />;

  const { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } = recharts;

  return (
    <ChartContainer
      config={{
        spGjeldende: { label: CONTROL_DISPLAY.observed.short, color: "var(--chart-1)" },
        spScoped: { label: CONTROL_DISPLAY.simulatedControl.short, color: "var(--primary)" },
      }}
      className={cn("aspect-auto h-[min(280px,45vh)] w-full")}
    >
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis
          dataKey="label"
          fontSize={9}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={32}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={36}
          unit="°C"
          domain={yDomain}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        {boundaryLabel ? (
          <ReferenceLine
            x={boundaryLabel}
            stroke="var(--border)"
            strokeDasharray="4 4"
            label={{
              value: "Plan →",
              position: "insideTopLeft",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey="spGjeldende"
          name="spGjeldende"
          stroke="var(--color-spGjeldende)"
          strokeWidth={1.5}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="spScoped"
          name="spScoped"
          stroke="var(--color-spScoped)"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 4"
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
