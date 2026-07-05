"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  getInfraspawnAlarmStatsAction,
  getInfraspawnAlarmSummaryAction,
  getInfraspawnSyncRevisionAction,
  listInfraspawnAlarmEventsAction,
  listInfraspawnPointsForBuildingAction,
  listInfraspawnWorkspaceLivePointsAction,
  type SdAnleggWorkspaceLiveScope,
} from "@/actions/infraspawn-read";
import { getInfraspawnOrgSummaryAction } from "@/actions/infraspawn-summary";
import { buildInfraspawnAlarmOverview } from "@/lib/infraspawn/alarm-overview";
import type {
  InfraspawnAlarmEventListItem,
  InfraspawnAlarmSummary,
} from "@/lib/infraspawn/alarm-event-types";
import type { InfraspawnAlarmStatsPeriod } from "@/lib/infraspawn/alarm-stats-types";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import { SD_ANLEGG_LIVE_POLL_MS } from "@/lib/infraspawn/live-display-policy";
import {
  canIncludeInfluxTailForPoll,
  markInfluxTailPolled,
} from "@/lib/infraspawn/poll-tail-gate";
import {
  indexPointsByKey,
  retainPointValuesAcrossPolls,
} from "@/lib/infraspawn/retain-point-values-across-polls";
import { useSdAnleggServerInitialPoints } from "@/components/sd-anlegg/sd-anlegg-live-points-context";
import { useSeedSdAnleggLivePoints } from "@/components/sd-anlegg/use-seed-sd-anlegg-live-points";
import { useIsClientMounted } from "@/hooks/use-is-client-mounted";

export const infraspawnQueryKeys = {
  orgSummary: (organizationId: string | undefined) =>
    ["infraspawn", "org-summary", organizationId] as const,
};

export function buildSdAnleggPointsScopeKey(input: {
  domain?: InfraspawnSystemDomain;
  scopeId?: string;
  unitObjectIds?: readonly string[];
  unitKey?: string;
}): string {
  return [
    input.domain ?? "all",
    input.scopeId ?? "all",
    input.unitKey ?? "all",
    input.unitObjectIds?.length ? input.unitObjectIds.join("|") : "all",
  ].join(":");
}

export const sdAnleggQueryKeys = {
  points: (buildingSlug: string) =>
    ["sd-anlegg", "points", buildingSlug] as const,
  workspaceLivePoints: (buildingSlug: string, scopeKey: string) =>
    ["sd-anlegg", "workspace-live", buildingSlug, scopeKey] as const,
  seriesBatch: (
    buildingSlug: string,
    chartPointsKey: string,
    hours: number,
  ) => ["sd-anlegg", "series-batch", buildingSlug, chartPointsKey, hours] as const,
  dashboard: (buildingSlug: string) =>
    ["sd-anlegg", "dashboard", buildingSlug] as const,
  schemaContext: (buildingSlug: string, scopeKey?: string) =>
    scopeKey
      ? (["sd-anlegg", "schema-context", buildingSlug, scopeKey] as const)
      : (["sd-anlegg", "schema-context", buildingSlug] as const),
  profile: (buildingSlug: string) =>
    ["sd-anlegg", "profile", buildingSlug] as const,
  contactCandidates: (organizationId: string | undefined) =>
    ["sd-anlegg", "contact-candidates", organizationId] as const,
  alarms: (buildingSlug: string, params: string) =>
    ["sd-anlegg", "alarms", buildingSlug, params] as const,
  alarmSummary: (buildingSlug: string) =>
    ["sd-anlegg", "alarm-summary", buildingSlug] as const,
  alarmStats: (
    buildingSlug: string,
    periodDays: InfraspawnAlarmStatsPeriod,
    typeKey: string | null,
  ) =>
    [
      "sd-anlegg",
      "alarm-stats",
      buildingSlug,
      periodDays,
      typeKey ?? "all",
    ] as const,
  syncRevision: (buildingSlug: string) =>
    ["sd-anlegg", "sync-revision", buildingSlug] as const,
};

/** Poll sync watermark — invalidér mirror-data når revision endres. */
export const SD_ANLEGG_SYNC_REVISION_POLL_MS = 30_000;

export function invalidateSdAnleggMirrorData(
  queryClient: QueryClient,
  buildingSlug: string,
): void {
  invalidateSdAnleggProfileAndPoints(queryClient, buildingSlug);
  void queryClient.invalidateQueries({
    queryKey: ["sd-anlegg", "workspace-live", buildingSlug],
  });
  void queryClient.invalidateQueries({
    queryKey: ["sd-anlegg", "series-batch", buildingSlug],
  });
  void queryClient.invalidateQueries({
    queryKey: sdAnleggQueryKeys.dashboard(buildingSlug),
  });
  void queryClient.invalidateQueries({
    queryKey: ["sd-anlegg", "schema-context", buildingSlug],
  });
  void queryClient.invalidateQueries({
    queryKey: sdAnleggQueryKeys.alarmSummary(buildingSlug),
  });
  void queryClient.invalidateQueries({
    queryKey: ["sd-anlegg", "alarms", buildingSlug],
  });
}

