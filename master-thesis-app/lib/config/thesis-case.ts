/**
 * Thesis case-bygg — én kilde når BUILDING_SLUG ikke er satt i .env.
 * Hold synk med BUILDING_CONTROL_PROFILE_360102.buildingSlug.
 */
export const THESIS_CASE_BUILDING_SLUG = "sorgenfriveien-32ab";

/** Eksplisitt arg → BUILDING_SLUG → NEXT_PUBLIC_BUILDING_SLUG → thesis-default. */
export function resolveBuildingSlug(explicit?: string | null): string {
  return (
    explicit?.trim() ||
    process.env.BUILDING_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_BUILDING_SLUG?.trim() ||
    THESIS_CASE_BUILDING_SLUG
  );
}

export function resolveBuildingId(explicit?: string | null): string | undefined {
  return explicit?.trim() || process.env.BUILDING_ID?.trim() || undefined;
}
