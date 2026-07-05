import "server-only";

import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { prisma } from "@/lib/db";
import {
  recentOsloDayRefreshStart,
  resolveBhccSyncWindow,
} from "@/lib/energy/bhcc-sync-window";
import { getEnelyzeApiKey } from "@/lib/enelyze/client";
import { syncMeteringPointFromEnelyze } from "@/lib/enelyze/sync-metering-point";
import type { EnelyzeSyncResult } from "@/lib/enelyze/types";

export type SyncElhubElectricityResult = {
  success: boolean;
  skipped: boolean;
  integrationId: string | null;
  meteringPointCount: number;
  observationsUpserted: number;
  windowStart: string;
  windowEndExclusive: string;
  message: string;
  results: EnelyzeSyncResult[];
  failedMpids: string[];
};

export async function syncElhubElectricity(input?: {
  buildingSlug?: string;
  windowStart?: Date;
  windowEndExclusive?: Date;
  pauseBetweenIntervalsMs?: number;
}): Promise<SyncElhubElectricityResult> {
  const slug = resolveBuildingSlug(input?.buildingSlug);
  const window = resolveBhccSyncWindow();
  const refreshFrom =
    input?.windowStart ?? recentOsloDayRefreshStart(window.throughOsloYmd);
  const refreshEndExclusive = input?.windowEndExclusive ?? window.endExclusive;

  const building = await prisma.building.findFirst({
    where: { slug },
    select: { id: true },
  });

  if (!building) {
    return {
      success: false,
      skipped: true,
      integrationId: null,
      meteringPointCount: 0,
      observationsUpserted: 0,
      windowStart: refreshFrom.toISOString(),
      windowEndExclusive: refreshEndExclusive.toISOString(),
      message: "Bygg ikke funnet for slug",
      results: [],
      failedMpids: [],
    };
  }

  const meteringPoints = await prisma.meteringPoint.findMany({
    where: {
      isActive: true,
      type: "ELECTRICITY",
      integration: { provider: "ELHUB", status: "ACTIVE" },
      OR: [
        { buildingId: building.id },
        { buildingLinks: { some: { buildingId: building.id } } },
      ],
    },
    select: { id: true, mpid: true, integrationId: true },
  });

  const integrationId = meteringPoints[0]?.integrationId ?? null;

  if (!integrationId || meteringPoints.length === 0) {
    return {
      success: true,
      skipped: true,
      integrationId,
      meteringPointCount: meteringPoints.length,
      observationsUpserted: 0,
      windowStart: refreshFrom.toISOString(),
      windowEndExclusive: refreshEndExclusive.toISOString(),
      message:
        "Ingen aktiv ELHUB-integrasjon — BHCC bruker eksisterende observations (plattformkopi/DB)",
      results: [],
      failedMpids: [],
    };
  }

  const apiKey = getEnelyzeApiKey();
  if (!apiKey) {
    return {
      success: false,
      skipped: false,
      integrationId,
      meteringPointCount: meteringPoints.length,
      observationsUpserted: 0,
      windowStart: refreshFrom.toISOString(),
      windowEndExclusive: refreshEndExclusive.toISOString(),
      message: "ENELYZE_API_KEY mangler — sett nøkkel i .env",
      results: [],
      failedMpids: meteringPoints.map((mp) => mp.mpid),
    };
  }

  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });

  const results: EnelyzeSyncResult[] = [];
  let observationsUpserted = 0;

  for (const mp of meteringPoints) {
    const result = await syncMeteringPointFromEnelyze({
      meteringPointId: mp.id,
      mpid: mp.mpid,
      windowStart: refreshFrom,
      windowEndExclusive: refreshEndExclusive,
      apiKey,
      pauseBetweenIntervalsMs: input?.pauseBetweenIntervalsMs,
    });
    results.push(result);
    if (result.success) {
      observationsUpserted += result.newObservations;
    }
  }

  const failedMpids = results.filter((r) => !r.success).map((r) => r.mpid);
  const allSucceeded = failedMpids.length === 0;

  if (allSucceeded) {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastSuccessfulSyncAt: new Date(), status: "ACTIVE" },
    });
  } else if (
    results.some((r) =>
      r.error?.includes("401") || r.error?.includes("403"),
    )
  ) {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: "ERROR" },
    });
  }

  return {
    success: allSucceeded,
    skipped: false,
    integrationId,
    meteringPointCount: meteringPoints.length,
    observationsUpserted,
    windowStart: refreshFrom.toISOString(),
    windowEndExclusive: refreshEndExclusive.toISOString(),
    message: allSucceeded
      ? `Synket ${observationsUpserted} observasjoner for ${meteringPoints.length} målepunkt(er)`
      : `Feil for ${failedMpids.length} målepunkt(er): ${failedMpids.join(", ")}`,
    results,
    failedMpids,
  };
}
