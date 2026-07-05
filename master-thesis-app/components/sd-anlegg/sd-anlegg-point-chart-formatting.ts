import { buildInfraspawnPointStub } from "@/lib/infraspawn/build-infraspawn-point-stub";
import {
  formatPumpCommandValue,
} from "@/lib/sd-anlegg/format-process-slot-display";
import { formatSdAnleggNumericValue } from "@/lib/sd-anlegg/sd-anlegg-display-format";
import { formatSystemairOperatorMsvAxisTick } from "@/lib/sd-anlegg/systemair-msv-labels";
import type { SdAnleggChartSeries } from "./sd-anlegg-chart-data";

export const CHART_AXIS_FONT_SIZE = 12;

export const CHART_AXIS_LABEL_STYLE = {
  fill: "var(--muted-foreground)",
  fontSize: CHART_AXIS_FONT_SIZE,
  fontWeight: 500,
} as const;

export const CHART_Y_AXIS_FORMATTER = {
  format(value: number, unit?: string | null): string {
    return formatSdAnleggNumericValue(value, unit);
  },
};

export function seriesByKey(
  series: SdAnleggChartSeries[],
): Map<string, SdAnleggChartSeries> {
  return new Map(series.map((s) => [s.key, s]));
}

export function binaryAxisTick(value: number): string {
  if (value <= 0.25) return "Av";
  if (value >= 0.75) return "På";
  return "";
}

export function msvAxisTick(
  value: number,
  msvSeries: readonly SdAnleggChartSeries[],
): string {
  const rounded = Math.round(value);

  if (msvSeries.length === 1) {
    const meta = msvSeries[0]!;
    return formatSystemairOperatorMsvAxisTick(rounded, {
      objectId: meta.objectId ?? meta.key,
      objectName: meta.objectName ?? null,
      description: meta.description ?? null,
    });
  }

  for (const meta of msvSeries) {
    const tick = formatSystemairOperatorMsvAxisTick(rounded, {
      objectId: meta.objectId ?? meta.key,
      objectName: meta.objectName ?? null,
      description: meta.description ?? null,
    });
    if (tick !== String(rounded)) return tick;
  }

  for (const meta of msvSeries) {
    const pumpLabel = formatPumpCommandValue(
      buildInfraspawnPointStub({
        sourceId: meta.objectId ?? meta.key,
        objectId: meta.objectId ?? meta.key,
        objectName: meta.objectName ?? null,
        description: meta.description ?? null,
        unit: meta.unit,
        lastValue: rounded,
        quality: "ok",
      }),
    );
    if (pumpLabel && pumpLabel !== "—") return pumpLabel;
  }

  const fallback = msvSeries[0];
  if (!fallback) return String(value);

  return formatSystemairOperatorMsvAxisTick(rounded, {
    objectId: fallback.objectId ?? fallback.key,
    objectName: fallback.objectName ?? null,
    description: fallback.description ?? null,
  });
}

export type SdAnleggPointChartTooltipPayload = ReadonlyArray<{
  dataKey?: string | number;
  value?: number | string | null;
  payload?: { timestamp?: number };
}>;
