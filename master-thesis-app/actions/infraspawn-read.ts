"use server";

import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db";
import {
  getInfraspawnBuildingDisplayName,
  requireInfraspawnReadOrg,
  resolveInfraspawnBuildingForRead,
} from "@/lib/infraspawn/read-access";
import { loadSdAnleggChartSeriesBatch } from "@/lib/infraspawn/sd-anlegg-series";
import { loadInfraspawnBuildingHealthSummary } from "@/lib/infraspawn/read-health";
import { buildInfraspawnBuildingDashboard } from "@/lib/infraspawn/read-dashboard";
import type {
  InfraspawnBuildingPageData,
  InfraspawnChartSeriesEntry,
  InfraspawnPointListItem,
} from "@/lib/infraspawn/types";
import type { InfraspawnBuildingDashboard } from "@/lib/infraspawn/read-dashboard";
import {
  SD_ANLEGG_MAX_SERIES_HOURS,
  SD_ANLEGG_SERIES_HOURS,
} from "@/lib/infraspawn/sd-anlegg-chart-policy";
import { resolveSourceInfluxCredentials } from "@/services/infraspawn/source-influx-credentials";
import { loadLivePointsForBuilding } from "@/lib/infraspawn/load-live-building-points";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { WorkspaceLiveScopeInput } from "@/lib/sd-anlegg/resolve-workspace-live-points";
import { isCurrentUserAdmin, isOrgAdmin } from "@/actions/auth";
import { loadSdAnleggSchemaContextForBuilding } from "@/lib/sd-anlegg/load-schema-context";
import {
  inferAnleggsenheterFromPoints,
  summarizeAnleggsenheter,
} from "@/lib/sd-anlegg/infer-anleggsenheter";
import { loadSdAnleggSiteProfileForBuilding } from "@/lib/sd-anlegg/load-site-profile";
import {
  parseSdAnleggSiteProfileInput,
  type ResolvedSdAnleggSiteProfile,
} from "@/lib/sd-anlegg/site-profile-schema";
import { mergeSiteProfileMetadata } from "@/lib/sd-anlegg/site-profile-metadata";
import { upsertAnleggsenhetDisplayOverride } from "@/lib/sd-anlegg/anleggsenhet-display-overrides";
import { upsertPointDisplayOverride } from "@/lib/sd-anlegg/point-display-overrides";
import {
  resolvePointMetadataOverrideRemoval,
  syncScopeAssignmentFromMetadataOverride,
  upsertPointMetadataOverride,
  type SdAnleggPointMetadataOverride,
} from "@/lib/sd-anlegg/point-metadata-overrides";
import {
  getInfraspawnAlarmSummaryForBuilding,
  listInfraspawnAlarmEventsForBuilding,
} from "@/lib/infraspawn/read-alarm-events";
import type {
  InfraspawnAlarmEventListItem,
  InfraspawnAlarmSummary,
} from "@/lib/infraspawn/alarm-event-types";
import { getInfraspawnAlarmStatsForBuilding } from "@/lib/infraspawn/read-alarm-stats";
import type {
  InfraspawnAlarmStats,
  InfraspawnAlarmStatsPeriod,
} from "@/lib/infraspawn/alarm-stats-types";

async function loadInfraspawnBuildingSources(
  integrationId: string,
  buildingId: string,
) {
  return prisma.infraspawnSource.findMany({
    where: {
      integrationId,
      buildingId,
      isActive: true,
    },
    include: {
      syncState: true,
      _count: { select: { pointMeta: true } },
    },
    orderBy: { label: "asc" },
  });
}

function mapSourcesToPageData(
  sources: Awaited<ReturnType<typeof loadInfraspawnBuildingSources>>,
) {
  const syncTimes = sources
    .map((s) => s.lastSuccessfulSyncAt)
    .filter((d): d is Date => d != null);
  const oldestSuccessfulSyncAt =
    syncTimes.length > 0
      ? new Date(Math.min(...syncTimes.map((d) => d.getTime()))).toISOString()
      : null;

  return {
    oldestSuccessfulSyncAt,
    sources: sources.map((s) => ({
      id: s.id,
      label: s.label,
      lastSuccessfulSyncAt: s.lastSuccessfulSyncAt?.toISOString() ?? null,
      syncStatus: s.syncState?.status ?? null,
      lastError: s.lastError,
      pointCount: s._count.pointMeta,
    })),
  };
}

