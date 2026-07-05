"use client";

import { useMemo } from "react";
import {
  buildInfraspawnBuildingDashboard,
  type InfraspawnBuildingDashboard,
} from "@/lib/infraspawn/build-infraspawn-building-dashboard";
import { SD_ANLEGG_LIVE_POLL_MS } from "@/lib/infraspawn/live-display-policy";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { useSdAnleggPoints } from "@/queries/infraspawn";

export function useSdAnleggLiveOverview(buildingSlug: string) {
  const query = useSdAnleggPoints(buildingSlug, {
    staleTime: SD_ANLEGG_LIVE_POLL_MS,
    refetchInterval: SD_ANLEGG_LIVE_POLL_MS,
  });

  const dashboard = useMemo<InfraspawnBuildingDashboard | null>(
    () => (query.data ? buildInfraspawnBuildingDashboard(query.data) : null),
    [query.data],
  );

  const isRefetching = query.isFetching && !query.isPending;

  return {
    livePoints: query.data as InfraspawnPointListItem[] | undefined,
    dashboard,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    isRefetching,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
