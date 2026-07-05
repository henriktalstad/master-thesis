import "server-only";

import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { prisma } from "@/lib/db";
import {
  recentOsloDayRefreshStart,
  resolveBhccSyncWindow,
} from "@/lib/energy/bhcc-sync-window";
import { getOrRefreshAccessTokenForIntegration } from "@/lib/statkraft/auth";
import { syncMeteringPointFromStatkraft } from "@/lib/statkraft/sync-metering-point";
import type { StatkraftSyncResult } from "@/lib/statkraft/types";
import { getIntegrationCredentials } from "@/services/integrations/manager";

export type SyncStatkraftDistrictHeatingResult = {
  success: boolean;
  skipped: boolean;
  integrationId: string | null;
  meteringPointCount: number;
  measurementsUpserted: number;
  windowStart: string;
  windowEndExclusive: string;
  message: string;
  results: StatkraftSyncResult[];
  failedMpids: string[];
};

export async function syncStatkraftDistrictHeating(input?: {
  buildingSlug?: string;
  windowStart?: Date;
  windowEndExclusive?: Date;
  pauseBetweenIntervalsMs?: number;
}): Promise<SyncStatkraftDistrictHeatingResult> {
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
      measurementsUpserted: 0,
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
      type: "HEAT",
      integration: { provider: "STATKRAFT", status: "ACTIVE" },
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
      measurementsUpserted: 0,
      windowStart: refreshFrom.toISOString(),
      windowEndExclusive: refreshEndExclusive.toISOString(),
      message:
        "Ingen aktiv STATKRAFT-integrasjon — BHCC bruker eksisterende district_heating_measurements",
      results: [],
      failedMpids: [],
    };
  }

  let credentials;
  try {
    credentials = await getIntegrationCredentials(integrationId);
  } catch (error) {
    return {
      success: false,
      skipped: false,
      integrationId,
      meteringPointCount: meteringPoints.length,
      measurementsUpserted: 0,
      windowStart: refreshFrom.toISOString(),
      windowEndExclusive: refreshEndExclusive.toISOString(),
      message:
        error instanceof Error ? error.message : "Statkraft credentials mangler",
      results: [],
      failedMpids: meteringPoints.map((mp) => mp.mpid),
    };
  }

  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });

  let accessToken = "";
  const refreshToken = async () => {
    const refreshed = await getOrRefreshAccessTokenForIntegration(
      integrationId,
      credentials.subscriptionKey!,
    );
    accessToken = refreshed.token;
  };

  try {
    await refreshToken();
  } catch (error) {
    return {
      success: false,
      skipped: false,
      integrationId,
      meteringPointCount: meteringPoints.length,
      measurementsUpserted: 0,
      windowStart: refreshFrom.toISOString(),
      windowEndExclusive: refreshEndExclusive.toISOString(),
      message:
        error instanceof Error
          ? error.message
          : "Statkraft autentisering feilet",
      results: [],
      failedMpids: meteringPoints.map((mp) => mp.mpid),
    };
  }

  const results: StatkraftSyncResult[] = [];
  let measurementsUpserted = 0;

  for (const mp of meteringPoints) {
    let result = await syncMeteringPointFromStatkraft({
      integrationId,
      meteringPointId: mp.id,
      mpid: mp.mpid,
      windowStart: refreshFrom,
      windowEndExclusive: refreshEndExclusive,
      accessToken,
      subscriptionKey: credentials.subscriptionKey!,
      pauseBetweenIntervalsMs: input?.pauseBetweenIntervalsMs,
      onAuthError: refreshToken,
    });

    if (
      !result.success &&
      (result.error?.includes("401") || result.error?.includes("403"))
    ) {
      await refreshToken();
      result = await syncMeteringPointFromStatkraft({
        integrationId,
        meteringPointId: mp.id,
        mpid: mp.mpid,
        windowStart: refreshFrom,
        windowEndExclusive: refreshEndExclusive,
        accessToken,
        subscriptionKey: credentials.subscriptionKey!,
        pauseBetweenIntervalsMs: input?.pauseBetweenIntervalsMs,
      });
    }

    results.push(result);
    if (result.success) {
      measurementsUpserted += result.newMeasurements;
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
    results.some(
      (r) => r.error?.includes("401") || r.error?.includes("403"),
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
    measurementsUpserted,
    windowStart: refreshFrom.toISOString(),
    windowEndExclusive: refreshEndExclusive.toISOString(),
    message: allSucceeded
      ? `Synket ${measurementsUpserted} FV-målinger for ${meteringPoints.length} målepunkt(er)`
      : `Feil for ${failedMpids.length} målepunkt(er): ${failedMpids.join(", ")}`,
    results,
    failedMpids,
  };
}
