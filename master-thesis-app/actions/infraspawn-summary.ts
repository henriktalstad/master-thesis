"use server";

import { prisma } from "@/lib/db";
import { getDefaultBuildingSlug } from "@/lib/config/env";
import { listInfraspawnBuildingsForNav } from "@/lib/infraspawn/building-nav";

export async function getInfraspawnOrgSummaryAction(): Promise<{
  hasIntegration: boolean;
  activeSourceCount: number;
  totalSamplesLast24h: number;
  soleBuildingSlug: string | null;
}> {
  const integration = await prisma.integration.findFirst({
    where: { provider: "INFRASPAWN" },
    select: { id: true },
  });

  if (!integration) {
    return {
      hasIntegration: false,
      activeSourceCount: 0,
      totalSamplesLast24h: 0,
      soleBuildingSlug: getDefaultBuildingSlug(),
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [activeSourceCount, totalSamplesLast24h, { buildings }] =
    await Promise.all([
      prisma.infraspawnSource.count({
        where: { integrationId: integration.id, isActive: true },
      }),
      prisma.infraspawnBacnetSample.count({
        where: { sampledAt: { gte: since } },
      }),
      listInfraspawnBuildingsForNav(),
    ]);
  const soleBuildingSlug =
    buildings.length === 1
      ? buildings[0]!.buildingSlug
      : getDefaultBuildingSlug();

  return {
    hasIntegration: activeSourceCount > 0 || Boolean(integration),
    activeSourceCount,
    totalSamplesLast24h,
    soleBuildingSlug,
  };
}
