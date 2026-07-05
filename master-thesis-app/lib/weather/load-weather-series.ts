import "server-only";

import { prisma } from "@/lib/db";
import {
  type WeatherPeriod,
  type WeatherPoint,
  type WeatherPurpose,
  type WeatherResolution,
  targetStepMs,
} from "@/lib/weather/weather-contract";
import { getBuildingWeatherBinding } from "@/lib/weather/ensure-pinned-station";
import { resampleWeatherPoints } from "@/lib/weather/resample-weather";

const PT1H_ELEMENT_IDS = ["air_temperature", "mean(air_temperature PT1H)"] as const;

function periodWhere(period: WeatherPeriod): { gte?: Date; lte?: Date } {
  if (period.kind === "since") {
    return { gte: period.since };
  }
  return { gte: period.start, lte: period.end };
}

async function findBestSeries(stationId: string, preferResolution?: string) {
  const resolutions = preferResolution
    ? [preferResolution, "PT10M", "PT15M", "PT1H"]
    : ["PT10M", "PT15M", "PT1H"];

  for (const resolution of resolutions) {
    const series = await prisma.weatherSeries.findFirst({
      where: {
        stationId,
        resolution,
        elementId: { in: [...PT1H_ELEMENT_IDS] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, resolution: true, elementId: true },
    });
    if (series) return series;
  }

  return prisma.weatherSeries.findFirst({
    where: {
      stationId,
      elementId: { in: [...PT1H_ELEMENT_IDS] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, resolution: true, elementId: true },
  });
}

export async function loadWeatherSeries(input: {
  buildingId: string;
  period: WeatherPeriod;
  purpose?: WeatherPurpose;
}): Promise<WeatherPoint[]> {
  const purpose = input.purpose ?? "display";
  const binding = await getBuildingWeatherBinding(input.buildingId);
  if (!binding?.stationId) return [];

  const series = await findBestSeries(
    binding.stationId,
    binding.primaryResolution,
  );
  if (!series?.id) return [];

  const timeFilter = periodWhere(input.period);
  const observations = await prisma.weatherObservation.findMany({
    where: {
      seriesId: series.id,
      referenceTime: timeFilter,
    },
    select: { referenceTime: true, value: true },
    orderBy: { referenceTime: "asc" },
  });

  const nativeResolution = series.resolution as WeatherResolution;
  const raw: WeatherPoint[] = observations
    .filter((row) => row.value != null)
    .map((row) => ({
      time: row.referenceTime.toISOString(),
      outdoorTempC: Math.round(Number(row.value) * 10) / 10,
      nativeResolution,
    }));

  const stepMs = targetStepMs(purpose);
  if (!stepMs || stepMs === 3_600_000) return raw;

  return resampleWeatherPoints(raw, stepMs, nativeResolution);
}

/** Kompatibilitet med ControlHourlyWeather (PT1H). */
export async function loadBuildingHourlyWeather(input: {
  buildingId: string;
  since: Date;
}): Promise<Array<{ hour: string; outdoorTempC: number | null }>> {
  const points = await loadWeatherSeries({
    buildingId: input.buildingId,
    period: { kind: "since", since: input.since },
    purpose: "display",
  });

  const byHour = new Map<string, number>();
  for (const p of points) {
    const d = new Date(p.time);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
    byHour.set(key, p.outdoorTempC);
  }

  return [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hourKey, outdoorTempC]) => ({
      hour: new Date(
        Date.UTC(
          Number(hourKey.slice(0, 4)),
          Number(hourKey.slice(5, 7)) - 1,
          Number(hourKey.slice(8, 10)),
          Number(hourKey.slice(11, 13)),
          0,
          0,
          0,
        ),
      ).toISOString(),
      outdoorTempC,
    }));
}

export async function getWeatherStationCoordinates(buildingId: string): Promise<{
  lat: number;
  lon: number;
  stationLabel: string | null;
} | null> {
  const binding = await getBuildingWeatherBinding(buildingId);
  if (!binding?.station) return null;
  return {
    lat: binding.station.lat,
    lon: binding.station.lon,
    stationLabel: binding.stationName ?? binding.station.name ?? binding.stationId,
  };
}
