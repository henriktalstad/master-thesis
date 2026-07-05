import "server-only";

import { prisma } from "@/lib/db";
import type { InfraspawnBuildingNavItem } from "@/lib/infraspawn/building-nav-items";

export async function fetchInfraspawnBuildingNavItems(
  integrationId: string,
): Promise<InfraspawnBuildingNavItem[]> {
  const sources = await prisma.infraspawnSource.findMany({
    where: { integrationId },
    select: {
      buildingId: true,
      building: { select: { id: true, name: true, slug: true } },
    },
  });

  const byBuilding = new Map<string, InfraspawnBuildingNavItem>();
  for (const source of sources) {
    if (!source.building?.slug) continue;
    const existing = byBuilding.get(source.buildingId);
    if (existing) {
      existing.sourceCount += 1;
      continue;
    }
    byBuilding.set(source.buildingId, {
      buildingId: source.building.id,
      buildingName: source.building.name,
      buildingSlug: source.building.slug,
      sourceCount: 1,
    });
  }

  return [...byBuilding.values()].sort((a, b) =>
    a.buildingName.localeCompare(b.buildingName, "nb"),
  );
}
