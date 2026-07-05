import "server-only";

import { getDefaultBuildingSlug, sdAnleggStyringPath } from "@/lib/config/env";
import { listInfraspawnBuildingsForNav } from "@/lib/infraspawn/building-nav";

/** Én inngang: env-slug, ellers eneste bygg i DB. Ingen byggvelger. */
export async function resolveSdAnleggEntryPath(): Promise<string | null> {
  const envSlug = getDefaultBuildingSlug();
  if (envSlug) {
    return sdAnleggStyringPath(envSlug);
  }

  const { buildings } = await listInfraspawnBuildingsForNav();
  if (buildings.length === 1) {
    return sdAnleggStyringPath(buildings[0]!.buildingSlug);
  }

  return null;
}
