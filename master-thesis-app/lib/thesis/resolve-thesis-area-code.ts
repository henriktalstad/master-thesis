import { prisma } from "@/lib/db";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import {
  getElectricityZoneForBuilding,
  toMinimalBuildingForZone,
} from "@/lib/utils";

const DEFAULT_AREA = "NO3";

export async function resolveThesisAreaCode(): Promise<string> {
  const slug = resolveBuildingSlug();
  if (slug) {
    const building = await prisma.building.findFirst({
      where: { slug },
      select: {
        region: true,
        postCode: true,
        municipalityNumber: true,
        municipalityName: true,
      },
    });
    if (building) {
      const { zone } = getElectricityZoneForBuilding(
        toMinimalBuildingForZone(building),
      );
      if (zone && zone !== "ukjent") return zone;
    }
  }
  return (
    process.env.THESIS_PRICE_AREA?.trim() ||
    process.env.NEXT_PUBLIC_PRICE_AREA?.trim() ||
    DEFAULT_AREA
  );
}
