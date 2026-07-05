import { cache } from "react";
import { notFound } from "next/navigation";
import { isCurrentUserAdmin, isOrgAdmin } from "@/actions/auth";
import {
  getCachedSdAnleggBuildingWorkspace,
  getCachedSdAnleggSiteProfile,
} from "@/lib/sd-anlegg/cached-building-data";
import { loadControlOpsSummary } from "@/lib/sd-anlegg/control/load-control-ops-summary";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";

/** Rask shell-data for layout og sider — uten MPC/styring-oppsummering. */
export const loadSdAnleggBuildingShellData = cache(async (buildingSlug: string) => {
  const [workspace, profileResult, superAdmin, orgAdmin] = await Promise.all([
    getCachedSdAnleggBuildingWorkspace(buildingSlug),
    getCachedSdAnleggSiteProfile(buildingSlug),
    isCurrentUserAdmin(),
    isOrgAdmin(),
  ]);

  if (!workspace.success || !profileResult.success) {
    notFound();
  }

  return {
    pageData: workspace.pageData,
    initialPoints: workspace.initialPoints,
    profile: profileResult.profile,
    canEditLayout: superAdmin || orgAdmin,
    canEditProfile: superAdmin || orgAdmin,
  };
});

/** MPC/styring-KPI — kan lastes i Suspense uten å blokkere layout. */
export const loadSdAnleggControlOpsSummaryForBuilding = cache(
  async (buildingSlug: string) => {
    const readAccess = await resolveInfraspawnBuildingForRead(buildingSlug);
    if (!readAccess.ok) return null;
    return loadControlOpsSummary(readAccess.building.id);
  },
);

/** @deprecated Bruk shell + evt. `loadSdAnleggControlOpsSummaryForBuilding`. */
export const loadSdAnleggBuildingPageData = cache(async (buildingSlug: string) => {
  const shell = await loadSdAnleggBuildingShellData(buildingSlug);
  const controlOpsSummary =
    await loadSdAnleggControlOpsSummaryForBuilding(buildingSlug);
  return { ...shell, controlOpsSummary };
});
