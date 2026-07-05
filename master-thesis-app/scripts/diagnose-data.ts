#!/usr/bin/env bun
import "dotenv/config";
import { prisma } from "../lib/db";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";

async function main() {
  const slug = resolveBuildingSlug();
  console.log("BUILDING_SLUG:", slug);

  const building = await prisma.building.findFirst({
        where: { slug },
        select: { id: true, slug: true, name: true },
      });
  console.log("Building:", building);

  const sources = await prisma.infraspawnSource.findMany({
    where: { isActive: true },
    select: {
      id: true,
      label: true,
      lastSyncAt: true,
      syncState: { select: { watermarkAt: true, lastRunAt: true, status: true } },
      _count: { select: { samples: true, pointMeta: true } },
    },
  });
  console.log("\nInfraspawn sources:");
  for (const s of sources) {
    console.log(JSON.stringify(s, null, 2));
  }

  if (building) {
    const bhcc = await prisma.buildingHourlyCostCache.count({
      where: { buildingId: building.id },
    });
    const obs = await prisma.observation.count({
      where: {
        meteringPoint: {
          OR: [
            { buildingId: building.id },
            { buildingLinks: { some: { buildingId: building.id } } },
          ],
        },
      },
    });
    const dh = await prisma.districtHeatingMeasurement.count({
      where: {
        meteringPoint: {
          OR: [
            { buildingId: building.id },
            { buildingLinks: { some: { buildingId: building.id } } },
          ],
        },
      },
    });
    const hourlyPrices = await prisma.hourlyEnergyPrices.count({
      where: { areaCode: process.env.NEXT_PUBLIC_PRICE_AREA ?? "NO3" },
    });
    const simRuns = await prisma.sdAnleggMpcSimulationJob.count({
      where: { buildingId: building.id },
    });
    console.log("\nBuilding data:");
    console.log({ bhcc, obs, dh, hourlyPrices, simRuns });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
