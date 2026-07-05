import { findPointDisplayOverride } from "@/lib/sd-anlegg/point-display-overrides";
import { resolveInfraspawnPointLocationLabel } from "@/lib/infraspawn/point-location-label";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

export function resolveSdAnleggPointLocationLabel(input: {
  sourceId: string;
  objectId: string;
  profile: ResolvedSdAnleggSiteProfile;
  point?: Pick<
    InfraspawnPointListItem,
    "objectId" | "objectName" | "description" | "sourceLabel"
  > | null;
  relatedPoints?: readonly InfraspawnPointListItem[];
}): string | null {
  const manual = findPointDisplayOverride(
    input.profile.pointDisplayOverrides,
    input.sourceId,
    input.objectId,
  );
  if (manual?.label) return manual.label;

  if (!input.point) return null;

  return resolveInfraspawnPointLocationLabel({
    point: {
      objectId: input.objectId,
      objectName: input.point.objectName ?? null,
      description: input.point.description ?? null,
      sourceLabel: input.point.sourceLabel ?? null,
    },
    relatedPoints: input.relatedPoints,
  });
}
