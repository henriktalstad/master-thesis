"use client";

import { ArrowUpDown } from "lucide-react";
import type { ResolvedSdAnleggSiteProfile, SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";
import { resolveAlarmDisplayForEvent } from "@/lib/infraspawn/resolve-alarm-display-for-event";
import { resolveInfraspawnPointDisplayStatus } from "@/lib/infraspawn/point-status";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { SD_ANLEGG_LIVE_POLL_MS } from "@/lib/infraspawn/live-display-policy";
import { useSdAnleggPoints } from "@/queries/infraspawn";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SdAnleggPointChart } from "./sd-anlegg-point-chart";
import { useSdAnleggOpenAlarm } from "./sd-anlegg-alarm-modal";
import { SdAnleggKeyPointValue } from "./sd-anlegg-key-point-value";
import { SdAnleggOverviewLiveStatus } from "./sd-anlegg-overview-live-status";
import { SdAnleggOverviewWidget } from "./sd-anlegg-overview-widget";
import { SdAnleggOverviewWidgetSkeleton } from "./sd-anlegg-overview-widget-skeleton";
import { useSdAnleggPointSeries } from "./use-sd-anlegg-point-series";
import { sdAnleggChartFallbackFootnote } from "@/lib/sd-anlegg/chart-fallback-samples";
import {
  SD_ANLEGG_BTN_PRESS,
  SD_ANLEGG_STATUS_ATTENTION_BADGE,
  SD_ANLEGG_STATUS_FAULT_BADGE,
  SD_ANLEGG_STATUS_OK_DOT,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  profile: ResolvedSdAnleggSiteProfile;
  featuredPointRefs: readonly SdAnleggFeaturedPointRef[];
  pointDisplayOverrides: readonly SdAnleggFeaturedPointRef[];
};

export function SdAnleggFeaturedPointCard({
  buildingSlug,
  profile,
  featuredPointRefs,
  pointDisplayOverrides,
}: Props) {
  const featured = featuredPointRefs[0]!;
  const fromProfile = profile.featuredPointRefs.some(
    (ref) =>
      ref.sourceId === featured.sourceId && ref.objectId === featured.objectId,
  );

  const { data: points, isPending, isFetching } = useSdAnleggPoints(buildingSlug, {
    staleTime: SD_ANLEGG_LIVE_POLL_MS,
    refetchInterval: SD_ANLEGG_LIVE_POLL_MS,
  });
  const isRefetching = isFetching && !isPending;

  const point =
    points?.find(
      (entry) =>
        entry.sourceId === featured.sourceId &&
        entry.objectId === featured.objectId,
    ) ?? null;

  return (
    <SdAnleggOverviewWidget
      title={featured.label}
      titleId="sd-anlegg-featured-title"
      isRefreshing={isRefetching}
      subtitle={
        fromProfile
          ? "Utvalgt signal fra anleggsprofil"
          : "Utvalgt signal fra anlegget"
      }
      icon={ArrowUpDown}
    >
      {isPending ? (
        <SdAnleggOverviewWidgetSkeleton />
      ) : !point ? (
        <p className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-4 text-sm text-muted-foreground">
          Fant ikke signalet {featured.objectId}.
        </p>
      ) : (
        <FeaturedPointBody
          buildingSlug={buildingSlug}
          featuredLabel={featured.label}
          featuredPointRefs={featuredPointRefs}
          pointDisplayOverrides={pointDisplayOverrides}
          point={point}
        />
      )}
    </SdAnleggOverviewWidget>
  );
}

function FeaturedPointBody({
  buildingSlug,
  featuredLabel,
  featuredPointRefs,
  pointDisplayOverrides,
  point,
}: {
  buildingSlug: string;
  featuredLabel: string;
  featuredPointRefs: readonly SdAnleggFeaturedPointRef[];
  pointDisplayOverrides: readonly SdAnleggFeaturedPointRef[];
  point: InfraspawnPointListItem;
}) {
  const { openAlarmAction } = useSdAnleggOpenAlarm();
  const status = resolveInfraspawnPointDisplayStatus(point);
  const display = resolveAlarmDisplayForEvent(
    {
      sourceId: point.sourceId,
      objectId: point.objectId,
      alarmText: "",
      objectName: point.objectName,
      description: point.description,
    },
    {
      featuredPointRefs,
      pointDisplayOverrides,
    },
  );

  const { chartSeries, chartHours, chartFallbackSource, isPending: chartPending } =
    useSdAnleggPointSeries({
      buildingSlug,
      point,
      seriesLabel: featuredLabel,
    });

  const chartFootnote = sdAnleggChartFallbackFootnote(chartFallbackSource);

  const content = (
    <div className="mt-3 space-y-3">
      <div className="flex flex-col items-center justify-center gap-2 py-1 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {display.equipmentRef ?? display.signalLabel}
        </p>
        <SdAnleggKeyPointValue point={point} variant="kpi" />
        {status === "alarm" ? (
          <Badge className={SD_ANLEGG_STATUS_ATTENTION_BADGE}>Alarm</Badge>
        ) : status === "fault" ? (
          <Badge variant="outline" className={SD_ANLEGG_STATUS_FAULT_BADGE}>
            Feil
          </Badge>
        ) : (
          <span className={SD_ANLEGG_STATUS_OK_DOT} aria-label="Normal" />
        )}
      </div>
      {chartPending ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : (
        <SdAnleggPointChart
          series={chartSeries}
          hours={chartHours}
          compact
          footnote={chartFootnote}
        />
      )}
      <SdAnleggOverviewLiveStatus sampledAt={point.lastSampledAt} />
    </div>
  );

  if (status === "alarm") {
    return (
      <button
        type="button"
        className={cn(
          "w-full text-left",
          SD_ANLEGG_BTN_PRESS,
          "[@media(hover:hover)_and_(pointer:fine)]:hover:opacity-95",
        )}
        onClick={() => openAlarmAction(point.sourceId, point.objectId)}
      >
        {content}
      </button>
    );
  }

  return content;
}
