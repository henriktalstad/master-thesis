"use client";

import { useMemo } from "react";
import { getInfraspawnChartSeriesBatchAction } from "@/actions/infraspawn-read";
import type { InfraspawnAlarmPointGroup } from "@/lib/infraspawn/group-alarm-events";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildInfraspawnPointStub } from "@/lib/infraspawn/build-infraspawn-point-stub";
import {
  SD_ANLEGG_CHART_POLL_MS,
  type SdAnleggChartRangeHours,
} from "@/lib/infraspawn/sd-anlegg-chart-policy";
import { sdAnleggQueryKeys } from "@/queries/infraspawn";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatInfraspawnChartSeriesLabel } from "@/lib/infraspawn/resolve-alarm-display-context";
import {
  buildSdAnleggChartFallbackSamples,
  type SdAnleggChartFallbackSource,
} from "@/lib/sd-anlegg/chart-fallback-samples";
import { appendLiveSamplesToChartSeries } from "@/lib/sd-anlegg/append-live-chart-sample";
import { buildSdAnleggChartSeries } from "./sd-anlegg-chart-data";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";

type Input = {
  buildingSlug: string;
  group: InfraspawnAlarmPointGroup;
  chartHours?: SdAnleggChartRangeHours;
  enabled?: boolean;
  livePoint?: Pick<
    InfraspawnPointListItem,
    "lastValue" | "lastSampledAt" | "valueSource"
  > | null;
};

export function useSdAnleggAlarmChart({
  buildingSlug,
  group,
  chartHours = 24,
  enabled = true,
  livePoint = null,
}: Input) {
  const point: InfraspawnPointListItem = useMemo(
    () =>
      buildInfraspawnPointStub({
        sourceId: group.sourceId,
        objectId: group.objectId,
        unit: group.unit,
        lastValue: livePoint?.lastValue ?? group.currentValue,
        lastSampledAt: livePoint?.lastSampledAt ?? null,
        valueSource: livePoint?.valueSource ?? "postgres-sync",
        statusInAlarm: group.activeEvent != null,
      }),
    [group, livePoint],
  );

  const chartPointsKey = sdAnleggPointKey(point);

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: sdAnleggQueryKeys.seriesBatch(
      buildingSlug,
      chartPointsKey,
      chartHours,
    ),
    queryFn: async () => {
      const res = await getInfraspawnChartSeriesBatchAction({
        buildingSlug,
        points: [{ sourceId: point.sourceId, objectId: point.objectId }],
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
    const built = buildSdAnleggChartSeries([point], data ?? []);
    let series = built;
    let fallbackSource: SdAnleggChartFallbackSource | null = null;

    if (!built.some((entry) => entry.samples.length > 0)) {
      const fallback = buildSdAnleggChartFallbackSamples({
        group,
        lastValue: livePoint?.lastValue ?? group.currentValue,
        lastSampledAt: livePoint?.lastSampledAt ?? point.lastSampledAt,
      });
      if (fallback.samples.length > 0) {
        fallbackSource = fallback.source;
        series = built.map((entry) => ({
          ...entry,
          samples: fallback.samples,
        }));
      }
    }

    const displayLabel = formatInfraspawnChartSeriesLabel({
      signalLabel: group.signalLabel,
      locationLabel: group.locationLabel,
    });
    if (displayLabel.trim()) {
      series = series.map((entry) => ({ ...entry, label: displayLabel }));
    }

    if (livePoint?.lastValue != null) {
      series = appendLiveSamplesToChartSeries(
        series,
        new Map([
          [
            chartPointsKey,
            {
              lastValue: livePoint.lastValue,
              lastSampledAt: livePoint.lastSampledAt,
            },
          ],
        ]),
      );
    }

    return { chartSeries: series, chartFallbackSource: fallbackSource };
  }, [point, data, group, livePoint, chartPointsKey]);

  return {
    chartSeries,
    chartFallbackSource,
    chartHours,
    isPending,
    isFetching,
    error,
  };
}
