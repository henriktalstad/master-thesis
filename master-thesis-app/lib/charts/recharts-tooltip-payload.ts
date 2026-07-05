import type { ReactNode } from "react";

export type ChartTooltipPayloadEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | null;
  color?: string;
  payload?: Record<string, unknown>;
};

export type ChartTooltipLabelFormatter = (
  value: unknown,
  payload: ChartTooltipPayloadEntry[],
) => ReactNode;

export type ChartTooltipValueFormatter = (
  value: number,
  name: string,
  item: ChartTooltipPayloadEntry,
  index: number,
  payload: ChartTooltipPayloadEntry["payload"],
) => ReactNode;

export function asChartTooltipPayloadEntry(
  entry: unknown,
): ChartTooltipPayloadEntry {
  return entry as ChartTooltipPayloadEntry;
}
