import "server-only";

import { applyPointMetadataOverridesToList } from "@/lib/sd-anlegg/point-metadata-overrides";
import { bootstrapControlSignalBindings } from "@/lib/sd-anlegg/control/bootstrap-control-signal-bindings";
import {
  mergeControlSignalBindings,
  type ControlSignalBinding,
} from "@/lib/sd-anlegg/control/control-signal-bindings";
import type { ControlResolveContext } from "@/lib/sd-anlegg/control/resolve-control-catalog";
import {
  isSorgenfriCaseBuilding,
  materializeSorgenfriControlBindings,
} from "@/lib/sd-anlegg/control/sorgenfri-control-bindings";
import { resolveBuildingControlProfile } from "@/lib/sd-anlegg/control/building-control-profile";
import { loadSdAnleggSiteProfileForBuilding } from "@/lib/sd-anlegg/load-site-profile";
import { parseSiteProfileMetadata } from "@/lib/sd-anlegg/site-profile-metadata";
import { prisma } from "@/lib/db";
import { listMpcPointMeta } from "./mpc-point-meta";

export type MpcResolveContext = ControlResolveContext & {
  points: Awaited<ReturnType<typeof listMpcPointMeta>>;
  bindings: ControlSignalBinding[];
};

export async function loadMpcResolveContext(input: {
  buildingId: string;
  buildingSlug?: string;
  sourceId: string;
  unitKey?: string;
}): Promise<MpcResolveContext> {
  const rawPoints = await listMpcPointMeta(input.sourceId);
  const profile = await loadSdAnleggSiteProfileForBuilding(input.buildingId);

  const metadata = profile
    ? {
        pointMetadataOverrides: profile.pointMetadataOverrides,
        controlSignalBindings: profile.controlSignalBindings,
      }
    : parseSiteProfileMetadata(null);

  const points = applyPointMetadataOverridesToList(
    rawPoints,
    metadata.pointMetadataOverrides,
  );

  const controlProfile = input.buildingSlug
    ? resolveBuildingControlProfile(input.buildingSlug)
    : null;
  const defaultUnitKey =
    input.unitKey ??
    controlProfile?.ventilationUnitSlug ??
    controlProfile?.unitKey?.replace(/\./g, "");

  const bootstrapped = bootstrapControlSignalBindings({
    points,
    metadataOverrides: metadata.pointMetadataOverrides,
    defaultUnitKey,
  });

  const curated = isSorgenfriCaseBuilding(input.buildingSlug)
    ? materializeSorgenfriControlBindings({
        sourceId: input.sourceId,
        points,
      })
    : [];

  const bindings = mergeControlSignalBindings(
    bootstrapped,
    curated,
    metadata.controlSignalBindings,
  );

  return {
    sourceId: input.sourceId,
    points,
    bindings,
    unitKey: defaultUnitKey,
  };
}

export async function loadMpcResolveContextBySource(
  sourceId: string,
  unitKey?: string,
): Promise<MpcResolveContext | null> {
  const source = await prisma.infraspawnSource.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      buildingId: true,
      building: { select: { slug: true } },
    },
  });
  if (!source) return null;

  return loadMpcResolveContext({
    buildingId: source.buildingId,
    buildingSlug: source.building?.slug ?? undefined,
    sourceId: source.id,
    unitKey,
  });
}