export async function getInfraspawnBuildingWorkspaceAction(
  buildingSlug: string,
): Promise<
  | {
      success: true;
      pageData: InfraspawnBuildingPageData;
      initialPoints: InfraspawnPointListItem[];
    }
  | { success: false; error: string }
> {
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const [sourceRows, initialPoints, health] = await Promise.all([
    loadInfraspawnBuildingSources(access.integration.id, access.building.id),
    loadLivePointsForBuilding({
      integrationId: access.integration.id,
      buildingId: access.building.id,
      liveLoadProfile: "initial-paint",
      fillMissingFromPostgres: true,
    }),
    loadInfraspawnBuildingHealthSummary({
      integrationId: access.integration.id,
      buildingId: access.building.id,
    }),
  ]);
  const { oldestSuccessfulSyncAt, sources } = mapSourcesToPageData(sourceRows);
  const anleggsenheter = summarizeAnleggsenheter(
    inferAnleggsenheterFromPoints(initialPoints, sources).units,
  );

  return {
    success: true,
    pageData: {
      buildingId: access.building.id,
      buildingName: access.building.name,
      buildingSlug: access.building.slug,
      oldestSuccessfulSyncAt,
      sources,
      anleggsenheter,
      health,
    },
    initialPoints,
  };
}

export async function getInfraspawnBuildingDisplayNameAction(
  buildingSlug: string,
): Promise<string | null> {
  return getInfraspawnBuildingDisplayName(buildingSlug);
}

export type InfraspawnSyncRevision = {
  /** Stabil nøkkel — endres når sync skriver nye samples/meta. */
  revision: string;
  lastSuccessfulSyncAt: string | null;
  watermarkAt: string | null;
  syncStatus: string | null;
};

export async function getInfraspawnSyncRevisionAction(
  buildingSlug: string,
): Promise<
  | { success: true; data: InfraspawnSyncRevision }
  | { success: false; error: string }
