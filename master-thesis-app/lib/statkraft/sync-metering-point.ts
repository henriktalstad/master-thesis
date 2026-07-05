import { generateEnelyzeIntervals } from "@/lib/enelyze/chunk-time-range";
import { StatkraftAuthError, invalidateIntegrationToken } from "@/lib/statkraft/auth";
import {
  fetchStatkraftMeterValues,
  formatStatkraftIso,
} from "@/lib/statkraft/client";
import {
  filterMeasurementsInWindow,
  mapStatkraftMeterValues,
} from "@/lib/statkraft/parse-values";
import {
  STATKRAFT_DEFAULT_QUANTITIES,
  type StatkraftSyncResult,
  type MappedDistrictHeatingMeasurement,
} from "@/lib/statkraft/types";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/client/client";

const BATCH_SIZE = 100;

export async function persistDistrictHeatingMeasurements(input: {
  meteringPointId: string;
  windowStart: Date;
  windowEndExclusive: Date;
  rows: MappedDistrictHeatingMeasurement[];
}): Promise<number> {
  const { meteringPointId, windowStart, windowEndExclusive, rows } = input;

  await prisma.districtHeatingMeasurement.deleteMany({
    where: {
      meteringPointId,
      utcTime: {
        gte: windowStart,
        lt: windowEndExclusive,
      },
    },
  });

  if (rows.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((row) => ({
      meteringPointId,
      time: row.time,
      utcTime: row.utcTime,
      energyKwh: row.energyKwh,
      flowM3h: row.flowM3h,
      forwardTempC: row.forwardTempC,
      returnTempC: row.returnTempC,
      diffTempK: row.diffTempK,
      volumeM3: row.volumeM3,
      resolution: row.resolution,
      metadata: row.metadata as Prisma.InputJsonValue,
    }));
    const result = await prisma.districtHeatingMeasurement.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
  }

  return inserted;
}

export async function syncMeteringPointFromStatkraft(input: {
  integrationId: string;
  meteringPointId: string;
  mpid: string;
  windowStart: Date;
  windowEndExclusive: Date;
  accessToken: string;
  subscriptionKey: string;
  pauseBetweenIntervalsMs?: number;
  onAuthError?: () => Promise<void>;
}): Promise<StatkraftSyncResult> {
  const {
    integrationId,
    meteringPointId,
    mpid,
    windowStart,
    windowEndExclusive,
    accessToken,
    subscriptionKey,
    pauseBetweenIntervalsMs = 0,
    onAuthError,
  } = input;

  try {
    const intervals = generateEnelyzeIntervals(windowStart, windowEndExclusive);
    const allRows: MappedDistrictHeatingMeasurement[] = [];
    let totalFromApi = 0;

    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i]!;
      let meterValues;
      try {
        meterValues = await fetchStatkraftMeterValues(
          accessToken,
          subscriptionKey,
          {
            ids: [mpid],
            reportAfter: formatStatkraftIso(interval.start),
            reportBefore: formatStatkraftIso(interval.end),
            quantities: STATKRAFT_DEFAULT_QUANTITIES,
            resolution: "hour",
          },
        );
      } catch (error) {
        if (error instanceof StatkraftAuthError) {
          await invalidateIntegrationToken(integrationId);
          await onAuthError?.();
        }
        throw error;
      }

      const mapped = mapStatkraftMeterValues(
        meterValues,
        STATKRAFT_DEFAULT_QUANTITIES,
      );
      totalFromApi += mapped.length;
      allRows.push(...mapped);

      if (pauseBetweenIntervalsMs > 0 && i < intervals.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, pauseBetweenIntervalsMs),
        );
      }
    }

    const rows = filterMeasurementsInWindow(
      allRows,
      windowStart,
      windowEndExclusive,
    );
    const inserted = await persistDistrictHeatingMeasurements({
      meteringPointId,
      windowStart,
      windowEndExclusive,
      rows,
    });

    await prisma.meteringPoint.update({
      where: { id: meteringPointId },
      data: { lastFetchedAt: new Date() },
    });

    return {
      success: true,
      mpid,
      message: "Synk fullført",
      totalMeasurements: totalFromApi,
      newMeasurements: inserted,
      skippedMeasurements: Math.max(0, totalFromApi - inserted),
    };
  } catch (error) {
    return {
      success: false,
      mpid,
      error: error instanceof Error ? error.message : String(error),
      totalMeasurements: 0,
      newMeasurements: 0,
      skippedMeasurements: 0,
    };
  }
}
