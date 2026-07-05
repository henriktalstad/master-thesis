import { cache } from "react";
import {
  getInfraspawnBuildingWorkspaceAction,
  getSdAnleggSiteProfileAction,
} from "@/actions/infraspawn-read";
import { listInfraspawnBuildingsForNav } from "@/lib/infraspawn/building-nav";

export const getCachedSdAnleggBuildingWorkspace = cache(
  async (buildingSlug: string) =>
    getInfraspawnBuildingWorkspaceAction(buildingSlug),
);

export const getCachedSdAnleggSiteProfile = cache(async (buildingSlug: string) =>
  getSdAnleggSiteProfileAction(buildingSlug),
);

export const getCachedInfraspawnBuildingNav = cache(async () => {
  const { buildings } = await listInfraspawnBuildingsForNav();
  return buildings;
});
