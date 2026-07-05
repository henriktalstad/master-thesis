import "server-only";

import { prisma } from "@/lib/db";
import { getMpcGapFillMaxSteps } from "@/lib/config/thesis-eval";
import { getBuildingWeatherBinding } from "@/lib/weather/ensure-pinned-station";
import type { EvalDatasetProvenance } from "@/lib/sd-anlegg/mpc/shared/types";
import { resolveSampleObjectIdAliasesForMpc as resolveSampleObjectIdAliases } from "./resolve-sample-object-ids";

export async function loadMpcDatasetProvenance(input: {
  buildingId: string;
  sourceId: string;
  evalStart: Date;
  evalEnd: Date;
  sampleObjectIds: readonly string[];
  areaCode: string | null;
}): Promise<EvalDatasetProvenance> {
  const aliasMap = await resolveSampleObjectIdAliases(
    input.sourceId,
    [...input.sampleObjectIds],
  );
  const objectIds = [
    ...new Set(input.sampleObjectIds.map((id) => aliasMap.get(id) ?? id)),
  ];

  const [bacnetSampleStats, weatherObservationCount, hourlyPriceCount, energyRowCount, alarmEventCount] =
    await Promise.all([
      Promise.all([
        prisma.infraspawnBacnetSample.count({
          where: {
            sourceId: input.sourceId,
            objectId: { in: objectIds },
            resolution: "15m",
            sampledAt: { gte: input.evalStart, lte: input.evalEnd },
          },
        }),
        prisma.infraspawnBacnetSample.findFirst({
          where: {
            sourceId: input.sourceId,
            objectId: { in: objectIds },
            resolution: "15m",
            sampledAt: { gte: input.evalStart, lte: input.evalEnd },
          },
          orderBy: { sampledAt: "desc" },
          select: { sampledAt: true },
        }),
      ]).then(([rowCount, latest]) => ({
        rowCount,
        latestSampleAt: latest?.sampledAt.toISOString() ?? null,
      })),
      (async () => {
        const binding = await getBuildingWeatherBinding(input.buildingId);
        if (!binding?.stationId) return 0;
        const series = await prisma.weatherSeries.findFirst({
          where: {
            stationId: binding.stationId,
            elementId: { in: ["air_temperature", "mean(air_temperature PT1H)"] },
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });
        if (!series) return 0;
        return prisma.weatherObservation.count({
          where: {
            seriesId: series.id,
            referenceTime: { gte: input.evalStart, lte: input.evalEnd },
          },
        });
      })(),
      input.areaCode
        ? prisma.hourlyEnergyPrices.count({
            where: {
              areaCode: input.areaCode,
              date: { gte: input.evalStart, lte: input.evalEnd },
            },
          })
        : Promise.resolve(0),
      prisma.buildingHourlyCostCache.count({
        where: {
          buildingId: input.buildingId,
          hour: { gte: input.evalStart, lte: input.evalEnd },
        },
      }),
      prisma.infraspawnAlarmEvent.count({
        where: {
          buildingId: input.buildingId,
          kind: "ALARM",
          activatedAt: { lte: input.evalEnd },
          OR: [{ clearedAt: null }, { clearedAt: { gt: input.evalStart } }],
        },
      }),
    ]);

  return {
    primarySource: "postgres",
    tables: {
      infraspawnBacnetSample: bacnetSampleStats,
      weatherObservation: { rowCount: weatherObservationCount },
      hourlyEnergyPrices: { rowCount: hourlyPriceCount },
      buildingHourlyCostCache: { rowCount: energyRowCount },
      infraspawnAlarmEvent: { rowCount: alarmEventCount },
    },
    gapFillApplied: getMpcGapFillMaxSteps() > 0,
  };
}
