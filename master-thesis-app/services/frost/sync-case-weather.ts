import { prisma } from "@/lib/db";
import { hasFrostCredentials } from "@/lib/config/weather-env";
import { getWeatherConfig } from "@/lib/config/weather-env";
import {
  getObservationsWithStats,
  type FrostObservationItem,
} from "@/lib/frost";
import { resolveCaseBuilding } from "@/lib/weather/resolve-case-building";
import { ensurePinnedWeatherStation } from "@/lib/weather/ensure-pinned-station";
import {
  buildWeatherSeriesId,
  isoDate,
  monthChunks,
} from "@/lib/weather/weather-utils";
import { aggregateToHourlyMean } from "@/lib/weather/resample-weather";

export type SyncCaseWeatherResult = {
  ok: boolean;
  buildingId?: string;
  stationId?: string;
  stationName?: string | null;
  distanceKm?: number;
  series?: Array<{
    resolution: string;
    elementId: string;
    inserted: number;
    mode: "backfill" | "incremental";
  }>;
  error?: string;
};

function observationRows(
  items: FrostObservationItem[],
  seriesId: string,
): Array<{
  seriesId: string;
  referenceTime: Date;
  value: number | null;
  qualityCode: number | null;
}> {
  const rows: Array<{
    seriesId: string;
    referenceTime: Date;
    value: number | null;
    qualityCode: number | null;
  }> = [];

  for (const it of items) {
    const refStr = it.referenceTime ?? it.referencetime;
    if (!refStr) continue;
    const valRaw = it.observations?.[0]?.value ?? null;
    const val =
      valRaw == null ? null : Math.round(Number(valRaw) * 100) / 100;
    if (val != null && (val < -70 || val > 60)) continue;
    const q =
      it.observations?.[0]?.qualityCode ??
      it.observations?.[0]?.qualitycode ??
      null;
    rows.push({
      seriesId,
      referenceTime: new Date(refStr),
      value: val,
      qualityCode: q == null ? null : Number(q),
    });
  }
  return rows;
}

async function syncSeries(input: {
  stationId: string;
  sourceIdFull: string;
  elementId: string;
  resolution: string;
  backfillStart: Date;
  overlapDays: number;
}): Promise<{ inserted: number; mode: "backfill" | "incremental" }> {
  const seriesId = buildWeatherSeriesId({
    stationId: input.stationId,
    elementId: input.elementId,
    resolution: input.resolution,
  });

  await prisma.weatherSeries.upsert({
    where: { id: seriesId },
    create: {
      id: seriesId,
      stationId: input.stationId,
      elementId: input.elementId,
      resolution: input.resolution,
    },
    update: {},
  });

  const last = await prisma.weatherObservation.findFirst({
    where: { seriesId },
    orderBy: { referenceTime: "desc" },
    select: { referenceTime: true },
  });

  const now = new Date();
  const overlapMs = input.overlapDays * 24 * 60 * 60 * 1000;
  const mode: "backfill" | "incremental" = last ? "incremental" : "backfill";
  const incStart = last
    ? new Date(Math.max(last.referenceTime.getTime() - overlapMs, input.backfillStart.getTime()))
    : input.backfillStart;

  if (incStart >= now) {
    return { inserted: 0, mode };
  }

  const chunks = monthChunks(incStart, now);
  if (chunks.length === 0) {
    return { inserted: 0, mode };
  }

  const resp = await getObservationsWithStats({
    sources: [input.sourceIdFull],
    elements: input.elementId,
    referencetime: `${isoDate(incStart)}/${now.toISOString()}`,
    timechunks: chunks,
  });

  const rows = observationRows(resp.items ?? [], seriesId);
  if (rows.length === 0) {
    return { inserted: 0, mode };
  }

  const result = await prisma.weatherObservation.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { inserted: result.count, mode };
}

