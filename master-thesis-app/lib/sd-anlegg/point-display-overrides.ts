import { normalizeInfraspawnObjectId } from "@/lib/infraspawn/point-location-label";
import type { SdAnleggFeaturedPointRef } from "@/lib/sd-anlegg/site-profile-schema";

export function normalizePointDisplayObjectId(objectId: string): string {
  return normalizeInfraspawnObjectId(objectId);
}

export function findPointDisplayOverride(
  overrides: readonly SdAnleggFeaturedPointRef[],
  sourceId: string,
  objectId: string,
): SdAnleggFeaturedPointRef | null {
  const normalized = normalizePointDisplayObjectId(objectId);
  return (
    overrides.find(
      (entry) =>
        entry.sourceId === sourceId &&
        normalizePointDisplayObjectId(entry.objectId) === normalized,
    ) ?? null
  );
}

export function upsertPointDisplayOverride(
  existing: readonly SdAnleggFeaturedPointRef[],
  sourceId: string,
  objectId: string,
  label: string,
): SdAnleggFeaturedPointRef[] {
  const trimmedSourceId = sourceId.trim();
  const normalizedObjectId = normalizePointDisplayObjectId(objectId);
  const trimmedLabel = label.trim();

  const without = existing.filter(
    (entry) =>
      !(
        entry.sourceId === trimmedSourceId &&
        normalizePointDisplayObjectId(entry.objectId) === normalizedObjectId
      ),
  );

  if (!trimmedLabel) return without;

  return [
    ...without,
    {
      sourceId: trimmedSourceId,
      objectId: normalizedObjectId,
      label: trimmedLabel,
    },
  ];
}
