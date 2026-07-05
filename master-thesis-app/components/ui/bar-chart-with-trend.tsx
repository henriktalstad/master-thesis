"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PERIOD_LABELS } from "@/types/periods";

type Point = { month: string; value: number };

export function ChartBarDefault({
  title = "",
  subtitle = "",
  data,
  label = PERIOD_LABELS.year,
  colorVar = "var(--chart-4)",
}: {
  title?: string;
  subtitle?: string;
  data: Point[];
  label?: string;
  colorVar?: string;
}) {
  const chartConfig: ChartConfig = {
    value: { label, color: colorVar },
  };

  return (
    <div className="w-full h-full flex flex-col">
      {title || subtitle ? (
        <div className="flex flex-col gap-1 pb-2">
          {title ? <h3 className="text-sm font-medium">{title}</h3> : null}
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="value" fill="var(--color-value)" radius={8} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
