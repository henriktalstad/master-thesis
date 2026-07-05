"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SearchParamsProvider, useAppSearchParams } from "@/contexts/search-params-context";
import type { InfraspawnBuildingNavItem } from "@/lib/infraspawn/building-nav-items";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import type {
  InfraspawnBuildingPageData,
  InfraspawnPointListItem,
} from "@/lib/infraspawn/types";
import { parseSdAnleggPathname } from "@/lib/sd-anlegg/anleggsenhet-routes";
import { isExaminerDemoMode } from "@/lib/sd-anlegg/control/parse-examiner-demo-mode";
import { SdAnleggAlarmBellWithQuery } from "./sd-anlegg-alarm-bell";
import { SdAnleggAlarmModalHost } from "./sd-anlegg-alarm-modal";
import { SdAnleggBuildingHeader } from "./sd-anlegg-building-header";
import { SdAnleggBuildingNav } from "./sd-anlegg-building-nav";
import { SdAnleggLivePointsProvider } from "./sd-anlegg-live-points-context";
import { SdAnleggSyncInvalidationHost } from "./sd-anlegg-sync-invalidation-host";
import { SdAnleggSiteProfileProvider } from "./sd-anlegg-site-profile-context";
import { useSdAnleggEffectivePointMapping } from "./use-sd-anlegg-effective-point-mapping";

const EMPTY_BUILDING_NAV: readonly InfraspawnBuildingNavItem[] = [];

function SdAnleggAlarmModalMappingHost({
  buildingSlug,
  children,
}: {
  buildingSlug: string;
  children: ReactNode;
}) {
  const { featuredPointRefs, pointDisplayOverrides } =
    useSdAnleggEffectivePointMapping(buildingSlug);

  return (
    <SdAnleggAlarmModalHost
      buildingSlug={buildingSlug}
      featuredPointRefs={featuredPointRefs}
      pointDisplayOverrides={pointDisplayOverrides}
    >
      {children}
    </SdAnleggAlarmModalHost>
  );
}

function SdAnleggBuildingShellBody({
  pageData,
  profile,
  initialPoints,
  buildingNav,
  canEditProfile,
  children,
}: {
  pageData: InfraspawnBuildingPageData;
  profile: ResolvedSdAnleggSiteProfile;
  initialPoints: readonly InfraspawnPointListItem[];
  buildingNav: readonly InfraspawnBuildingNavItem[];
  canEditProfile: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useAppSearchParams();
  const isOverviewRoute =
    parseSdAnleggPathname(pathname).segment === "oversikt";
  const examinerMode = isExaminerDemoMode(searchParams.get("demo") ?? undefined);
  const effectiveCanEdit = canEditProfile && !examinerMode;

  return (
    <SdAnleggSiteProfileProvider profile={profile} canEditProfile={effectiveCanEdit}>
      <SdAnleggLivePointsProvider initialPoints={initialPoints}>
        <SdAnleggSyncInvalidationHost buildingSlug={pageData.buildingSlug} />
        <SdAnleggAlarmModalMappingHost buildingSlug={pageData.buildingSlug}>
          <div className="space-y-5">
            <SdAnleggBuildingHeader
              pageData={pageData}
              profile={profile}
              buildingNav={buildingNav}
              canEditProfile={effectiveCanEdit}
              trailingSlot={
                <SdAnleggAlarmBellWithQuery
                  buildingSlug={pageData.buildingSlug}
                  poll={!isOverviewRoute}
                  enabled={!isOverviewRoute}
                />
              }
            />
            <SdAnleggBuildingNav
              buildingSlug={pageData.buildingSlug}
              pageData={pageData}
              canEditProfile={effectiveCanEdit}
            />
            {children}
          </div>
        </SdAnleggAlarmModalMappingHost>
      </SdAnleggLivePointsProvider>
    </SdAnleggSiteProfileProvider>
  );
}

export type SdAnleggBuildingShellProps = {
  pageData: InfraspawnBuildingPageData;
  profile: ResolvedSdAnleggSiteProfile;
  initialPoints: readonly InfraspawnPointListItem[];
  buildingNav?: readonly InfraspawnBuildingNavItem[];
  canEditProfile?: boolean;
  children: ReactNode;
};

export function SdAnleggBuildingShell({
  pageData,
  profile,
  initialPoints,
  buildingNav = EMPTY_BUILDING_NAV,
  canEditProfile = false,
  children,
}: SdAnleggBuildingShellProps) {
  return (
    <SearchParamsProvider label="Laster SD-anlegg …" fallback={null}>
      <SdAnleggBuildingShellBody
        pageData={pageData}
        profile={profile}
        initialPoints={initialPoints}
        buildingNav={buildingNav}
        canEditProfile={canEditProfile}
      >
        {children}
      </SdAnleggBuildingShellBody>
    </SearchParamsProvider>
  );
}
