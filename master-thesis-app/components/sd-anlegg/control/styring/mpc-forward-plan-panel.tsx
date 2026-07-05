"use client";

import { useMemo, useState } from "react";
import { useRechartsModules } from "@/components/charts/use-recharts-modules";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import type { MpcForwardPlan } from "@/lib/sd-anlegg/control/control-types";
import {
  CONTROL_DISPLAY,
  CONTROL_STYRING_FORWARD,
} from "@/lib/sd-anlegg/control/control-display-labels";
import {
  MPC_FORWARD_SIGNAL_SPECS,
  SdAnleggControlMpcForwardSignalsChart,
} from "@/components/sd-anlegg/control/charts/mpc-charts";
import { SdAnleggControlChartCard } from "@/components/sd-anlegg/control/shared/chart-card";
import { ControlChartSkeleton } from "@/components/sd-anlegg/control/shared/chart-shared";
import {
  CONTROL_CHART_HEIGHT,
  formatControlTimeLabel,
} from "@/lib/sd-anlegg/control/chart-utils";
import {
  SD_ANLEGG_INFO_BANNER,
  SD_ANLEGG_KPI_CARD,
  SD_ANLEGG_KPI_VALUE,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  forwardPlan: MpcForwardPlan;
};

function formatKr(value: number): string {
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr`;
}

function formatKwh(value: number): string {
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kWh`;
}

export function SdAnleggControlMpcForwardPlanPanel({ forwardPlan }: Props) {
  const recharts = useRechartsModules();
  const [activeSignal, setActiveSignal] = useState(MPC_FORWARD_SIGNAL_SPECS[0]!.id);
  const effect = forwardPlan.effect;

  const contextData = useMemo(
    () =>
      forwardPlan.planSteps.map((step) => ({
        label: formatControlTimeLabel(
          step.t,
          forwardPlan.stepMinutes === 15 ? 15 : 60,
        ),
        spotKrPerKwh: step.spotKrPerKwh,
        outdoorTempC: step.outdoorTempC,
      })),
    [forwardPlan.planSteps, forwardPlan.stepMinutes],
  );

  if (!recharts) {
    return <ControlChartSkeleton className="h-[280px]" />;
  }

  const { CartesianGrid, Line, LineChart, XAxis, YAxis } = recharts;

  return (
    <div className="space-y-4">
      <p className={cn(SD_ANLEGG_INFO_BANNER, "text-xs leading-relaxed")}>
        {CONTROL_STYRING_FORWARD.intro}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={SD_ANLEGG_KPI_CARD}>
          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            {CONTROL_STYRING_FORWARD.controllableEl}
          </div>
          <p className={cn(SD_ANLEGG_KPI_VALUE, "px-3 pb-2 text-base")}>
            {effect.controllableElectricKwhMpc != null
              ? formatKwh(effect.controllableElectricKwhMpc)
              : "—"}
          </p>
        </div>
        <div className={SD_ANLEGG_KPI_CARD}>
          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            {CONTROL_STYRING_FORWARD.controllableHeat}
          </div>
          <p className={cn(SD_ANLEGG_KPI_VALUE, "px-3 pb-2 text-base")}>
            {effect.controllableHeatKwhMpc != null
              ? formatKwh(effect.controllableHeatKwhMpc)
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className={SD_ANLEGG_KPI_CARD}>
          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            {CONTROL_STYRING_FORWARD.costDiff}
          </div>
          <p className={cn(SD_ANLEGG_KPI_VALUE, "px-3 pb-2 text-base")}>
            {effect.deltaCostPct > 0 ? "+" : ""}
            {effect.deltaCostPct} %
          </p>
        </div>
        <div className={SD_ANLEGG_KPI_CARD}>
          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            {CONTROL_DISPLAY.predicted.chart}
          </div>
          <p className={cn(SD_ANLEGG_KPI_VALUE, "px-3 pb-2 text-base")}>
            {formatKr(effect.totalCostBaselineKr)}
          </p>
        </div>
        <div className={SD_ANLEGG_KPI_CARD}>
          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            {CONTROL_DISPLAY.simulatedControl.opsShort}
          </div>
          <p className={cn(SD_ANLEGG_KPI_VALUE, "px-3 pb-2 text-base")}>
            {formatKr(effect.totalCostMpcKr)}
          </p>
        </div>
        <div className={SD_ANLEGG_KPI_CARD}>
          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            {CONTROL_STYRING_FORWARD.optimizedSteps}
          </div>
          <p className={cn(SD_ANLEGG_KPI_VALUE, "px-3 pb-2 text-base")}>
            {forwardPlan.optimizedSteps}/{forwardPlan.horizonSteps}
            {forwardPlan.fallbackSteps > 0
              ? ` · ${CONTROL_STYRING_FORWARD.fallbackSteps(forwardPlan.fallbackSteps)}`
              : ""}
          </p>
        </div>
      </div>

      <SdAnleggControlChartCard
        title={CONTROL_STYRING_FORWARD.signalsTitle}
        description={`${forwardPlan.dayAheadHourCount} t prisprognose · oppdatert ${forwardPlan.computedAt.slice(0, 16).replace("T", " ")}`}
      >
        <Tabs value={activeSignal} onValueChange={setActiveSignal}>
          <TabsList className="mb-3 h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {MPC_FORWARD_SIGNAL_SPECS.map((spec) => (
              <TabsTrigger
                key={spec.id}
                value={spec.id}
                className="h-8 rounded-lg border border-border/80 px-3 text-xs data-[state=active]:border-primary/40 data-[state=active]:bg-primary/5"
              >
                {spec.tabLabel}
              </TabsTrigger>
            ))}
          </TabsList>
          {MPC_FORWARD_SIGNAL_SPECS.map((spec) => (
            <TabsContent key={spec.id} value={spec.id} className="mt-0">
              <SdAnleggControlMpcForwardSignalsChart
                forwardPlan={forwardPlan}
                activeSignalId={spec.id}
              />
            </TabsContent>
          ))}
        </Tabs>
      </SdAnleggControlChartCard>

      <SdAnleggControlChartCard
        title={CONTROL_STYRING_FORWARD.contextTitle}
        description={CONTROL_STYRING_FORWARD.contextDescription}
      >
        <ChartContainer
          config={{
            spotKrPerKwh: { label: "Spotpris", color: "var(--chart-4)" },
            outdoorTempC: { label: "Utetemp.", color: "var(--chart-2)" },
          }}
          className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
        >
          <LineChart data={contextData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
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
              yAxisId="left"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => `${v}°`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => Number(v).toFixed(2)}
            />
            <ChartTooltip
              content={({ payload, label }) => {
                const row = payload?.[0]?.payload as (typeof contextData)[number] | undefined;
                if (!row) return null;
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                    <p className="font-medium">{label}</p>
                    <p>
                      Spot:{" "}
                      {row.spotKrPerKwh != null ? `${row.spotKrPerKwh} kr/kWh` : "—"}
                    </p>
                    <p>
                      Utetemp:{" "}
                      {row.outdoorTempC != null ? `${row.outdoorTempC} °C` : "—"}
                    </p>
                  </div>
                );
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="outdoorTempC"
              name="outdoorTempC"
              stroke="var(--color-outdoorTempC)"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="spotKrPerKwh"
              name="spotKrPerKwh"
              stroke="var(--color-spotKrPerKwh)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 4"
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </SdAnleggControlChartCard>
    </div>
  );
}