/** Overvåker Infraspawn-sync og invalidér React Query ved ny Postgres-mirror. */
export function useSdAnleggSyncInvalidation(
  buildingSlug: string,
  options?: { refetchInterval?: number },
): void {
  const queryClient = useQueryClient();
  const lastRevisionRef = useRef<string | null>(null);
  const pollMs = options?.refetchInterval ?? SD_ANLEGG_SYNC_REVISION_POLL_MS;

  const { data } = useQuery({
    queryKey: sdAnleggQueryKeys.syncRevision(buildingSlug),
    queryFn: async () => {
      const res = await getInfraspawnSyncRevisionAction(buildingSlug);
      if (!res.success) throw new Error(res.error ?? "Sync-revision feilet");
      return res.data;
    },
    enabled: Boolean(buildingSlug),
    staleTime: pollMs,
    refetchInterval: pollMs,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const revision = data?.revision;
    if (!revision) return;

    if (lastRevisionRef.current === null) {
      lastRevisionRef.current = revision;
      return;
    }

    if (lastRevisionRef.current === revision) return;

    lastRevisionRef.current = revision;
    invalidateSdAnleggMirrorData(queryClient, buildingSlug);
  }, [buildingSlug, data?.revision, queryClient]);
}

export function invalidateSdAnleggProfileAndPoints(
  queryClient: QueryClient,
  buildingSlug: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: sdAnleggQueryKeys.profile(buildingSlug),
  });
  void queryClient.invalidateQueries({
    queryKey: sdAnleggQueryKeys.points(buildingSlug),
  });
}

export function useInvalidateSdAnleggProfileAndPoints(buildingSlug: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    invalidateSdAnleggProfileAndPoints(queryClient, buildingSlug);
  }, [buildingSlug, queryClient]);
}

type SdAnleggPointsOptions = {
  initialData?: InfraspawnPointListItem[];
  staleTime?: number;
  refetchInterval?: number | false;
};

export type SdAnleggOverviewAlarmsData = {
  events: InfraspawnAlarmEventListItem[];
  summary: InfraspawnAlarmSummary;
};

type SdAnleggAlarmSummaryOptions = {
  poll?: boolean;
  enabled?: boolean;
};

function buildAlarmGroupsFromOverviewCache(
  queryClient: ReturnType<typeof useQueryClient>,
  buildingSlug: string,
  featuredPointRefs?: readonly SdAnleggFeaturedPointRef[],
  pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[],
) {
  const overview = queryClient.getQueryData<SdAnleggOverviewAlarmsData>(
    sdAnleggQueryKeys.alarms(buildingSlug, "overview"),
  );
  if (!overview?.events.length) return undefined;
  const livePoints = queryClient.getQueryData<InfraspawnPointListItem[]>(
    sdAnleggQueryKeys.points(buildingSlug),
  );
  return buildInfraspawnAlarmOverview({
    events: overview.events,
    livePoints,
    featuredPointRefs,
    pointDisplayOverrides,
  });
}

