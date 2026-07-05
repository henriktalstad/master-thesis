import type { SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";
import {
  normalizeInfraspawnObjectId,
  resolveInfraspawnPointLocationLabel,
} from "@/lib/infraspawn/point-location-label";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function pointKey(sourceId: string, objectId: string): string {
  return `${sourceId}:${normalizeInfraspawnObjectId(objectId)}`;
}

function toFeaturedRef(
  sourceId: string,
  objectId: string,
  label: string,
): SdAnleggFeaturedPointRef {
  return { sourceId, objectId, label };
}

/** Slår sammen manuelle profil-overrides med auto-mapping fra Infraspawn-meta. */
export function buildInfraspawnPointDisplayMapping(input: {
  points: readonly InfraspawnPointListItem[];
  manualOverrides?: readonly SdAnleggFeaturedPointRef[];
  manualFeatured?: readonly SdAnleggFeaturedPointRef[];
}): {
  pointDisplayOverrides: SdAnleggFeaturedPointRef[];
  featuredPointRefs: SdAnleggFeaturedPointRef[];
} {
  const labelByKey = new Map<string, SdAnleggFeaturedPointRef>();

  for (const ref of input.manualOverrides ?? []) {
    labelByKey.set(pointKey(ref.sourceId, ref.objectId), ref);
  }

  for (const point of input.points) {
    const key = pointKey(point.sourceId, point.objectId);
    if (labelByKey.has(key)) continue;

    const label = resolveInfraspawnPointLocationLabel({
      point,
      relatedPoints: input.points,
    });
    if (!label) continue;

    labelByKey.set(key, toFeaturedRef(point.sourceId, point.objectId, label));
  }

  const pointDisplayOverrides = [...labelByKey.values()];

  if (input.manualFeatured?.length) {
    return {
      pointDisplayOverrides,
      featuredPointRefs: [...input.manualFeatured],
    };
  }

  const featuredPointRefs = inferAutoFeaturedPointRefs(
    input.points,
    pointDisplayOverrides,
  );

  return { pointDisplayOverrides, featuredPointRefs };
}

function inferAutoFeaturedPointRefs(
  points: readonly InfraspawnPointListItem[],
  overrides: readonly SdAnleggFeaturedPointRef[],
): SdAnleggFeaturedPointRef[] {
  const overrideByKey = new Map(
    overrides.map((ref) => [pointKey(ref.sourceId, ref.objectId), ref]),
  );

  const candidates = points
    .filter((point) => point.statusInAlarm)
    .map((point) => {
      const override = overrideByKey.get(pointKey(point.sourceId, point.objectId));
      const label =
        override?.label ??
        resolveInfraspawnPointLocationLabel({
          point,
          relatedPoints: points,
        });
      return label ? toFeaturedRef(point.sourceId, point.objectId, label) : null;
    })
    .filter((ref): ref is SdAnleggFeaturedPointRef => ref != null);

  return candidates.slice(0, 1);
}
