import "server-only";

import { prisma } from "@/lib/db";
import { hasDatabaseUrl } from "@/prisma/env";
import { getDefaultBuildingSlug } from "@/lib/config/env";
import type { ThesisBuildingContext } from "@/lib/infraspawn/types";

export type ThesisBuildingReadResult =
  | { ok: true; context: ThesisBuildingContext }
  | { ok: false; error: string };

export async function resolveThesisBuildingContext(
  buildingSlug = getDefaultBuildingSlug(),
): Promise<ThesisBuildingReadResult> {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL mangler" };
  }

  const building = await prisma.building.findFirst({
    where: { slug: buildingSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      infraspawnSources: {
        where: { isActive: true },
        select: { id: true, label: true, integrationId: true },
        orderBy: { label: "asc" },
      },
    },
  });

  if (!building?.slug) {
    return {
      ok: false,
      error: `Fant ikke bygg med slug «${buildingSlug}»`,
    };
  }

  return {
    ok: true,
    context: {
      buildingId: building.id,
      buildingName: building.name,
      buildingSlug: building.slug,
      sources: building.infraspawnSources,
    },
  };
}
