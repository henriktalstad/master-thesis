"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  LabelList,
} from "recharts";
import { Spinner } from "@/components/ui/spinner";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PERIOD_LABELS } from "@/types/periods";

type DualPoint = {
  month: string;
  current: number;
  previous: number;
  currentYear?: number;
  previousYear?: number;
  labelLong?: string;
};
type SinglePoint = {
  month: string;
  value: number;
  year?: number;
  labelLong?: string;
};

type UnifiedProps = {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  height?: number; // px
  // Hvis begge finnes → render to serier, ellers enkel serie
  dual?: DualPoint[];
  single?: SinglePoint[];
  currentLabel?: string;
  previousLabel?: string;
  singleLabel?: string;
  trendPct?: number | null;
  energyType?: "HEAT" | "ELECTRICITY";
};

export function ChartBarMultiple({
  title = "",
  subtitle = "",
  loading,
  error,
  height = 260,
  dual,
  single,
  currentLabel = PERIOD_LABELS.year,
  previousLabel = "Forrige 12 mnd",
  singleLabel = PERIOD_LABELS.year,
  trendPct = null,
  energyType,
}: UnifiedProps) {
  const hasDual = Array.isArray(dual) && dual.length > 0;
  const hasSingle = Array.isArray(single) && single.length > 0;

  // Fargeoppsett i tråd med globals.css
  const primaryColor =
    energyType === "ELECTRICITY" ? "var(--chart-1)" : "var(--chart-4)";
  const compareColor = "var(--chart-2)";

  const chartConfig: ChartConfig = hasDual
    ? {
        current: { label: currentLabel, color: primaryColor },
        previous: { label: previousLabel, color: compareColor },
      }
    : {
        value: { label: singleLabel, color: primaryColor },
      };

  const empty = !loading && !error && !hasDual && !hasSingle;

  return (
    <div className="w-full h-full flex flex-col">
      {title ||
      subtitle ||
      (trendPct != null && Number.isFinite(Number(trendPct))) ? (
        <div className="flex items-center justify-between pb-2">
          <div className="flex flex-col gap-1">
            {title ? <h3 className="text-sm font-medium">{title}</h3> : null}
            {subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {trendPct != null && Number.isFinite(Number(trendPct)) && (
            <div
              className={`text-xs font-medium ${Number(trendPct) >= 0 ? "text-warning" : "text-success"}`}
              aria-label="trend"
              title="Årlig endring, rullerende 12 måneder"
            >
              {Number(trendPct) >= 0 ? "▲" : "▼"}{" "}
              {Math.abs(Number(trendPct)).toFixed(1)}%
            </div>
          )}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center h-[250px]">
          <Spinner variant="ring" className="text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-[250px] text-xs text-destructive">
          {error}
        </div>
      ) : hasDual ? (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <ChartContainer
            config={chartConfig}
            className={`w-full`}
            style={{ height }}
          >
            <BarChart
              accessibilityLayer
              data={dual}
              margin={{ top: 10, right: 16, left: 12, bottom: 30 }}
              barCategoryGap="20%"
              barGap={8}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--chart-grid)"
                strokeOpacity={0.6}
              />
              <YAxis
                width={64}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString("nb-NO")}
                domain={[
                  0,
                  (dataMax: number) => Math.ceil((dataMax || 0) * 1.1),
                ]}
                allowDecimals={false}
                tickCount={6}
                tickSize={0}
                tickMargin={6}
                padding={{ top: 8, bottom: 0 }}
                label={{
                  value: "kWh",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--muted-foreground)", fontSize: 12 },
                }}
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={14}
                axisLine={false}
                minTickGap={24}
                interval={0}
                padding={{ left: 10, right: 10 }}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--chart-grid)", strokeDasharray: "3 3" }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    className="bg-popover text-popover-foreground border"
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as DualPoint | undefined;
                      const long = row?.labelLong;
                      const s = (long || label || "").toString().trim();
                      return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
                    }}
                    formatter={(value, name, item) => {
                      const v =
                        value == null || Number.isNaN(Number(value))
                          ? 0
                          : Number(value);
                      const formatted = `${v.toLocaleString("nb-NO")} kWh`;
                      const row = item?.payload as DualPoint | undefined;
                      const year =
                        name === "current" ? row?.currentYear : row?.previousYear;
                      return [
                        formatted,
                        typeof year === "number" ? String(year) : "",
                      ];
                    }}
                  />
                }
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Bar dataKey="current" fill="var(--color-current)" radius={4}>
                <LabelList
                  dataKey="current"
                  position="top"
                  offset={6}
                  className="text-[10px] fill-muted-foreground"
                  formatter={(v) =>
                    typeof v === "number" && v > 0 ? v.toLocaleString("nb-NO") : ""
                  }
                />
              </Bar>
              <Bar dataKey="previous" fill="var(--color-previous)" radius={4}>
                <LabelList
                  dataKey="previous"
                  position="top"
                  offset={6}
                  className="text-[10px] fill-muted-foreground"
                  formatter={(v) =>
                    typeof v === "number" && v > 0 ? v.toLocaleString("nb-NO") : ""
                  }
                />
              </Bar>
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                height={24}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">
                    {value === "current"
                      ? "siste 12 mnd"
                      : value === "previous"
                        ? "forrige 12 mnd"
                        : value}
                  </span>
                )}
              />
            </BarChart>
          </ChartContainer>
        </div>
      ) : hasSingle ? (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <ChartContainer
            config={chartConfig}
            className={`w-full`}
            style={{ height }}
          >
            <BarChart
              accessibilityLayer
              data={single}
              margin={{ top: 10, right: 16, left: 12, bottom: 30 }}
              barCategoryGap="20%"
              barGap={8}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--chart-grid)"
                strokeOpacity={0.6}
              />
              <YAxis
                width={64}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString("nb-NO")}
                domain={[
                  0,
                  (dataMax: number) => Math.ceil((dataMax || 0) * 1.1),
                ]}
                allowDecimals={false}
                tickCount={6}
                tickSize={0}
                tickMargin={6}
                padding={{ top: 8, bottom: 0 }}
                label={{
                  value: "kWh",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--muted-foreground)", fontSize: 12 },
                }}
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={14}
                axisLine={false}
                minTickGap={24}
                interval={0}
                padding={{ left: 10, right: 10 }}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--chart-grid)", strokeDasharray: "3 3" }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="bg-popover text-popover-foreground border"
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as SinglePoint | undefined;
                      const long = row?.labelLong;
                      const s = (long || label || "").toString().trim();
                      return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
                    }}
                    formatter={(value, _name, item) => {
                      const v =
                        value == null || Number.isNaN(Number(value))
                          ? 0
                          : Number(value);
                      const row = item?.payload as SinglePoint | undefined;
                      const year = row?.year;
                      return [
                        `${v.toLocaleString("nb-NO")} kWh`,
                        year ? String(year) : "",
                      ];
                    }}
                  />
                }
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Bar dataKey="value" fill="var(--color-value)" radius={6}>
                <LabelList
                  dataKey="value"
                  position="top"
                  offset={6}
                  className="text-[10px] fill-muted-foreground"
                  formatter={(v) =>
                    typeof v === "number" && v > 0 ? v.toLocaleString("nb-NO") : ""
                  }
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      ) : empty ? (
        <div className="flex items-center justify-center h-[250px] text-xs text-muted-foreground">
          Ingen data for valgt periode.
        </div>
      ) : (
        <div className="flex items-center justify-center h-[250px] text-xs text-muted-foreground">
          —
        </div>
      )}
    </div>
  );
}
