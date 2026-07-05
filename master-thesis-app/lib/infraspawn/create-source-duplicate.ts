import "server-only";

import { prisma } from "@/lib/db";
import {
  INFRASPAWN_SOURCE_ALREADY_EXISTS_MESSAGE,
  alreadyExistsInfraspawnSourceResult,
  type CreateInfraspawnSourceResult,
} from "@/lib/infraspawn/create-source-outcome";

type DuplicateCreateOutcome = Extract<
  CreateInfraspawnSourceResult,
  { outcome: "already_exists" }
>;

export async function findInfraspawnSourceByDatabase(
  integrationId: string,
  influxDatabase: string,
) {
  return prisma.infraspawnSource.findUnique({
    where: {
      integrationId_influxDatabase: { integrationId, influxDatabase },
    },
    select: {
      label: true,
      building: { select: { name: true } },
    },
  });
}

export async function resolveInfraspawnSourceDuplicateOutcome(
  integrationId: string,
  influxDatabase: string,
): Promise<DuplicateCreateOutcome | null> {
  const existing = await findInfraspawnSourceByDatabase(
    integrationId,
    influxDatabase,
  );
  if (!existing) return null;
  return alreadyExistsInfraspawnSourceResult({
    label: existing.label,
    buildingName: existing.building?.name ?? null,
  });
}

export async function resolveInfraspawnSourceDuplicateOutcomeOrFallback(
  integrationId: string,
  influxDatabase: string,
): Promise<DuplicateCreateOutcome> {
  return (
    (await resolveInfraspawnSourceDuplicateOutcome(
      integrationId,
      influxDatabase,
    )) ?? {
      outcome: "already_exists",
      message: INFRASPAWN_SOURCE_ALREADY_EXISTS_MESSAGE,
    }
  );
}
