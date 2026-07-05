import { ensurePrismaConnection, prisma, withPrismaRetry } from "@/lib/db";
import { resolveBuildingId, resolveBuildingSlug } from "@/lib/config/thesis-case";

export type MpcBuildingSourceContext = {
  buildingId: string;
  buildingSlug: string;
  sourceId: string;
};

export async function resolveMpcBuildingSource(input?: {
  buildingSlug?: string;
  buildingId?: string;
  sourceId?: string;
}): Promise<MpcBuildingSourceContext | null> {
  const buildingSlug = resolveBuildingSlug(input?.buildingSlug);
  const buildingId = resolveBuildingId(input?.buildingId);
  const envSourceId = process.env.INFRASPAWN_SOURCE_ID?.trim();

  await ensurePrismaConnection();

  const building = await withPrismaRetry(() =>
    prisma.building.findFirst({
      where: buildingId
        ? { id: buildingId }
        : { slug: buildingSlug },
      select: { id: true, slug: true },
    }),
  );
  if (!building) return null;

  const sourceId =
    input?.sourceId ??
    envSourceId ??
    (
      await withPrismaRetry(() =>
        prisma.infraspawnSource.findFirst({
          where: { buildingId: building.id, isActive: true },
          select: { id: true },
          orderBy: { label: "asc" },
        }),
      )
    )?.id;

  if (!sourceId || !building.slug) return null;
  return { buildingId: building.id, buildingSlug: building.slug, sourceId };
}
