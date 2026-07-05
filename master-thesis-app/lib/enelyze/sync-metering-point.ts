import { generateEnelyzeIntervals } from "@/lib/enelyze/chunk-time-range";
import { fetchMeteringVolumes } from "@/lib/enelyze/client";
import {
  dedupeMappedObservations,
  mapEnelyzeObservation,
} from "@/lib/enelyze/map-observation";
import type { EnelyzeSyncResult, MappedEnelyzeObservation } from "@/lib/enelyze/types";
import { prisma } from "@/lib/db";

const BATCH_SIZE = 100;

export async function persistEnelyzeObservations(input: {
  meteringPointId: string;
  windowStart: Date;
  windowEndExclusive: Date;
  rows: MappedEnelyzeObservation[];
}): Promise<number> {
  const { meteringPointId, windowStart, windowEndExclusive, rows } = input;

  await prisma.observation.deleteMany({
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
      direction: row.direction,
      method: row.method,
      volume_kwh: row.volume_kwh,
    }));
    const result = await prisma.observation.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
  }

  return inserted;
}

export async function syncMeteringPointFromEnelyze(input: {
  meteringPointId: string;
  mpid: string;
  windowStart: Date;
  windowEndExclusive: Date;
  apiKey?: string;
  pauseBetweenIntervalsMs?: number;
}): Promise<EnelyzeSyncResult> {
  const {
    meteringPointId,
    mpid,
    windowStart,
    windowEndExclusive,
    apiKey,
    pauseBetweenIntervalsMs = 0,
  } = input;

  try {
    const intervals = generateEnelyzeIntervals(windowStart, windowEndExclusive);
    const allRows: MappedEnelyzeObservation[] = [];
    let totalFromApi = 0;

    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i]!;
      const data = await fetchMeteringVolumes(
        mpid,
        interval.start,
        interval.end,
        { apiKey },
      );
      totalFromApi += data.observations.length;

      for (const obs of data.observations) {
        const mapped = mapEnelyzeObservation(obs);
        if (mapped) allRows.push(mapped);
      }

      if (
        pauseBetweenIntervalsMs > 0 &&
        i < intervals.length - 1
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, pauseBetweenIntervalsMs),
        );
      }
    }

    const rows = dedupeMappedObservations(allRows);
    const inserted = await persistEnelyzeObservations({
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
      totalObservations: totalFromApi,
      newObservations: inserted,
      skippedObservations: Math.max(0, totalFromApi - inserted),
    };
  } catch (error) {
    return {
      success: false,
      mpid,
      error: error instanceof Error ? error.message : String(error),
      totalObservations: 0,
      newObservations: 0,
      skippedObservations: 0,
    };
  }
}
