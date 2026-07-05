import { prisma } from "@/lib/db";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { NAERBYEN_BUILDING_ANCHOR } from "@/lib/weather/weather-contract";

export type CaseBuildingAnchor = {
  buildingId: string;
  slug: string;
  name: string;
  lat: number;
  lon: number;
  municipalityNumber: string | null;
};

export async function resolveCaseBuilding(
  buildingSlug?: string | null,
): Promise<CaseBuildingAnchor | null> {
  const slug = resolveBuildingSlug(buildingSlug);

  const building = await prisma.building.findFirst({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      latitude: true,
      longitude: true,
      municipalityNumber: true,
    },
  });

  if (!building?.slug) return null;

  const lat =
    building.latitude ??
    NAERBYEN_BUILDING_ANCHOR.lat;
  const lon =
    building.longitude ??
    NAERBYEN_BUILDING_ANCHOR.lon;

  return {
    buildingId: building.id,
    slug: building.slug,
    name: building.name,
    lat,
    lon,
    municipalityNumber: building.municipalityNumber,
  };
}
