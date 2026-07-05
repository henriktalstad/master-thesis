"use client";

import { Activity } from "lucide-react";
import { selectOverviewKeyPoints } from "@/lib/infraspawn/dashboard-overview";
import type { InfraspawnBuildingDashboard } from "@/lib/infraspawn/build-infraspawn-building-dashboard";
import { formatInfraspawnPointValueParts } from "@/lib/infraspawn/display-format";
import { resolveInfraspawnPointDisplayStatus } from "@/lib/infraspawn/point-status";
import type { InfraspawnBuildingPageData } from "@/lib/infraspawn/types";
import { latestOverviewKeyPointSampleIso } from "@/lib/sd-anlegg/overview-key-point-freshness";
import { resolveOverviewSignalsDomain } from "@/lib/sd-anlegg/resolve-overview-signals-domain";
import { resolveSdAnleggDomainHref } from "@/lib/sd-anlegg/resolve-domain-anleggsenheter";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { SdAnleggKeyPointValue } from "./sd-anlegg-key-point-value";
import { SdAnleggOverviewLiveStatus } from "./sd-anlegg-overview-live-status";
import { SdAnleggOverviewWidget } from "./sd-anlegg-overview-widget";
import { SdAnleggOverviewKeyPointsSkeleton } from "./sd-anlegg-overview-widget-skeleton";
import {
  SD_ANLEGG_ALARM_SEVERITY_ACCENT,
  SD_ANLEGG_KEY_POINT_TILE,
  SD_ANLEGG_STATUS_OK_DOT,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  pageData: InfraspawnBuildingPageData;
  dashboard: InfraspawnBuildingDashboard | null | undefined;
  livePoints: InfraspawnPointListItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
};

export function SdAnleggOverviewKeyPointsCard({
  buildingSlug,
  pageData,
  dashboard,
  livePoints,
  isPending,
  isError,
  isRefetching,
}: Props) {
  const keyPoints = dashboard ? selectOverviewKeyPoints(dashboard, 6) : [];
  const supplyReturnDelta = dashboard?.supplyReturnDelta;
  const supplyReturnDeltaParts =
    supplyReturnDelta != null
      ? formatInfraspawnPointValueParts(supplyReturnDelta, "degrees-celsius")
      : null;
  const latestSampleAt = latestOverviewKeyPointSampleIso(keyPoints);

  const signalsHref = resolveSdAnleggDomainHref(
    buildingSlug,
    resolveOverviewSignalsDomain(keyPoints),
    livePoints,
    pageData.sources,
  );

  return (
    <SdAnleggOverviewWidget
      title="Punktstatus"
      titleId="sd-anlegg-key-points-title"
      isRefreshing={isRefetching}
      subtitle={
        <>
          Utvalgte verdier for varme og ventilasjon
          <span className="mt-1.5 block min-h-[1.625rem]">
            {supplyReturnDeltaParts?.kind === "numeric" ? (
              <span className="inline-flex items-baseline gap-1 rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                <span>Tur/retur</span>
                <span className="font-medium tabular-nums text-foreground/90">
                  {supplyReturnDeltaParts.value}
                </span>
                {supplyReturnDeltaParts.unit ? (
                  <span className="text-[10px] font-normal text-muted-foreground/75">
                    {supplyReturnDeltaParts.unit}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        </>
      }
      icon={Activity}
      footer={{
        href: signalsHref,
        label: "Se signaler",
      }}
    >
      {isPending && !dashboard ? (
        <SdAnleggOverviewKeyPointsSkeleton />
      ) : isError || keyPoints.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-4 text-sm text-muted-foreground">
          Ingen nøkkelpunkter tilgjengelig ennå.
        </p>
      ) : (
        <>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {keyPoints.map((card) => {
              const status = resolveInfraspawnPointDisplayStatus(card.point);

              return (
                <li
                  key={`${card.role}:${card.point.sourceId}:${card.point.objectId}`}
                  className="min-w-0"
                >
                  <div
                    className={cn(
                      SD_ANLEGG_KEY_POINT_TILE,
                      "flex h-full min-h-[4.25rem] flex-col justify-center gap-1",
                      status === "alarm" && SD_ANLEGG_ALARM_SEVERITY_ACCENT.A,
                      status === "fault" && SD_ANLEGG_ALARM_SEVERITY_ACCENT.FAULT,
                      (status === "alarm" || status === "fault") &&
                        "border-l-[3px] bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <p
                        className="min-w-0 truncate text-xs font-medium text-muted-foreground"
                        title={card.label}
                      >
                        {card.label}
                      </p>
                      {status === "alarm" ? (
                        <span
                          className="size-2 shrink-0 rounded-full bg-destructive"
                          aria-label="Alarm"
                        />
                      ) : status === "fault" ? (
                        <span
                          className="size-2 shrink-0 rounded-full bg-warning"
                          aria-label="Feil"
                        />
                      ) : (
                        <span
                          className={cn(SD_ANLEGG_STATUS_OK_DOT, "size-2")}
                          aria-hidden
                        />
                      )}
                    </div>
                    <SdAnleggKeyPointValue point={card.point} />
                  </div>
                </li>
              );
            })}
          </ul>
          <SdAnleggOverviewLiveStatus sampledAt={latestSampleAt} />
        </>
      )}
    </SdAnleggOverviewWidget>
  );
}
