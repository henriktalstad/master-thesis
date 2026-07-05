import "server-only";

import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config/env";

export type InfraspawnBuildingNavItem = {
  buildingId: string;
  buildingSlug: string;
  buildingName: string;
  sourceCount: number;
};

export async function listInfraspawnBuildingsForNav(): Promise<{
  buildings: InfraspawnBuildingNavItem[];
}> {
  const config = getAppConfig();

  if (config.buildingId || config.buildingSlug) {
    const building = await prisma.building.findFirst({
      where: config.buildingId
        ? { id: config.buildingId }
        : { slug: config.buildingSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        infraspawnSources: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });
    if (!building?.slug) return { buildings: [] };
    return {
      buildings: [
        {
          buildingId: building.id,
          buildingSlug: building.slug,
          buildingName: building.name,
          sourceCount: building.infraspawnSources.length,
        },
      ],
    };
  }

  const sources = await prisma.infraspawnSource.findMany({
    where: { isActive: true },
    select: {
      building: { select: { id: true, slug: true, name: true } },
    },
  });

  const byId = new Map<string, InfraspawnBuildingNavItem>();
  for (const row of sources) {
    const b = row.building;
    if (!b?.slug) continue;
    const existing = byId.get(b.id);
    if (existing) {
      existing.sourceCount += 1;
    } else {
      byId.set(b.id, {
        buildingId: b.id,
        buildingSlug: b.slug,
        buildingName: b.name,
        sourceCount: 1,
      });
    }
  }

  return {
    buildings: [...byId.values()].toSorted((a, b) =>
      a.buildingName.localeCompare(b.buildingName, "nb"),
    ),
  };
}
