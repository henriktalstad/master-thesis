"use client";

import { useMemo, useState } from "react";
import { useRechartsModules } from "@/components/charts/use-recharts-modules";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MpcEnergyReconcileBundle } from "@/lib/sd-anlegg/control/load-mpc-energy-reconcile";
import { CONTROL_DISPLAY } from "@/lib/sd-anlegg/control/control-display-labels";
import { ControlChartSkeleton } from "@/components/sd-anlegg/control/shared/chart-shared";
import {
  CONTROL_CHART_HEIGHT,
  formatControlHourLabel,
  formatKrShort,
} from "@/lib/sd-anlegg/control/chart-utils";
import { cn } from "@/lib/utils";

type Metric = "el" | "heat" | "cost";

type Props = {
  hours: MpcEnergyReconcileBundle["hours"];
};

function formatKwhShort(v: number): string {
  if (Math.abs(v) >= 1000) {
    return `${(v / 1000).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} MWh`;
  }
  return `${v.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kWh`;
}

export function SdAnleggControlEnergyReconcileChart({ hours }: Props) {
  const recharts = useRechartsModules();
  const [metric, setMetric] = useState<Metric>("el");

  const data = useMemo(
    () =>
      hours.map((row) => ({
        label: formatControlHourLabel(row.hour),
        measuredEl: row.measuredElectricityKwh,
        measuredHeat: row.measuredDistrictHeatingKwh,
        measuredCost: row.measuredCostKr,
        emulatedEl: row.proxyEmulatedElKwh,
        mpcEl: row.proxyMpcElKwh,
        emulatedHeat: row.proxyEmulatedHeatKwh,
        mpcHeat: row.proxyMpcHeatKwh,
        emulatedCost: row.proxyEmulatedCostKr,
        mpcCost: row.proxyMpcCostKr,
      })),
    [hours],
  );

  if (!recharts || data.length === 0) {
    return <ControlChartSkeleton className="h-[280px]" />;
  }

  const { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } = recharts;

  const measuredKey =
    metric === "el" ? "measuredEl" : metric === "heat" ? "measuredHeat" : "measuredCost";
  const emulatedKey =
    metric === "el" ? "emulatedEl" : metric === "heat" ? "emulatedHeat" : "emulatedCost";
  const mpcKey = metric === "el" ? "mpcEl" : metric === "heat" ? "mpcHeat" : "mpcCost";

  const unit = metric === "cost" ? "kr" : "kWh";
  const formatLeft = metric === "cost" ? formatKrShort : formatKwhShort;
  const formatRight = metric === "cost" ? formatKrShort : formatKwhShort;

  return (
    <div className="space-y-3">
      <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
        <TabsList className="h-8">
          <TabsTrigger value="el" className="text-xs">
            Elektrisitet
          </TabsTrigger>
          <TabsTrigger value="heat" className="text-xs">
            Fjernvarme
          </TabsTrigger>
          <TabsTrigger value="cost" className="text-xs">
            Kostnad
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <p className="text-[11px] text-muted-foreground">
        Søyler = målt hele bygg (BHCC, kWh/time). Linjer = kontrollerbar proxy
        (kWh/time) — venstre og høyre akse har ulik skala.
      </p>

      <ChartContainer
        config={{
          measured: { label: "Målt bygg", color: "var(--chart-3)" },
          emulated: { label: CONTROL_DISPLAY.predicted.chart, color: "var(--chart-4)" },
          mpc: { label: CONTROL_DISPLAY.simulatedControl.chart, color: "var(--chart-1)" },
        }}
        className={cn("aspect-auto", CONTROL_CHART_HEIGHT)}
      >
        <ComposedChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
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
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatLeft}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={formatRight}
          />
          <ChartTooltip
            content={({ payload, label }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return null;
              const measured = row[measuredKey as keyof typeof row] as number;
              const emulated = row[emulatedKey as keyof typeof row] as number;
              const mpc = row[mpcKey as keyof typeof row] as number;
              const fmt = metric === "cost" ? (v: number) => `${formatKrShort(v)} kr` : formatKwhShort;
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium">{label}</p>
                  <p className="text-muted-foreground">Målt bygg: {fmt(measured)}</p>
                  <p className="text-muted-foreground">
                    {CONTROL_DISPLAY.predicted.chart}: {fmt(emulated)}
                  </p>
                  <p className="text-muted-foreground">
                    {CONTROL_DISPLAY.simulatedControl.chart}: {fmt(mpc)}
                  </p>
                </div>
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            yAxisId="left"
            dataKey={measuredKey}
            name="measured"
            fill="var(--color-measured)"
            opacity={0.35}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={emulatedKey}
            name="emulated"
            stroke="var(--color-emulated)"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={mpcKey}
            name="mpc"
            stroke="var(--color-mpc)"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>

      <p className="text-[11px] text-muted-foreground tabular-nums">
        {data.length} timer · enhet {unit}
      </p>
    </div>
  );
}
