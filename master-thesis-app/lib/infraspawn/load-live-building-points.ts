import "server-only";

import { prisma } from "@/lib/db";
import {
  type SdAnleggLiveLoadProfile,
} from "@/lib/infraspawn/live-display-policy";
import {
  fillPointsMissingValuesFromPostgres,
  listInfraspawnPointMetaForBuilding,
} from "@/lib/infraspawn/read-points";
import { resolveInitialPaintTailObjectIds } from "@/lib/infraspawn/resolve-initial-paint-tail-object-ids";
import { resolvePollTailObjectIds } from "@/lib/infraspawn/resolve-poll-tail-object-ids";
import {
  applyWorkspaceLivePointScope,
  type WorkspaceLiveScopeInput,
} from "@/lib/sd-anlegg/resolve-workspace-live-points";
import { resolveSdAnleggSlowChangingTailObjectIds } from "@/lib/sd-anlegg/resolve-slow-changing-live-tail-object-ids";
import type { InfraspawnSourceCredentialRow } from "@/services/infraspawn/source-influx-credentials";
import {
  enrichSdAnleggPointsWithInfluxLive,
  type EnrichSdAnleggInfluxLiveOptions,
} from "@/services/infraspawn/live-point-values";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

async function loadInfluxSourcesForBuilding(
  integrationId: string,
  buildingId: string,
): Promise<InfraspawnSourceCredentialRow[]> {
  return prisma.infraspawnSource.findMany({
    where: { integrationId, buildingId, isActive: true },
    select: {
      id: true,
      label: true,
      influxDatabase: true,
      apiTokenEncrypted: true,
      metadata: true,
    },
  });
}

export type LoadLivePointsForBuildingInput = {
  integrationId: string;
  buildingId: string;
  enrich?: EnrichSdAnleggInfluxLiveOptions;
  workspaceScope?: WorkspaceLiveScopeInput;
  liveLoadProfile?: SdAnleggLiveLoadProfile;
  fillMissingFromPostgres?: boolean;
  extraTailObjectIds?: readonly string[];
  includeInfluxTail?: boolean;
};

export async function loadLivePointsForBuilding(
  input: LoadLivePointsForBuildingInput,
): Promise<InfraspawnPointListItem[]> {
  const liveLoadProfile = input.liveLoadProfile ?? "poll";

  const [points, influxSources] = await Promise.all([
    listInfraspawnPointMetaForBuilding(input.integrationId, input.buildingId),
    loadInfluxSourcesForBuilding(input.integrationId, input.buildingId),
  ]);

  const scope = input.workspaceScope;
  const scopedPoints = scope
    ? applyWorkspaceLivePointScope(points, scope)
    : undefined;
  const sourceRefs = influxSources.map((source) => ({
    id: source.id,
    label: source.label ?? source.id,
  }));

  const enrichOptions: EnrichSdAnleggInfluxLiveOptions = {
    ...input.enrich,
  };

  if (scope && scopedPoints) {
    enrichOptions.influxObjectIds = [
      ...new Set(scopedPoints.map((point) => point.objectId)),
    ];
  }

  const slowChangingTailObjectIds = resolveSdAnleggSlowChangingTailObjectIds(
    scopedPoints ?? points,
  );

  if (liveLoadProfile === "initial-paint") {
    enrichOptions.tailObjectIds = resolveInitialPaintTailObjectIds({
      points,
      sources: sourceRefs,
      workspaceScope: scope,
      extraTailObjectIds: input.extraTailObjectIds,
      priorityObjectIds: slowChangingTailObjectIds,
      scopedPoints,
    });
  } else if (input.includeInfluxTail === true) {
    enrichOptions.tailObjectIds = resolvePollTailObjectIds({
      points,
      scopedPoints,
      workspaceScope: scope,
      priorityObjectIds: slowChangingTailObjectIds,
    });
  }

  let enriched: InfraspawnPointListItem[];
  try {
    enriched = await enrichSdAnleggPointsWithInfluxLive(
      points,
      influxSources,
      enrichOptions,
    );
  } catch (error) {
    console.warn("[infraspawn.live.load]", {
      buildingId: input.buildingId,
      message: error instanceof Error ? error.message : "Ukjent Influx-feil",
    });
    enriched = points;
  }

  if (input.fillMissingFromPostgres) {
    enriched = await fillPointsMissingValuesFromPostgres(enriched);
  }

  return scope && scopedPoints
    ? applyWorkspaceLivePointScope(enriched, scope)
    : enriched;
}
