"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getInfraspawnChartSeriesBatchAction } from "@/actions/infraspawn-read";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  SD_ANLEGG_CHART_POLL_MS,
  type SdAnleggChartRangeHours,
} from "@/lib/infraspawn/sd-anlegg-chart-policy";
import { sdAnleggQueryKeys } from "@/queries/infraspawn";
import { appendLiveSamplesToChartSeries } from "@/lib/sd-anlegg/append-live-chart-sample";
import {
  buildSdAnleggChartSeries,
  formatSdAnleggDataCoverage,
} from "./sd-anlegg-chart-data";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";

type Input = {
  buildingSlug: string;
  selectedPoints: InfraspawnPointListItem[];
  chartHours: SdAnleggChartRangeHours;
};

export function useSdAnleggWorkspaceChart({
  buildingSlug,
  selectedPoints,
  chartHours,
}: Input) {
  const chartPointsKey = useMemo(
    () => selectedPoints.map((point) => sdAnleggPointKey(point)).join("|"),
    [selectedPoints],
  );

  const {
    data: seriesData,
    isPending: seriesIsPending,
    isFetching: seriesIsFetching,
    error: seriesErrorRaw,
  } = useQuery({
    queryKey: sdAnleggQueryKeys.seriesBatch(
      buildingSlug,
      chartPointsKey,
      chartHours,
    ),
    queryFn: async () => {
      const res = await getInfraspawnChartSeriesBatchAction({
        buildingSlug,
        points: selectedPoints.map((point) => ({
          sourceId: point.sourceId,
          objectId: point.objectId,
        })),
        hours: chartHours,
      });
      if (!res.success) throw new Error(res.error ?? "Kunne ikke laste graf");
      return res.series;
    },
    enabled: selectedPoints.length > 0,
    staleTime: SD_ANLEGG_CHART_POLL_MS,
    refetchInterval: SD_ANLEGG_CHART_POLL_MS,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });

  const chartSeries = useMemo(() => {
    const built = buildSdAnleggChartSeries(selectedPoints, seriesData ?? []);
    const liveByKey = new Map(
      selectedPoints.map((point) => [
        sdAnleggPointKey(point),
        {
          lastValue: point.lastValue,
          lastSampledAt: point.lastSampledAt,
        },
      ]),
    );
    return appendLiveSamplesToChartSeries(built, liveByKey);
  }, [selectedPoints, seriesData]);

  const dataCoverage = useMemo(
    () => formatSdAnleggDataCoverage(chartSeries, chartHours),
    [chartSeries, chartHours],
  );

  const seriesLoading =
    selectedPoints.length > 0 &&
    ((seriesIsPending && !seriesData) ||
      (seriesIsFetching && chartSeries.length === 0));

  return {
    chartSeries,
    dataCoverage,
    seriesLoading,
    seriesError:
      seriesErrorRaw instanceof Error
        ? seriesErrorRaw
        : seriesErrorRaw != null
          ? new Error("Kunne ikke laste graf")
          : null,
    seriesFetching: seriesIsFetching,
  };
}
