"use client";

import { usePathname } from "next/navigation";
import type { InfraspawnBuildingNavItem } from "@/lib/infraspawn/building-nav-items";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import type { InfraspawnBuildingPageData } from "@/lib/infraspawn/types";
import { inferAnleggsenheterFromPoints } from "@/lib/sd-anlegg/infer-anleggsenheter";
import { parseSdAnleggPathname } from "@/lib/sd-anlegg/anleggsenhet-routes";
import { resolveAnleggsenhetDisplayName } from "@/lib/sd-anlegg/anleggsenhet-display-overrides";
import { resolveSdAnleggLiveDisplaySubtitle } from "@/lib/infraspawn/live-display-status";
import {
  formatInfraspawnPointValue,
} from "@/lib/infraspawn/display-format";
import { resolveHumanInfraspawnPointLabel } from "@/lib/infraspawn/point-vocabulary";
import { useSdAnleggLiveOverview } from "@/components/sd-anlegg/use-sd-anlegg-live-overview";
import { SdAnleggBuildingSwitcher } from "./sd-anlegg-building-switcher";
import { SdAnleggAnleggsenhetNameEditor } from "./sd-anlegg-anleggsenhet-name-editor";
import { type ReactNode } from "react";
import { useTickingNow } from "@/hooks/use-ticking-now";

const EMPTY_BUILDING_NAV: readonly InfraspawnBuildingNavItem[] = [];

type Props = {
  pageData: InfraspawnBuildingPageData;
  profile?: ResolvedSdAnleggSiteProfile;
  buildingNav?: readonly InfraspawnBuildingNavItem[];
  trailingSlot?: ReactNode;
  canEditProfile?: boolean;
};

export function SdAnleggBuildingHeader({
  pageData,
  profile,
  buildingNav = EMPTY_BUILDING_NAV,
  trailingSlot,
  canEditProfile = false,
}: Props) {
  const pathname = usePathname();
  const parsedPath = parseSdAnleggPathname(pathname);
  const isOverviewRoute = parsedPath.segment === "oversikt";
  const activeUnit = parsedPath.unitSlug
    ? pageData.anleggsenheter?.find((unit) => unit.slug === parsedPath.unitSlug)
    : null;
  const activeUnitDisplayName = activeUnit
    ? resolveAnleggsenhetDisplayName(
        activeUnit.id,
        activeUnit.displayName,
        profile?.anleggsenhetDisplayOverrides ?? [],
      )
    : null;

  const { dashboard, livePoints } = useSdAnleggLiveOverview(pageData.buildingSlug);
  const now = useTickingNow(30_000);

  const unitObjectIdsForFreshness =
    activeUnit && livePoints?.length
      ? inferAnleggsenheterFromPoints(livePoints, pageData.sources).units.find(
          (unit) => unit.slug === activeUnit.slug,
        )?.objectIds
      : undefined;

  const domainFreshnessSubtitle =
    now && !isOverviewRoute
      ? resolveSdAnleggLiveDisplaySubtitle({
          livePoints: livePoints ?? [],
          unitObjectIds: unitObjectIdsForFreshness,
          domain: parsedPath.domain ?? null,
          oldestSuccessfulSyncAt: pageData.oldestSuccessfulSyncAt,
          now,
        })
      : null;

  const outdoor = dashboard?.keyPoints.find((card) => card.role === "outdoor_temp");
  const supplyAir = dashboard?.keyPoints.find(
    (card) => card.role === "supply_air_temp",
  );
  const supplyAirLabel =
    (supplyAir ? resolveHumanInfraspawnPointLabel(supplyAir.point) : null) ??
    supplyAir?.label ??
    "Tillufttemperatur";
  const buildingName = profile?.displayTitle ?? pageData.buildingName;
  const showBuildingSwitcher = buildingNav.length > 1;

  const subtitle = [
    activeUnit ? buildingName : null,
    `${pageData.sources.length} ${
      pageData.sources.length === 1 ? "tilkoblet anlegg" : "tilkoblede anlegg"
    }`,
    domainFreshnessSubtitle,
  ]
    .filter(Boolean)
    .join(" · ");

  const staticTitle = activeUnitDisplayName ?? buildingName;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <div>
          {showBuildingSwitcher ? (
            <SdAnleggBuildingSwitcher
              buildings={buildingNav}
              currentSlug={pageData.buildingSlug}
              currentLabel={buildingName}
            />
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {staticTitle}
              </h1>
              {canEditProfile && profile && activeUnit ? (
                <SdAnleggAnleggsenhetNameEditor
                  buildingSlug={pageData.buildingSlug}
                  unit={activeUnit}
                  profile={profile}
                  canEdit={canEditProfile}
                />
              ) : null}
            </div>
          )}
          {showBuildingSwitcher && activeUnitDisplayName ? (
            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {activeUnitDisplayName}
              </h1>
              {canEditProfile && profile && activeUnit ? (
                <SdAnleggAnleggsenhetNameEditor
                  buildingSlug={pageData.buildingSlug}
                  unit={activeUnit}
                  profile={profile}
                  canEdit={canEditProfile}
                />
              ) : null}
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {outdoor ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Utetemperatur: </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatInfraspawnPointValue(
                outdoor.point.lastValue,
                outdoor.point.unit,
                outdoor.point,
              )}
            </span>
          </div>
        ) : null}
        {supplyAir ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{supplyAirLabel}: </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatInfraspawnPointValue(
                supplyAir.point.lastValue,
                supplyAir.point.unit,
                supplyAir.point,
              )}
            </span>
          </div>
        ) : null}
        {trailingSlot}
      </div>
    </div>
  );
}
