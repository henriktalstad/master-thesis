"use client";

import { useMemo } from "react";
import { getInfraspawnChartSeriesBatchAction } from "@/actions/infraspawn-read";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildInfraspawnPointStub } from "@/lib/infraspawn/build-infraspawn-point-stub";
import {
  SD_ANLEGG_CHART_POLL_MS,
  type SdAnleggChartRangeHours,
} from "@/lib/infraspawn/sd-anlegg-chart-policy";
import { sdAnleggQueryKeys } from "@/queries/infraspawn";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  buildSdAnleggChartLiveFallbackSamples,
  type SdAnleggChartFallbackSource,
} from "@/lib/sd-anlegg/chart-fallback-samples";
import { appendLiveSamplesToChartSeries } from "@/lib/sd-anlegg/append-live-chart-sample";
import { buildSdAnleggChartSeries } from "./sd-anlegg-chart-data";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";

type Input = {
  buildingSlug: string;
  point: Pick<
    InfraspawnPointListItem,
    | "sourceId"
    | "objectId"
    | "objectName"
    | "sourceLabel"
    | "unit"
    | "lastValue"
    | "lastSampledAt"
    | "valueSource"
  >;
  chartHours?: SdAnleggChartRangeHours;
  seriesLabel?: string | null;
  enabled?: boolean;
};

export function useSdAnleggPointSeries({
  buildingSlug,
  point,
  chartHours = 24,
  seriesLabel = null,
  enabled = true,
}: Input) {
  const chartPoint: InfraspawnPointListItem = useMemo(
    () =>
      buildInfraspawnPointStub({
        sourceId: point.sourceId,
        sourceLabel: point.sourceLabel,
        objectId: point.objectId,
        objectName: point.objectName ?? null,
        unit: point.unit,
        lastValue: point.lastValue,
        lastSampledAt: point.lastSampledAt,
        valueSource: point.valueSource,
      }),
    [point],
  );

  const chartPointsKey = sdAnleggPointKey(chartPoint);

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: sdAnleggQueryKeys.seriesBatch(
      buildingSlug,
      chartPointsKey,
      chartHours,
    ),
    queryFn: async () => {
      const res = await getInfraspawnChartSeriesBatchAction({
        buildingSlug,
        points: [{ sourceId: chartPoint.sourceId, objectId: chartPoint.objectId }],
        hours: chartHours,
      });
      if (!res.success) throw new Error(res.error ?? "Kunne ikke laste graf");
      return res.series;
    },
    staleTime: SD_ANLEGG_CHART_POLL_MS,
    placeholderData: keepPreviousData,
    enabled,
  });

  const { chartSeries, chartFallbackSource } = useMemo(() => {
    const built = buildSdAnleggChartSeries([chartPoint], data ?? []);
    let series = built;
    let fallbackSource: SdAnleggChartFallbackSource | null = null;

    if (!built.some((entry) => entry.samples.length > 0)) {
      const fallback = buildSdAnleggChartLiveFallbackSamples({
        lastValue: chartPoint.lastValue,
        lastSampledAt: chartPoint.lastSampledAt,
      });
      if (fallback.samples.length > 0) {
        fallbackSource = fallback.source;
        series = built.map((entry) => ({
          ...entry,
          samples: fallback.samples,
        }));
      }
    }

    const label = seriesLabel?.trim();
    if (label) {
      series = series.map((entry) => ({ ...entry, label }));
    }

    series = appendLiveSamplesToChartSeries(
      series,
      new Map([
        [
          chartPointsKey,
          {
            lastValue: chartPoint.lastValue,
            lastSampledAt: chartPoint.lastSampledAt,
          },
        ],
      ]),
    );

    return { chartSeries: series, chartFallbackSource: fallbackSource };
  }, [chartPoint, chartPointsKey, data, seriesLabel]);

  return {
    chartSeries,
    chartFallbackSource,
    chartHours,
    isPending,
    isFetching,
    error,
  };
}