/** Org har aktivert Infraspawn-integrasjon (brukes bl.a. for betinget sidebar). */
export function useInfraspawnOrgSummary(organizationId: string | undefined) {
  return useQuery({
    queryKey: infraspawnQueryKeys.orgSummary(organizationId),
    queryFn: () => getInfraspawnOrgSummaryAction(),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}

function retainAgainstQueryCache(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  incoming: InfraspawnPointListItem[],
): InfraspawnPointListItem[] {
  const previous = queryClient.getQueryData<InfraspawnPointListItem[]>(queryKey);
  if (!previous?.length) return incoming;
  return retainPointValuesAcrossPolls(incoming, indexPointsByKey(previous));
}

/**
 * Live Infraspawn polling-kontrakt (SD-anlegg):
 * - `enabled: mounted` — ingen client-fetch før hydrering (unngår mismatch)
 * - Seed fra layout (`useSdAnleggServerInitialPoints`) eller eksplisitt `initialData`
 * - Poll hvert SD_ANLEGG_LIVE_POLL_MS; Influx-tail throttles via poll-tail-gate (15s)
 */
function sdAnleggLiveQueryOptions(
  initialData: InfraspawnPointListItem[] | readonly InfraspawnPointListItem[] | undefined,
  staleTime = SD_ANLEGG_LIVE_POLL_MS,
) {
  const seeded = initialData?.length ? [...initialData] : undefined;
  return {
    initialData: seeded,
    initialDataUpdatedAt: seeded ? 0 : undefined,
    staleTime,
    refetchOnMount: seeded ? false : true,
    refetchOnWindowFocus: seeded ? false : true,
  } as const;
}

export function useSdAnleggPoints(
  buildingSlug: string,
  options: SdAnleggPointsOptions = {},
) {
  const mounted = useIsClientMounted();
  const serverInitialPoints = useSdAnleggServerInitialPoints();
  const resolvedInitialData = options.initialData ?? serverInitialPoints;
  const seeded = useSeedSdAnleggLivePoints(buildingSlug, resolvedInitialData);
  const queryKey = sdAnleggQueryKeys.points(buildingSlug);

  const liveQuery = sdAnleggLiveQueryOptions(
    seeded ?? resolvedInitialData,
    options.staleTime ?? SD_ANLEGG_LIVE_POLL_MS,
  );
  const pollInterval =
    options.refetchInterval === false
      ? false
      : (options.refetchInterval ?? SD_ANLEGG_LIVE_POLL_MS);

  return useQuery({
    queryKey,
    queryFn: async ({ client }) => {
      const pollTailScopeKey = `${buildingSlug}:overview`;
      const includeInfluxTail = canIncludeInfluxTailForPoll(
        client,
        pollTailScopeKey,
      );
      if (includeInfluxTail) {
        markInfluxTailPolled(client, pollTailScopeKey);
      }
      const res = await listInfraspawnPointsForBuildingAction(buildingSlug, {
        includeInfluxTail,
      });
      if (!res.success) throw new Error(res.error ?? "Kunne ikke laste signaler");
      return retainAgainstQueryCache(client, queryKey, res.points);
    },
    ...liveQuery,
    enabled: mounted,
    placeholderData: keepPreviousData,
    refetchInterval: mounted && pollInterval !== false ? pollInterval : false,
    refetchIntervalInBackground: true,
  });
}

type SdAnleggWorkspaceLivePointsOptions = {
  scope: SdAnleggWorkspaceLiveScope;
  scopeKey: string;
  initialData?: InfraspawnPointListItem[];
  staleTime?: number;
  refetchInterval?: number | false;
};

export function useSdAnleggWorkspaceLivePoints(
  buildingSlug: string,
  options: SdAnleggWorkspaceLivePointsOptions,
) {
  const mounted = useIsClientMounted();
  const queryClient = useQueryClient();
  const { scope, scopeKey, initialData } = options;
  const queryKey = sdAnleggQueryKeys.workspaceLivePoints(buildingSlug, scopeKey);
  const seeded = useMemo(
    () => (initialData?.length ? [...initialData] : undefined),
    [initialData],
  );
  const seedKey = `${buildingSlug}:${scopeKey}`;
  const lastSeedKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!seeded || lastSeedKeyRef.current === seedKey) return;
    lastSeedKeyRef.current = seedKey;
    queryClient.setQueryData(queryKey, seeded);
  }, [queryClient, queryKey, seedKey, seeded]);

  const liveQuery = sdAnleggLiveQueryOptions(
    initialData,
    options.staleTime ?? SD_ANLEGG_LIVE_POLL_MS,
  );
  const pollInterval =
    options.refetchInterval === false
      ? false
      : (options.refetchInterval ?? SD_ANLEGG_LIVE_POLL_MS);

  return useQuery({
    queryKey,
    queryFn: async ({ client }) => {
      const pollTailScopeKey = `${buildingSlug}:${scopeKey}`;
      const includeInfluxTail = canIncludeInfluxTailForPoll(
        client,
        pollTailScopeKey,
      );
      if (includeInfluxTail) {
        markInfluxTailPolled(client, pollTailScopeKey);
      }
      const res = await listInfraspawnWorkspaceLivePointsAction(
        buildingSlug,
        scope,
        { includeInfluxTail },
      );
      if (!res.success) {
        throw new Error(res.error ?? "Kunne ikke laste live signaler");
      }
      return retainAgainstQueryCache(client, queryKey, res.points);
    },
    ...liveQuery,
    enabled: mounted,
    placeholderData: keepPreviousData,
    refetchInterval: mounted && pollInterval !== false ? pollInterval : false,
    refetchIntervalInBackground: true,
  });
}

