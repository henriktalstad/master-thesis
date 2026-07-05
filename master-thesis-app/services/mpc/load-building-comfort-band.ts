import "server-only";

import { prisma } from "@/lib/db";

export async function loadBuildingComfortTargets(
  buildingId: string,
): Promise<unknown | null> {
  const row = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { comfortTargets: true },
  });
  return row?.comfortTargets ?? null;
}
