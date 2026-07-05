import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggChartRangeHours } from "@/lib/infraspawn/sd-anlegg-chart-policy";
import type { SdAnleggChartSeries } from "../sd-anlegg-chart-data";

export const SCHEMATIC_EMPTY_POINTS: InfraspawnPointListItem[] = [];
export const SCHEMATIC_EMPTY_SELECTED_KEYS: string[] = [];
export const SCHEMATIC_EMPTY_CHART_SERIES: SdAnleggChartSeries[] = [];
export const SCHEMATIC_EMPTY_CHART_RANGE_OPTIONS: ReadonlyArray<{
  hours: SdAnleggChartRangeHours;
  label: string;
}> = [];
