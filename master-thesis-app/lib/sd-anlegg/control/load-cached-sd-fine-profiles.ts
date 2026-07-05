import "server-only";

import { unstable_cache } from "next/cache";
import { loadSdFineCalibrationHistory } from "@/lib/sd-anlegg/control/load-sd-signal-history";
import {
  resolveSourceInfluxCredentials,
  type InfraspawnSourceCredentialRow,
} from "@/services/infraspawn/source-influx-credentials";
import { prisma } from "@/lib/db";
import { listInfraspawnPointsForBuilding } from "@/lib/infraspawn/read-points";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import type { ControlSdHourlyProfile } from "@/lib/sd-anlegg/control/control-sd-calibration";
import type { SdCalibrationCanonicalId } from "@/lib/sd-anlegg/control/sd-calibration-ids";

async function resolveInfluxForSource(sourceId: string) {
  const source = await prisma.infraspawnSource.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      influxDatabase: true,
      apiTokenEncrypted: true,
      metadata: true,
    },
  });
  if (!source) return null;

  const credRow: InfraspawnSourceCredentialRow = {
    id: source.id,
    influxDatabase: source.influxDatabase,
    apiTokenEncrypted: source.apiTokenEncrypted,
    metadata: source.metadata,
  };
  return resolveSourceInfluxCredentials([credRow]).get(source.id) ?? null;
}

type FineSdCacheResult = {
  profiles: ControlSdHourlyProfile[];
  seriesCoveragePct: number;
  loadedCanonicalIds: SdCalibrationCanonicalId[];
};

async function loadSdFineProfilesUncached(input: {
  buildingSlug: string;
  sourceId: string;
  hours: number;
  stepMinutes: 1 | 5;
}): Promise<FineSdCacheResult> {
  const access = await resolveInfraspawnBuildingForRead(input.buildingSlug);
  if (!access.ok) {
    return { profiles: [], seriesCoveragePct: 0, loadedCanonicalIds: [] };
  }

  const points = await listInfraspawnPointsForBuilding(
    access.integration.id,
    access.building.id,
  );
  const influx = await resolveInfluxForSource(input.sourceId);
  if (!influx) {
    return { profiles: [], seriesCoveragePct: 0, loadedCanonicalIds: [] };
  }

  return loadSdFineCalibrationHistory({
    sourceId: input.sourceId,
    points,
    hours: input.hours,
    stepMinutes: input.stepMinutes,
    influx,
  });
}

/** Kort TTL-cache — reduserer Influx ved grain=1/5. */
export function loadCachedSdFineProfiles(input: {
  buildingSlug: string;
  buildingId: string;
  sourceId: string;
  hours: number;
  stepMinutes: 1 | 5;
}): Promise<FineSdCacheResult> {
  const revalidate = input.stepMinutes === 1 ? 45 : 90;
  return unstable_cache(
    () =>
      loadSdFineProfilesUncached({
        buildingSlug: input.buildingSlug,
        sourceId: input.sourceId,
        hours: input.hours,
        stepMinutes: input.stepMinutes,
      }),
    [
      "sd-fine-profiles",
      input.buildingId,
      String(input.stepMinutes),
      String(input.hours),
    ],
    {
      revalidate,
      tags: [
        `sd-fine:${input.buildingId}`,
        `sd-fine:${input.buildingId}:${input.stepMinutes}`,
      ],
    },
  )();
}

/** Cache i Next.js; direkte Influx utenfor request-kontekst (CLI/scripts). */
export async function loadSdFineProfilesForControl(input: {
  buildingSlug: string;
  buildingId: string;
  sourceId: string;
  hours: number;
  stepMinutes: 1 | 5;
}): Promise<FineSdCacheResult> {
  try {
    return await loadCachedSdFineProfiles(input);
  } catch {
    return loadSdFineProfilesUncached({
      buildingSlug: input.buildingSlug,
      sourceId: input.sourceId,
      hours: input.hours,
      stepMinutes: input.stepMinutes,
    });
  }
}