> {
  noStore();
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const sources = await prisma.infraspawnSource.findMany({
    where: {
      integrationId: access.integration.id,
      buildingId: access.building.id,
      isActive: true,
    },
    select: {
      id: true,
      lastSuccessfulSyncAt: true,
      syncState: {
        select: {
          watermarkAt: true,
          rowsUpserted: true,
          status: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const parts = sources.map((source) => {
    const sync = source.syncState;
    return [
      source.id,
      source.lastSuccessfulSyncAt?.toISOString() ?? "",
      sync?.watermarkAt?.toISOString() ?? "",
      sync?.rowsUpserted ?? 0,
      sync?.status ?? "",
      sync?.updatedAt?.toISOString() ?? "",
    ].join(":");
  });

  const watermarkTimes = sources
    .map((s) => s.syncState?.watermarkAt?.getTime())
    .filter((t): t is number => t != null);
  const syncTimes = sources
    .map((s) => s.lastSuccessfulSyncAt?.getTime())
    .filter((t): t is number => t != null);

  return {
    success: true,
    data: {
      revision: parts.join("|"),
      lastSuccessfulSyncAt:
        syncTimes.length > 0
          ? new Date(Math.max(...syncTimes)).toISOString()
          : null,
      watermarkAt:
        watermarkTimes.length > 0
          ? new Date(Math.max(...watermarkTimes)).toISOString()
          : null,
      syncStatus: sources[0]?.syncState?.status ?? null,
    },
  };
}

export type InfraspawnLivePollOptions = {
  includeInfluxTail?: boolean;
};

export async function listInfraspawnPointsForBuildingAction(
  buildingSlug: string,
  options: InfraspawnLivePollOptions = {},
): Promise<
  | { success: true; points: InfraspawnPointListItem[] }
  | { success: false; error: string }
> {
  noStore();
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const livePoints = await loadLivePointsForBuilding({
    integrationId: access.integration.id,
    buildingId: access.building.id,
    liveLoadProfile: "poll",
    includeInfluxTail: options.includeInfluxTail,
    fillMissingFromPostgres: options.includeInfluxTail === true,
  });
  return { success: true, points: livePoints };
}

export type SdAnleggWorkspaceLiveScope = WorkspaceLiveScopeInput;

export async function listInfraspawnWorkspaceLivePointsAction(
  buildingSlug: string,
  scope: SdAnleggWorkspaceLiveScope,
  options: InfraspawnLivePollOptions = {},
): Promise<
  | { success: true; points: InfraspawnPointListItem[] }
  | { success: false; error: string }
> {
  noStore();
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const points = await loadLivePointsForBuilding({
    integrationId: access.integration.id,
    buildingId: access.building.id,
    workspaceScope: scope,
    liveLoadProfile: "poll",
    includeInfluxTail: options.includeInfluxTail,
    fillMissingFromPostgres: true,
  });

  return {
    success: true,
    points,
  };
}

export async function getInfraspawnChartSeriesBatchAction(input: {
  buildingSlug: string;
  points: { sourceId: string; objectId: string }[];
  hours?: number;
}): Promise<
  | { success: true; series: InfraspawnChartSeriesEntry[] }
  | { success: false; error: string }
> {
  const access = await resolveInfraspawnBuildingForRead(input.buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const hours = Math.min(
    Math.max(input.hours ?? SD_ANLEGG_SERIES_HOURS, 1),
    SD_ANLEGG_MAX_SERIES_HOURS,
  );

  const uniquePoints = input.points.filter(
    (point, index, all) =>
      all.findIndex(
        (p) => p.sourceId === point.sourceId && p.objectId === point.objectId,
      ) === index,
  );

  if (uniquePoints.length === 0) {
    return { success: true, series: [] };
  }

  const allowedSources = await prisma.infraspawnSource.findMany({
    where: {
      id: { in: [...new Set(uniquePoints.map((p) => p.sourceId))] },
      organizationId: access.org.id,
      buildingId: access.building.id,
      isActive: true,
    },
    select: {
      id: true,
      influxDatabase: true,
      apiTokenEncrypted: true,
      metadata: true,
    },
  });
  const allowedSourceIds = new Set(allowedSources.map((s) => s.id));
  const influxBySourceId = resolveSourceInfluxCredentials(allowedSources);

  const bySource = new Map<string, string[]>();
  for (const point of uniquePoints) {
    if (!allowedSourceIds.has(point.sourceId)) continue;
    const list = bySource.get(point.sourceId) ?? [];
    list.push(point.objectId);
    bySource.set(point.sourceId, list);
  }

  const batches = await Promise.all(
    [...bySource.entries()].map(async ([sourceId, objectIds]) => {
      const influx = influxBySourceId.get(sourceId);
      const batch = await loadSdAnleggChartSeriesBatch({
        sourceId,
        objectIds,
        hours,
        influx,
      });
      return { sourceId, objectIds, batch };
    }),
  );

  const series = batches.flatMap(({ sourceId, objectIds, batch }) =>
    objectIds.flatMap((objectId) => {
      const result = batch.get(objectId);
      if (!result) return [];
      return [
        {
          sourceId,
          objectId,
          samples: result.samples,
          unit: result.unit,
        },
      ];
    }),
  );

  return { success: true, series };
}

export async function getInfraspawnBuildingDashboardAction(
  buildingSlug: string,
): Promise<
  | { success: true; dashboard: InfraspawnBuildingDashboard }
  | { success: false; error: string }
> {
  noStore();
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const livePoints = await loadLivePointsForBuilding({
    integrationId: access.integration.id,
    buildingId: access.building.id,
    liveLoadProfile: "poll",
    includeInfluxTail: true,
  });

  return {
    success: true,
    dashboard: buildInfraspawnBuildingDashboard(livePoints),
  };
}

export type SdAnleggSchemaContextActionData = {
  schemaTemplateId: string | null;
  elementKey: string | null;
};

export async function getSdAnleggSchemaContextAction(
  buildingSlug: string,
  options?: {
    domain?: InfraspawnSystemDomain;
    unitObjectIds?: string[];
    scopeId?: string;
    unitKey?: string;
  },
): Promise<
  | { success: true; data: SdAnleggSchemaContextActionData }
  | { success: false; error: string }
> {
  noStore();
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const livePoints = await loadLivePointsForBuilding({
    integrationId: access.integration.id,
    buildingId: access.building.id,
    liveLoadProfile: "poll",
    includeInfluxTail: true,
  });

  const context = loadSdAnleggSchemaContextForBuilding(livePoints, {
      buildingSlug,
      domain: options?.domain,
      unitObjectIds: options?.unitObjectIds,
      scopeId: options?.scopeId,
      unitKey: options?.unitKey,
    });

  return {
    success: true,
    data: {
      schemaTemplateId: context.schemaTemplate?.id ?? null,
      elementKey: context.elementKey,
    },
  };
}

export async function getSdAnleggSiteProfileAction(
  buildingSlug: string,
): Promise<
  | { success: true; profile: ResolvedSdAnleggSiteProfile }
  | { success: false; error: string }
> {
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const profile = await loadSdAnleggSiteProfileForBuilding(access.building.id);
  if (!profile) return { success: false, error: "Bygg ikke funnet" };

  return { success: true, profile };
}

export type SdAnleggContactCandidate = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  imageUrl: string | null;
};

export async function listSdAnleggContactCandidatesAction(): Promise<
  | { success: true; candidates: SdAnleggContactCandidate[] }
  | { success: false; error: string }
> {
  const [orgCtx, superAdmin, orgAdmin] = await Promise.all([
    requireInfraspawnReadOrg(),
    isCurrentUserAdmin(),
    isOrgAdmin(),
  ]);
  if (!orgCtx.ok) return { success: false, error: orgCtx.error };
  if (!superAdmin && !orgAdmin) {
    return {
      success: false,
      error: "Ingen tilgang til å redigere anleggsprofil",
    };
  }

  const memberships = await prisma.organizationToUsers.findMany({
    where: { organizationId: orgCtx.org.id },
    select: {
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          imageUrl: true,
        },
      },
    },
  });

  const candidates: Array<{
    userId: string;
    name: string;
    email: string;
    phone: null;
    imageUrl: string | null;
  }> = [];

  for (const entry of memberships) {
    const user = entry.users;
    if (!user) continue;
    candidates.push({
      userId: user.id,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.email,
      email: user.email,
      phone: null,
      imageUrl: user.imageUrl?.trim() || null,
    });
  }

  candidates.sort((a, b) => a.name.localeCompare(b.name, "nb"));

  return { success: true, candidates };
}

export async function upsertSdAnleggSiteProfileAction(input: {
  buildingSlug: string;
  profile: unknown;
}): Promise<
  | { success: true; profile: ResolvedSdAnleggSiteProfile }
  | { success: false; error: string }
> {
  const [access, superAdmin, orgAdmin] = await Promise.all([
    resolveInfraspawnBuildingForRead(input.buildingSlug),
    isCurrentUserAdmin(),
    isOrgAdmin(),
  ]);

  if (!access.ok) return { success: false, error: access.error };
  if (!superAdmin && !orgAdmin) {
    return {
      success: false,
      error: "Ingen tilgang til å redigere anleggsprofil",
    };
  }

  const parsed = parseSdAnleggSiteProfileInput(input.profile);
  if (!parsed) {
    return { success: false, error: "Ugyldig anleggsprofil" };
  }

  const existing = await prisma.sdAnleggSiteProfile.findUnique({
    where: { buildingId: access.building.id },
    select: { metadata: true },
  });

  const hasMetadataPatch =
    parsed.contactUserId !== undefined || parsed.contactEmail !== undefined;

  const metadata = mergeSiteProfileMetadata(existing?.metadata, {
    ...(parsed.contactUserId !== undefined && {
      contactUserId: parsed.contactUserId,
    }),
    ...(parsed.contactEmail !== undefined && {
      contactEmail: parsed.contactEmail,
    }),
  });

  await prisma.sdAnleggSiteProfile.upsert({
    where: { buildingId: access.building.id },
    create: {
      buildingId: access.building.id,
      displayTitle: parsed.displayTitle ?? null,
      heroImageUrl: parsed.heroImageUrl ?? null,
      clientLogoUrl: parsed.clientLogoUrl ?? null,
      contactName: parsed.contactName ?? null,
      contactPhone: parsed.contactPhone ?? null,
      contactLabel: parsed.contactLabel ?? null,
      featuredPointRefs: parsed.featuredPointRefs ?? [],
      metadata,
    },
    update: {
      ...(parsed.displayTitle !== undefined
        ? { displayTitle: parsed.displayTitle }
        : {}),
      ...(parsed.heroImageUrl !== undefined
        ? { heroImageUrl: parsed.heroImageUrl }
        : {}),
      ...(parsed.clientLogoUrl !== undefined
        ? { clientLogoUrl: parsed.clientLogoUrl }
        : {}),
      ...(parsed.contactName !== undefined
        ? { contactName: parsed.contactName }
        : {}),
      ...(parsed.contactPhone !== undefined
        ? { contactPhone: parsed.contactPhone }
        : {}),
      ...(parsed.contactLabel !== undefined
        ? { contactLabel: parsed.contactLabel }
        : {}),
      ...(parsed.featuredPointRefs !== undefined
        ? { featuredPointRefs: parsed.featuredPointRefs }
        : {}),
      ...(hasMetadataPatch ? { metadata } : {}),
    },
  });

  const profile = await loadSdAnleggSiteProfileForBuilding(access.building.id);
  if (!profile) return { success: false, error: "Kunne ikke laste profil" };

  return { success: true, profile };
}

export async function upsertSdAnleggAnleggsenhetDisplayNameAction(input: {
  buildingSlug: string;
  scopeId: string;
  displayName: string;
}): Promise<
  | { success: true; profile: ResolvedSdAnleggSiteProfile }
  | { success: false; error: string }
> {
  const [access, superAdmin, orgAdmin] = await Promise.all([
    resolveInfraspawnBuildingForRead(input.buildingSlug),
    isCurrentUserAdmin(),
    isOrgAdmin(),
  ]);

  if (!access.ok) return { success: false, error: access.error };
  if (!superAdmin && !orgAdmin) {
    return {
      success: false,
      error: "Ingen tilgang til å redigere anleggsnavn",
    };
  }

  const scopeId = input.scopeId.trim();
  if (!scopeId) {
    return { success: false, error: "Ugyldig anleggsenhet" };
  }

  const existing = await prisma.sdAnleggSiteProfile.findUnique({
    where: { buildingId: access.building.id },
    select: { metadata: true },
  });

  const baseMetadata = mergeSiteProfileMetadata(existing?.metadata, {});
  const anleggsenhetDisplayOverrides = upsertAnleggsenhetDisplayOverride(
    baseMetadata.anleggsenhetDisplayOverrides,
    scopeId,
    input.displayName,
  );

  const metadata = mergeSiteProfileMetadata(existing?.metadata, {
    anleggsenhetDisplayOverrides,
  });

  await prisma.sdAnleggSiteProfile.upsert({
    where: { buildingId: access.building.id },
    create: {
      buildingId: access.building.id,
      metadata,
    },
    update: {
      metadata,
    },
  });

  const profile = await loadSdAnleggSiteProfileForBuilding(access.building.id);
  if (!profile) return { success: false, error: "Kunne ikke laste profil" };

  return { success: true, profile };
}

export async function upsertSdAnleggPointLocationLabelAction(input: {
  buildingSlug: string;
  sourceId: string;
  objectId: string;
  label: string;
}): Promise<
  | { success: true; profile: ResolvedSdAnleggSiteProfile }
  | { success: false; error: string }
> {
  const [access, superAdmin, orgAdmin] = await Promise.all([
    resolveInfraspawnBuildingForRead(input.buildingSlug),
    isCurrentUserAdmin(),
    isOrgAdmin(),
  ]);

  if (!access.ok) return { success: false, error: access.error };
  if (!superAdmin && !orgAdmin) {
    return {
      success: false,
      error: "Ingen tilgang til å redigere signalplassering",
    };
  }

  const sourceId = input.sourceId.trim();
  const objectId = input.objectId.trim();
  if (!sourceId || !objectId) {
    return { success: false, error: "Ugyldig signal" };
  }

  const existing = await prisma.sdAnleggSiteProfile.findUnique({
    where: { buildingId: access.building.id },
    select: { metadata: true },
  });

  const baseMetadata = mergeSiteProfileMetadata(existing?.metadata, {});
  const pointDisplayOverrides = upsertPointDisplayOverride(
    baseMetadata.pointDisplayOverrides,
    sourceId,
    objectId,
    input.label,
  );

  const metadata = mergeSiteProfileMetadata(existing?.metadata, {
    pointDisplayOverrides,
  });

  await prisma.sdAnleggSiteProfile.upsert({
    where: { buildingId: access.building.id },
    create: {
      buildingId: access.building.id,
      metadata,
    },
    update: {
      metadata,
    },
  });

  const profile = await loadSdAnleggSiteProfileForBuilding(access.building.id);
  if (!profile) return { success: false, error: "Kunne ikke laste profil" };

  return { success: true, profile };
}

export async function upsertSdAnleggPointMetadataOverrideAction(input: {
  buildingSlug: string;
  override: SdAnleggPointMetadataOverride;
}): Promise<
  | { success: true; profile: ResolvedSdAnleggSiteProfile }
  | { success: false; error: string }
> {
  const [access, superAdmin, orgAdmin] = await Promise.all([
    resolveInfraspawnBuildingForRead(input.buildingSlug),
    isCurrentUserAdmin(),
    isOrgAdmin(),
  ]);

  if (!access.ok) return { success: false, error: access.error };
  if (!superAdmin && !orgAdmin) {
    return {
      success: false,
      error: "Ingen tilgang til å redigere signal-metadata",
    };
  }

  const sourceId = input.override.sourceId.trim();
  const objectId = input.override.objectId.trim();
  if (!sourceId || !objectId) {
    return { success: false, error: "Ugyldig signal" };
  }

  const existing = await prisma.sdAnleggSiteProfile.findUnique({
    where: { buildingId: access.building.id },
    select: { metadata: true },
  });

  const baseMetadata = mergeSiteProfileMetadata(existing?.metadata, {});
  const normalized: SdAnleggPointMetadataOverride = {
    sourceId,
    objectId,
    ...(input.override.objectName !== undefined
      ? { objectName: input.override.objectName.trim() || undefined }
      : {}),
    ...(input.override.description !== undefined
      ? { description: input.override.description.trim() || undefined }
      : {}),
    ...(input.override.subCentral !== undefined
      ? { subCentral: input.override.subCentral.trim() || undefined }
      : {}),
    ...(input.override.scopeId !== undefined
      ? { scopeId: input.override.scopeId.trim() || undefined }
      : {}),
    ...(input.override.schemaSlotId !== undefined
      ? { schemaSlotId: input.override.schemaSlotId.trim() || undefined }
      : {}),
  };

  const pointMetadataOverrides = upsertPointMetadataOverride(
    baseMetadata.pointMetadataOverrides,
    normalized,
  );
  const anleggsenhetPointAssignments = syncScopeAssignmentFromMetadataOverride(
    baseMetadata.anleggsenhetPointAssignments,
    normalized,
  );

  const metadata = mergeSiteProfileMetadata(existing?.metadata, {
    pointMetadataOverrides,
    anleggsenhetPointAssignments,
  });

  await prisma.sdAnleggSiteProfile.upsert({
    where: { buildingId: access.building.id },
    create: {
      buildingId: access.building.id,
      metadata,
    },
    update: {
      metadata,
    },
  });

  const profile = await loadSdAnleggSiteProfileForBuilding(access.building.id);
  if (!profile) return { success: false, error: "Kunne ikke laste profil" };

  return { success: true, profile };
}

export async function removeSdAnleggPointMetadataOverrideAction(input: {
  buildingSlug: string;
  sourceId: string;
  objectId: string;
}): Promise<
  | { success: true; profile: ResolvedSdAnleggSiteProfile }
  | { success: false; error: string }
> {
  const [access, superAdmin, orgAdmin] = await Promise.all([
    resolveInfraspawnBuildingForRead(input.buildingSlug),
    isCurrentUserAdmin(),
    isOrgAdmin(),
  ]);

  if (!access.ok) return { success: false, error: access.error };
  if (!superAdmin && !orgAdmin) {
    return {
      success: false,
      error: "Ingen tilgang til å redigere signal-metadata",
    };
  }

  const sourceId = input.sourceId.trim();
  const objectId = input.objectId.trim();
  if (!sourceId || !objectId) {
    return { success: false, error: "Ugyldig signal" };
  }

  const existing = await prisma.sdAnleggSiteProfile.findUnique({
    where: { buildingId: access.building.id },
    select: { metadata: true },
  });

  const baseMetadata = mergeSiteProfileMetadata(existing?.metadata, {});
  const { pointMetadataOverrides, anleggsenhetPointAssignments } =
    resolvePointMetadataOverrideRemoval(
      baseMetadata.pointMetadataOverrides,
      baseMetadata.anleggsenhetPointAssignments,
      sourceId,
      objectId,
    );

  const metadata = mergeSiteProfileMetadata(existing?.metadata, {
    pointMetadataOverrides,
    anleggsenhetPointAssignments,
  });

  await prisma.sdAnleggSiteProfile.upsert({
    where: { buildingId: access.building.id },
    create: {
      buildingId: access.building.id,
      metadata,
    },
    update: {
      metadata,
    },
  });

  const profile = await loadSdAnleggSiteProfileForBuilding(access.building.id);
  if (!profile) return { success: false, error: "Kunne ikke laste profil" };

  return { success: true, profile };
}

type InfraspawnAlarmEventsActionResult = {
  events: InfraspawnAlarmEventListItem[];
  summary?: InfraspawnAlarmSummary;
  livePoints?: InfraspawnPointListItem[];
};

export async function listInfraspawnAlarmEventsAction(input: {
  buildingSlug: string;
  limit?: number;
  activeOnly?: boolean;
  search?: string;
  domain?: InfraspawnSystemDomain;
  withLiveValues?: boolean;
  includeSummary?: boolean;
}): Promise<
  | { success: true; data: InfraspawnAlarmEventsActionResult }
  | { success: false; error: string }
> {
  const access = await resolveInfraspawnBuildingForRead(input.buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const includeSummary = input.includeSummary !== false;

  const livePoints =
    input.withLiveValues === false
      ? undefined
      : await loadLivePointsForBuilding({
          integrationId: access.integration.id,
          buildingId: access.building.id,
          liveLoadProfile: "poll",
          includeInfluxTail: true,
        });

  const events = await listInfraspawnAlarmEventsForBuilding({
    buildingId: access.building.id,
    limit: input.limit,
    activeOnly: input.activeOnly,
    search: input.search,
    domain: input.domain,
    livePoints,
  });

  const summary = includeSummary
    ? await getInfraspawnAlarmSummaryForBuilding({
        buildingId: access.building.id,
        livePoints,
      })
    : undefined;

  return { success: true, data: { events, summary, livePoints } };
}

export async function getInfraspawnAlarmStatsAction(input: {
  buildingSlug: string;
  periodDays: InfraspawnAlarmStatsPeriod;
  typeKey?: string | null;
}): Promise<
  | { success: true; stats: InfraspawnAlarmStats }
  | { success: false; error: string }
> {
  const access = await resolveInfraspawnBuildingForRead(input.buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const stats = await getInfraspawnAlarmStatsForBuilding({
    buildingId: access.building.id,
    periodDays: input.periodDays,
    typeKey: input.typeKey,
  });

  return { success: true, stats };
}

export async function getInfraspawnAlarmSummaryAction(
  buildingSlug: string,
): Promise<
  | { success: true; summary: InfraspawnAlarmSummary }
  | { success: false; error: string }
> {
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return { success: false, error: access.error };

  const summary = await getInfraspawnAlarmSummaryForBuilding({
    buildingId: access.building.id,
  });

  return { success: true, summary };
}
