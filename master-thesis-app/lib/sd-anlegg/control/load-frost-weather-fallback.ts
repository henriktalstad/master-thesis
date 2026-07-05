import "server-only";

import { prisma } from "@/lib/db";
import { getBuildingWeatherBinding } from "@/lib/weather/ensure-pinned-station";
import type { ControlHourlyWeather } from "./control-types";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

export async function loadFrostHourOfDayWeatherFallback(input: {
  buildingId: string;
  hours?: number;
  nowMs?: number;
}): Promise<ControlHourlyWeather[]> {
  const hours = input.hours ?? 48;
  const nowMs = input.nowMs ?? Date.now();
  const binding = await getBuildingWeatherBinding(input.buildingId);
  if (!binding?.stationId) return [];

  const series = await prisma.weatherSeries.findFirst({
    where: {
      stationId: binding.stationId,
      elementId: { in: ["air_temperature", "mean(air_temperature PT1H)"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!series) return [];

  const since = new Date(nowMs - 14 * 86400000);
  const observations = await prisma.weatherObservation.findMany({
    where: {
      seriesId: series.id,
      referenceTime: { gte: since, lte: new Date(nowMs) },
      value: { not: null },
    },
    select: { referenceTime: true, value: true },
    orderBy: { referenceTime: "asc" },
  });

  const byHourOfDay = new Map<number, number[]>();
  for (const row of observations) {
    if (row.value == null) continue;
    const hod = row.referenceTime.getUTCHours();
    const bucket = byHourOfDay.get(hod) ?? [];
    bucket.push(Number(row.value));
    byHourOfDay.set(hod, bucket);
  }

  const mediansByHour = new Map<number, number>();
  for (const [hod, vals] of byHourOfDay) {
    const med = median(vals);
    if (med != null) mediansByHour.set(hod, Math.round(med * 10) / 10);
  }
  if (mediansByHour.size === 0) return [];

  const overallMed = median([...mediansByHour.values()]) ?? 10;
  const points: ControlHourlyWeather[] = [];
  const startHour = new Date(nowMs);
  startHour.setUTCMinutes(0, 0, 0);

  for (let i = 0; i < hours; i++) {
    const hour = new Date(startHour.getTime() + i * 3600000);
    const hod = hour.getUTCHours();
    points.push({
      hour: hour.toISOString(),
      outdoorTempC: mediansByHour.get(hod) ?? overallMed,
    });
  }

  return points;
}