async function materializePt1hFromSubhourly(input: {
  stationId: string;
  subhourlySeriesId: string;
}): Promise<number> {
  const pt1hElement = "mean(air_temperature PT1H)";
  const pt1hSeriesId = buildWeatherSeriesId({
    stationId: input.stationId,
    elementId: pt1hElement,
    resolution: "PT1H",
  });

  await prisma.weatherSeries.upsert({
    where: { id: pt1hSeriesId },
    create: {
      id: pt1hSeriesId,
      stationId: input.stationId,
      elementId: pt1hElement,
      resolution: "PT1H",
    },
    update: {},
  });

  const lastPt1h = await prisma.weatherObservation.findFirst({
    where: { seriesId: pt1hSeriesId },
    orderBy: { referenceTime: "desc" },
    select: { referenceTime: true },
  });

  const since = lastPt1h
    ? new Date(lastPt1h.referenceTime.getTime() - 3 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 3);

  const subObs = await prisma.weatherObservation.findMany({
    where: {
      seriesId: input.subhourlySeriesId,
      referenceTime: { gte: since },
    },
    select: { referenceTime: true, value: true },
  });

  const hourly = aggregateToHourlyMean(
    subObs
      .filter((o) => o.value != null)
      .map((o) => ({ time: o.referenceTime, value: Number(o.value) })),
  );

  const rows = [...hourly.entries()].map(([referenceTime, value]) => ({
    seriesId: pt1hSeriesId,
    referenceTime: new Date(referenceTime),
    value,
    qualityCode: null,
  }));

  if (rows.length === 0) return 0;

  const result = await prisma.weatherObservation.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}

export async function syncCaseWeather(options?: {
  forceReselect?: boolean;
}): Promise<SyncCaseWeatherResult> {
  if (!hasFrostCredentials()) {
    return { ok: false, error: "FROST_CLIENT_ID mangler" };
  }

  const cfg = getWeatherConfig();
  const building = await resolveCaseBuilding();
  if (!building) {
    return { ok: false, error: "Fant ikke case-bygg (BUILDING_SLUG)" };
  }

  const binding = await ensurePinnedWeatherStation({
    building,
    forceReselect: options?.forceReselect,
  });

  const stationId = binding.stationId;
  const sourceIdFull = stationId;
  const now = new Date();

  const pt1hBackfill = new Date(now);
  pt1hBackfill.setFullYear(now.getFullYear() - cfg.syncYears);

  const subhourlyBackfill = new Date(now);
  subhourlyBackfill.setDate(now.getDate() - cfg.subhourlyDays);

  const elementId =
    binding.primaryResolution === "PT1H"
      ? "air_temperature"
      : "air_temperature";
  const resolution = binding.primaryResolution;

  const primary = await syncSeries({
    stationId,
    sourceIdFull,
    elementId,
    resolution,
    backfillStart:
      resolution === "PT1H" ? pt1hBackfill : subhourlyBackfill,
    overlapDays: cfg.incrementalOverlapDays,
  });

  const subSeriesId = buildWeatherSeriesId({
    stationId,
    elementId,
    resolution,
  });

  let pt1hInserted = 0;
  if (resolution !== "PT1H") {
    pt1hInserted = await materializePt1hFromSubhourly({
      stationId,
      subhourlySeriesId: subSeriesId,
    });
  }

  const lastObs = await prisma.weatherObservation.findFirst({
    where: { seriesId: { startsWith: `${stationId}|` } },
    orderBy: { referenceTime: "desc" },
    select: { referenceTime: true },
  });

  const firstObs = await prisma.weatherObservation.findFirst({
    where: { seriesId: { startsWith: `${stationId}|` } },
    orderBy: { referenceTime: "asc" },
    select: { referenceTime: true },
  });

  await prisma.buildingWeatherStation.update({
    where: { buildingId: building.buildingId },
    data: {
      lastObservationAt: lastObs?.referenceTime ?? null,
      firstObservationAt: firstObs?.referenceTime ?? null,
    },
  });

  const seriesResults = [
    {
      resolution,
      elementId,
      inserted: primary.inserted,
      mode: primary.mode,
    },
  ];

  if (pt1hInserted > 0) {
    seriesResults.push({
      resolution: "PT1H",
      elementId: "mean(air_temperature PT1H)",
      inserted: pt1hInserted,
      mode: "incremental" as const,
    });
  }

  return {
    ok: true,
    buildingId: building.buildingId,
    stationId,
    stationName: binding.stationName,
    distanceKm: binding.distanceKm,
    series: seriesResults,
  };
}
