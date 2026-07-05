import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prisma } from "@/lib/db";
import type { MpcBuildingPreferencesOverrides } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";

export type PersistedMpcBuildingPreferences = {
  version: 1;
  buildingSlug: string;
  unitKey: string;
  updatedAt: string;
  overrides: MpcBuildingPreferencesOverrides;
};

function preferencesPath(buildingSlug: string): string {
  return resolve(
    process.cwd(),
    "../data/buildings",
    buildingSlug,
    "mpc-preferences.json",
  );
}

async function loadFromFile(
  buildingSlug: string,
): Promise<MpcBuildingPreferencesOverrides | null> {
  try {
    const raw = await readFile(preferencesPath(buildingSlug), "utf8");
    const parsed = JSON.parse(raw) as PersistedMpcBuildingPreferences;
    if (parsed.version !== 1 || parsed.buildingSlug !== buildingSlug) {
      return null;
    }
    return parsed.overrides ?? null;
  } catch {
    return null;
  }
}

async function loadFromDb(
  buildingId: string,
): Promise<MpcBuildingPreferencesOverrides | null> {
  try {
    const row = await prisma.sdAnleggMpcPreferences.findUnique({
      where: { buildingId },
      select: { overrides: true },
    });
    if (!row?.overrides) return null;
    return row.overrides as MpcBuildingPreferencesOverrides;
  } catch {
    return null;
  }
}

export async function loadMpcBuildingPreferencesOverrides(
  buildingSlug: string,
  buildingId?: string,
): Promise<MpcBuildingPreferencesOverrides | null> {
  if (buildingId) {
    const fromDb = await loadFromDb(buildingId);
    if (fromDb) return fromDb;
  }
  return loadFromFile(buildingSlug);
}

export async function saveMpcBuildingPreferencesOverrides(input: {
  buildingSlug: string;
  buildingId?: string;
  unitKey: string;
  overrides: MpcBuildingPreferencesOverrides;
}): Promise<PersistedMpcBuildingPreferences> {
  const payload: PersistedMpcBuildingPreferences = {
    version: 1,
    buildingSlug: input.buildingSlug,
    unitKey: input.unitKey,
    updatedAt: new Date().toISOString(),
    overrides: input.overrides,
  };

  if (input.buildingId) {
    await prisma.sdAnleggMpcPreferences.upsert({
      where: { buildingId: input.buildingId },
      create: {
        buildingId: input.buildingId,
        unitKey: input.unitKey,
        overrides: input.overrides,
      },
      update: {
        unitKey: input.unitKey,
        overrides: input.overrides,
      },
    });
  }

  const path = preferencesPath(input.buildingSlug);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}
