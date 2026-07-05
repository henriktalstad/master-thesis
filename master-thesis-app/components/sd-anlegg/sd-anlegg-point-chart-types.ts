export type SdAnleggPointChartMarker = {
  timestamp: string;
  label?: string;
  color?: string;
};

export type SdAnleggPointChartReferenceValue = {
  value: number;
  label: string;
  color?: string;
};

import type { SdAnleggChartSeries } from "./sd-anlegg-chart-data";

export type SdAnleggPointChartProps = {
  series: SdAnleggChartSeries[];
  hours: number;
  compact?: boolean;
  markers?: readonly SdAnleggPointChartMarker[];
  referenceValues?: readonly SdAnleggPointChartReferenceValue[];
  footnote?: string | null;
};

export const EMPTY_CHART_MARKERS: readonly SdAnleggPointChartMarker[] = [];
export const EMPTY_CHART_REFERENCE_VALUES: readonly SdAnleggPointChartReferenceValue[] =
  [];
