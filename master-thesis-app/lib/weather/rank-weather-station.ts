import type { FrostAvailableTimeSeriesItem } from "@/lib/frost";
import {
  RESOLUTION_RANK,
  type WeatherResolution,
} from "@/lib/weather/weather-contract";
import { distanceKm } from "@/lib/weather/weather-utils";

export type StationCandidate = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  distanceKm: number;
};

export type RankedStationSeries = {
  station: StationCandidate;
  elementId: string;
  resolution: WeatherResolution;
  score: number;
};

function resolutionOf(item: FrostAvailableTimeSeriesItem): WeatherResolution {
  const raw = item.timeResolution ?? item.timeresolution ?? "PT1H";
  if (raw in RESOLUTION_RANK) return raw as WeatherResolution;
  return "PT1H";
}

function hasAirTemperature(item: FrostAvailableTimeSeriesItem): boolean {
  return String(item.elementId).includes("air_temperature");
}

/**
 * Avstand først (≤ maxDistanceKm), deretter oppløsning blant nær-tier (dMin + tierKm).
 */
export function rankWeatherStationSeries(input: {
  stations: StationCandidate[];
  series: FrostAvailableTimeSeriesItem[];
  maxDistanceKm: number;
  resolutionTierKm: number;
}): RankedStationSeries | null {
  const within = input.stations.filter((s) => s.distanceKm <= input.maxDistanceKm);
  if (within.length === 0) return null;

  const stationById = new Map(within.map((s) => [s.id, s]));
  const validSeries = input.series.filter((item) => {
    if (!hasAirTemperature(item)) return false;
    const sid = String(
      item.sourceId ?? (item as { source?: string }).source ?? "",
    ).split(":")[0];
    return stationById.has(sid);
  });

  if (validSeries.length === 0) return null;

  const withDistance = validSeries.map((item) => {
    const sid = String(item.sourceId ?? "").split(":")[0];
    const station = stationById.get(sid)!;
    return { item, station, resolution: resolutionOf(item) };
  });

  const dMin = Math.min(...withDistance.map((x) => x.station.distanceKm));
  const tierLimit = dMin + input.resolutionTierKm;
  const tier = withDistance.filter((x) => x.station.distanceKm <= tierLimit);
  const pool = tier.length > 0 ? tier : withDistance;

  let best: RankedStationSeries | null = null;

  for (const entry of pool) {
    const resRank = RESOLUTION_RANK[entry.resolution] ?? 0;
    const isMean = String(entry.item.elementId).startsWith("mean(");
    const perf = String(
      (entry.item as { performancecategory?: string }).performancecategory ?? "",
    ).toUpperCase();
    const perfScore = perf.startsWith("A") ? 30 : perf.startsWith("B") ? 15 : 0;
    const distScore = Math.max(0, 60 - entry.station.distanceKm);
    const score =
      resRank * 100 + distScore + perfScore + (isMean ? 8 : 0);

    const candidate: RankedStationSeries = {
      station: entry.station,
      elementId: entry.item.elementId,
      resolution: entry.resolution,
      score,
    };

    if (
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score &&
        candidate.station.distanceKm < best.station.distanceKm)
    ) {
      best = candidate;
    }
  }

  return best;
}

export function normalizeStationItems(
  items: Array<{
    id: string;
    name?: string | null;
    geometry?: { coordinates?: [number, number] };
    elevation?: number | null;
    masl?: number;
  }>,
  anchor: { lat: number; lon: number },
): StationCandidate[] {
  return items.map((s) => {
    const [lon, lat] = s.geometry?.coordinates ?? [0, 0];
    const id = String(s.id).split(":")[0];
    return {
      id,
      name: s.name ?? null,
      lat,
      lon,
      distanceKm: distanceKm(anchor.lat, anchor.lon, lat, lon),
    };
  });
}