export function useSdAnleggAlarmSummary(
  buildingSlug: string,
  options: SdAnleggAlarmSummaryOptions = {},
) {
  const poll = options.poll ?? true;
  const enabled = options.enabled ?? true;

  return useQuery({
    queryKey: sdAnleggQueryKeys.alarmSummary(buildingSlug),
    queryFn: async () => {
      const res = await getInfraspawnAlarmSummaryAction(buildingSlug);
      if (!res.success) throw new Error(res.error ?? "Kunne ikke laste alarmer");
      return res.summary;
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: poll && enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useSdAnleggOverviewAlarms(buildingSlug: string) {
  const mounted = useIsClientMounted();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: sdAnleggQueryKeys.alarms(buildingSlug, "overview"),
    queryFn: async () => {
      const res = await listInfraspawnAlarmEventsAction({
        buildingSlug,
        activeOnly: true,
        limit: 50,
        withLiveValues: false,
      });
      if (!res.success) throw new Error(res.error ?? "Kunne ikke laste alarmer");
      queryClient.setQueryData(
        sdAnleggQueryKeys.alarmSummary(buildingSlug),
        res.data.summary,
      );
      return {
        events: res.data.events,
        summary: res.data.summary!,
      };
    },
    enabled: mounted,
    staleTime: 30_000,
    refetchInterval: mounted ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useSdAnleggAlarmGroups(
  buildingSlug: string,
  enabled: boolean,
  featuredPointRefs?: readonly SdAnleggFeaturedPointRef[],
  pointDisplayOverrides?: readonly SdAnleggFeaturedPointRef[],
) {
  const queryClient = useQueryClient();
  const featuredKey = featuredPointRefs?.length
    ? featuredPointRefs.map((ref) => `${ref.sourceId}:${ref.objectId}`).join("|")
    : "none";
  const overrideKey = pointDisplayOverrides?.length
    ? pointDisplayOverrides.map((ref) => `${ref.sourceId}:${ref.objectId}`).join("|")
    : "none";

  return useQuery({
    queryKey: [
      ...sdAnleggQueryKeys.alarms(buildingSlug, "groups"),
      featuredKey,
      overrideKey,
    ],
    queryFn: async () => {
      const res = await listInfraspawnAlarmEventsAction({
        buildingSlug,
        limit: 200,
        withLiveValues: true,
      });
      if (!res.success) throw new Error(res.error ?? "Kunne ikke laste alarm");
      if (res.data.summary) {
        queryClient.setQueryData(
          sdAnleggQueryKeys.alarmSummary(buildingSlug),
          res.data.summary,
        );
      }
      return buildInfraspawnAlarmOverview({
        events: res.data.events,
        livePoints: res.data.livePoints,
        featuredPointRefs,
        pointDisplayOverrides,
      });
    },
    enabled,
    staleTime: 15_000,
    placeholderData: () =>
      buildAlarmGroupsFromOverviewCache(
        queryClient,
        buildingSlug,
        featuredPointRefs,
        pointDisplayOverrides,
      ),
  });
}

export function useSdAnleggAlarmStats(
  buildingSlug: string,
  periodDays: InfraspawnAlarmStatsPeriod,
  typeKey: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: sdAnleggQueryKeys.alarmStats(buildingSlug, periodDays, typeKey),
    queryFn: async () => {
      const res = await getInfraspawnAlarmStatsAction({
        buildingSlug,
        periodDays,
        typeKey,
      });
      if (!res.success) {
        throw new Error(res.error ?? "Kunne ikke laste alarmstatistikk");
      }
      return res.stats;
    },
    enabled,
    staleTime: 60_000,
    refetchIntervalInBackground: false,
  });
}

export type SdAnleggAlarmLogViewMode = "active" | "all";

export type SdAnleggAlarmLogData = {
  events: InfraspawnAlarmEventListItem[];
  summary?: InfraspawnAlarmSummary;
  livePoints?: InfraspawnPointListItem[];
};

export function useSdAnleggAlarmLog(
  buildingSlug: string,
  options: {
    limit: string;
    viewMode: SdAnleggAlarmLogViewMode;
    search: string;
  },
) {
  const { limit, viewMode, search } = options;
  const trimmedSearch = search.trim();

  return useQuery({
    queryKey: sdAnleggQueryKeys.alarms(
      buildingSlug,
      `log:${limit}:${viewMode}:${trimmedSearch}`,
    ),
    queryFn: async (): Promise<SdAnleggAlarmLogData> => {
      const res = await listInfraspawnAlarmEventsAction({
        buildingSlug,
        limit: Number.parseInt(limit, 10),
        activeOnly: viewMode === "active",
        search: trimmedSearch || undefined,
        withLiveValues: true,
        includeSummary: true,
      });
      if (!res.success) {
        throw new Error(res.error ?? "Kunne ikke laste alarmlogg");
      }
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
