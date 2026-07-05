import "server-only";

import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config/env";

export type InfraspawnReadOrg =
  | { ok: true; org: { id: string } }
  | { ok: false; error: string };

export type InfraspawnBuildingReadContext =
  | {
      ok: true;
      org: { id: string };
      building: { id: string; name: string; slug: string };
      integration: { id: string };
    }
  | { ok: false; error: string };

type IntegrationRef = { id: string; organizationId: string };

async function resolveIntegrationForBuilding(
  buildingId: string,
): Promise<IntegrationRef | null> {
  const config = getAppConfig();
  let integrationId: string | undefined;

  if (config.infraspawnSourceId) {
    const source = await prisma.infraspawnSource.findUnique({
      where: { id: config.infraspawnSourceId },
      select: { integrationId: true },
    });
    integrationId = source?.integrationId;
  }

  if (!integrationId) {
    const source = await prisma.infraspawnSource.findFirst({
      where: { buildingId, isActive: true },
      select: { integrationId: true },
      orderBy: { label: "asc" },
    });
    integrationId = source?.integrationId;
  }

  if (!integrationId) {
    return prisma.integration.findFirst({
      where: { provider: "INFRASPAWN" },
      select: { id: true, organizationId: true },
      orderBy: { createdAt: "asc" },
    });
  }

  return prisma.integration.findUnique({
    where: { id: integrationId },
    select: { id: true, organizationId: true },
  });
}

export async function requireInfraspawnReadOrg(): Promise<InfraspawnReadOrg> {
  const integration = await prisma.integration.findFirst({
    where: { provider: "INFRASPAWN" },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!integration) {
    return { ok: false, error: "Ingen Infraspawn-integrasjon i databasen" };
  }
  return { ok: true, org: { id: integration.organizationId } };
}

export async function resolveInfraspawnBuildingForRead(
  buildingSlug: string,
): Promise<InfraspawnBuildingReadContext> {
  const config = getAppConfig();
  const slug = buildingSlug.trim();
  if (!slug) {
    return { ok: false, error: "Mangler bygg-slug" };
  }

  const building = await prisma.building.findFirst({
    where: config.buildingId
      ? { OR: [{ slug }, { id: config.buildingId }] }
      : { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!building?.slug) {
    return { ok: false, error: "Bygget finnes ikke" };
  }

  const integration = await resolveIntegrationForBuilding(building.id);
  if (!integration) {
    return { ok: false, error: "Ingen Infraspawn-kilde funnet for bygget" };
  }

  return {
    ok: true,
    org: { id: integration.organizationId },
    building: { id: building.id, name: building.name, slug: building.slug },
    integration: { id: integration.id },
  };
}

export async function getInfraspawnBuildingDisplayName(
  buildingSlug: string,
): Promise<string | null> {
  const building = await prisma.building.findFirst({
    where: { slug: buildingSlug },
    select: { name: true },
  });
  return building?.name ?? null;
}
