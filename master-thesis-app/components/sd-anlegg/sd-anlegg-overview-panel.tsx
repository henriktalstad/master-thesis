"use client";

import type { ReactNode } from "react";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import type { InfraspawnBuildingPageData } from "@/lib/infraspawn/types";
import { formatSdAnleggAnleggsnavnLine } from "@/lib/sd-anlegg/format-anleggsnavn-line";
import { mergeLiveHealthSummary } from "@/lib/sd-anlegg/measurement-timestamps";
import { sumTodayAlarmEventCounts } from "@/lib/infraspawn/alarm-overview";
import { resolveInfraspawnSourceSyncIssues } from "@/lib/infraspawn/resolve-source-sync-issues";
import { useSdAnleggOverviewAlarms } from "@/queries/infraspawn";
import { SdAnleggAlarmStatsCard } from "./sd-anlegg-alarm-stats-card";
import { SdAnleggDomainShortcuts } from "./sd-anlegg-domain-shortcuts";
import { SdAnleggFeaturedPointCard } from "./sd-anlegg-featured-point-card";
import { SdAnleggHealthSummary } from "./sd-anlegg-health-summary";
import { SdAnleggOverviewAlarmsCard } from "./sd-anlegg-overview-alarms-card";
import { SdAnleggOverviewKeyPointsCard } from "./sd-anlegg-overview-key-points-card";
import { SdAnleggSiteHero } from "./sd-anlegg-site-hero";
import { SdAnleggSyncStatusBanner } from "./sd-anlegg-sync-status-banner";
import { useSdAnleggEffectivePointMapping } from "./use-sd-anlegg-effective-point-mapping";
import { useSdAnleggLiveOverview } from "./use-sd-anlegg-live-overview";

type Props = {
  pageData: InfraspawnBuildingPageData;
  profile: ResolvedSdAnleggSiteProfile;
  canEditProfile?: boolean;
  /** Server-komponent i Suspense — streamer MPC/styring-KPI uten å blokkere siden. */
  controlOpsSlot?: ReactNode;
};

export function SdAnleggOverviewPanel({
  pageData,
  profile,
  canEditProfile = false,
  controlOpsSlot = null,
}: Props) {
  const hasFeaturedPoint = profile.featuredPointRefs.length > 0;
  const pointMapping = useSdAnleggEffectivePointMapping(pageData.buildingSlug);
  const hasAutoFeaturedPoint = pointMapping.featuredPointRefs.length > 0;
  const overviewAlarms = useSdAnleggOverviewAlarms(pageData.buildingSlug);
  const liveOverview = useSdAnleggLiveOverview(pageData.buildingSlug);

  const liveHealth = mergeLiveHealthSummary(
    pageData.health,
    liveOverview.livePoints,
  );
  const syncIssues = resolveInfraspawnSourceSyncIssues(pageData.sources);
  const todayEventCount = overviewAlarms.data?.summary
    ? sumTodayAlarmEventCounts(overviewAlarms.data.summary.todayCounts)
    : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
      <SdAnleggSiteHero
        profile={profile}
        buildingSlug={pageData.buildingSlug}
        anleggsnavnLine={formatSdAnleggAnleggsnavnLine(pageData.sources)}
        canEdit={canEditProfile}
      />

      <div className="flex flex-col gap-3">
        <SdAnleggSyncStatusBanner issues={syncIssues} />

        <div className="grid gap-3 md:grid-cols-2">
          {controlOpsSlot}
          <SdAnleggOverviewAlarmsCard
            buildingSlug={pageData.buildingSlug}
            overviewData={overviewAlarms.data}
            livePoints={liveOverview.livePoints}
            isPending={overviewAlarms.isPending}
            isError={overviewAlarms.isError}
          />
          <SdAnleggAlarmStatsCard
            buildingSlug={pageData.buildingSlug}
            summary={overviewAlarms.data?.summary}
            isPending={overviewAlarms.isPending}
            isError={overviewAlarms.isError}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SdAnleggOverviewKeyPointsCard
            buildingSlug={pageData.buildingSlug}
            pageData={pageData}
            dashboard={liveOverview.dashboard}
            livePoints={liveOverview.livePoints}
            isPending={liveOverview.isPending}
            isError={liveOverview.isError}
            isRefetching={liveOverview.isRefetching}
          />
          {hasFeaturedPoint || hasAutoFeaturedPoint ? (
            <SdAnleggFeaturedPointCard
              buildingSlug={pageData.buildingSlug}
              profile={profile}
              featuredPointRefs={pointMapping.featuredPointRefs}
              pointDisplayOverrides={pointMapping.pointDisplayOverrides}
            />
          ) : (
            <SdAnleggDomainShortcuts
              buildingSlug={pageData.buildingSlug}
              pageData={pageData}
            />
          )}
        </div>

        <SdAnleggHealthSummary
          health={liveHealth}
          variant="compact"
          isFetching={liveOverview.isRefetching}
          todayEventCount={todayEventCount}
        />

        {hasFeaturedPoint || hasAutoFeaturedPoint ? (
          <SdAnleggDomainShortcuts
            buildingSlug={pageData.buildingSlug}
            pageData={pageData}
            compact
          />
        ) : null}
      </div>
    </div>
  );
}
