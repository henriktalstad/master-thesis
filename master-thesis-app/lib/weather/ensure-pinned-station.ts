import { prisma } from "@/lib/db";
import { getWeatherConfig } from "@/lib/config/weather-env";
import {
  getNearestStations,
  getStationsInMunicipality,
  getAvailableTimeSeries,
  type FrostSourceItem,
} from "@/lib/frost";
import {
  PINNED_WEATHER_STATION,
  NAERBYEN_BUILDING_ANCHOR,
} from "@/lib/weather/weather-contract";
import {
  normalizeStationItems,
  rankWeatherStationSeries,
} from "@/lib/weather/rank-weather-station";
import { isoDate } from "@/lib/weather/weather-utils";
import type { CaseBuildingAnchor } from "@/lib/weather/resolve-case-building";

function pickSources(resp: { data?: FrostSourceItem[]; items?: FrostSourceItem[] }) {
  return resp.data ?? resp.items ?? [];
}

async function upsertWeatherStationFromFrost(stationId: string) {
  const cfg = getWeatherConfig();
  const resp = await getNearestStations(
    NAERBYEN_BUILDING_ANCHOR.lon,
    NAERBYEN_BUILDING_ANCHOR.lat,
    cfg.nearestCandidates,
  );
  const items = pickSources(resp);
  const match = items.find((s) => String(s.id).split(":")[0] === stationId);
  if (!match) {
    await prisma.weatherStation.upsert({
      where: { id: stationId },
      create: {
        id: stationId,
        name: PINNED_WEATHER_STATION.name,
        lat: NAERBYEN_BUILDING_ANCHOR.lat,
        lon: NAERBYEN_BUILDING_ANCHOR.lon,
      },
      update: { name: PINNED_WEATHER_STATION.name },
    });
    return;
  }
  const [lon, lat] = match.geometry?.coordinates ?? [NAERBYEN_BUILDING_ANCHOR.lon, NAERBYEN_BUILDING_ANCHOR.lat];
  const elev =
    typeof (match as { masl?: number }).masl === "number"
      ? (match as { masl?: number }).masl
      : match.elevation ?? null;

  await prisma.weatherStation.upsert({
    where: { id: stationId },
    create: {
      id: stationId,
      name: match.name ?? null,
      lat,
      lon,
      elevation: elev,
    },
    update: {
      name: match.name ?? null,
      lat,
      lon,
      elevation: elev,
    },
  });
}

/** Pin env-stasjon (SN68175) eller re-rank ved forceReselect. */
export async function ensurePinnedWeatherStation(input: {
  building: CaseBuildingAnchor;
  forceReselect?: boolean;
}) {
  const cfg = getWeatherConfig();
  const existing = await prisma.buildingWeatherStation.findUnique({
    where: { buildingId: input.building.buildingId },
  });

  if (existing && !input.forceReselect) {
    await upsertWeatherStationFromFrost(existing.stationId);
    return existing;
  }

  let stationId: string = cfg.stationId;
  let stationName: string | null = PINNED_WEATHER_STATION.name;
  let distanceKm: number = PINNED_WEATHER_STATION.distanceKm;
  let primaryResolution: string = PINNED_WEATHER_STATION.primaryResolution;
  let resolutionsAvailable: string[] = [
    ...PINNED_WEATHER_STATION.resolutionsAvailable,
  ];
  let method = "env_pinned";

  if (input.forceReselect) {
    const anchor = { lat: input.building.lat, lon: input.building.lon };
    const nearest = await getNearestStations(
      anchor.lon,
      anchor.lat,
      cfg.nearestCandidates,
    );
    const items = pickSources(nearest);
    if (input.building.municipalityNumber) {
      try {
        const muni = await getStationsInMunicipality(
          input.building.municipalityNumber,
        );
        const muniItems = pickSources(muni);
        const seen = new Set(items.map((s) => String(s.id).split(":")[0]));
        for (const s of muniItems) {
          const id = String(s.id).split(":")[0];
          if (!seen.has(id)) {
            items.push(s);
            seen.add(id);
          }
        }
      } catch {
        // ignore municipality lookup failure
      }
    }

    const stations = normalizeStationItems(items, anchor);
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 365);
    const period = `${isoDate(start)}/${isoDate(now)}`;
    const sourceIds = stations.map((s) => s.id);

    const tsResp = await getAvailableTimeSeries(
      sourceIds,
      period,
      "air_temperature,mean(air_temperature PT1H)",
    );
    const series = tsResp.data ?? tsResp.items ?? [];
    const ranked = rankWeatherStationSeries({
      stations,
      series,
      maxDistanceKm: cfg.maxDistanceKm,
      resolutionTierKm: cfg.resolutionTierKm,
    });

    if (ranked) {
      stationId = ranked.station.id;
      stationName = ranked.station.name;
      distanceKm = ranked.station.distanceKm;
      primaryResolution = ranked.resolution;
      resolutionsAvailable = [ranked.resolution];
      method = "distance_then_resolution_5km";
    }
  }

  await upsertWeatherStationFromFrost(stationId);

  return prisma.buildingWeatherStation.upsert({
    where: { buildingId: input.building.buildingId },
    create: {
      buildingId: input.building.buildingId,
      stationId,
      stationName,
      distanceKm,
      primaryResolution,
      resolutionsAvailable,
      method,
    },
    update: {
      stationId,
      stationName,
      distanceKm,
      primaryResolution,
      resolutionsAvailable,
      method,
      chosenAt: new Date(),
    },
  });
}

export async function getBuildingWeatherBinding(buildingId: string) {
  return prisma.buildingWeatherStation.findUnique({
    where: { buildingId },
    include: {
      station: { select: { id: true, name: true, lat: true, lon: true } },
    },
  });
}
