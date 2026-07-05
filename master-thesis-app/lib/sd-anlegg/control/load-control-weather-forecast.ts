import "server-only";

import { fetchMetLocationForecast } from "@/lib/weather/load-met-locationforecast";
import { getWeatherStationCoordinates } from "@/lib/weather/load-weather-series";
import { loadFrostHourOfDayWeatherFallback } from "./load-frost-weather-fallback";
import type { ControlHourlyWeather } from "./control-types";

export type ControlWeatherForecastBundle = {
  points: ControlHourlyWeather[];
  source: "met_locationforecast" | "frost_hour_of_day" | "unavailable";
  stationLabel: string | null;
};

export async function loadControlWeatherForecast(input: {
  buildingId: string;
  municipalityNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  hours?: number;
}): Promise<ControlWeatherForecastBundle> {
  const hours = input.hours ?? 48;
  let lat = input.latitude;
  let lon = input.longitude;
  let stationLabel: string | null = null;

  if (lat == null || lon == null) {
    const pinned = await getWeatherStationCoordinates(input.buildingId);
    if (pinned) {
      lat = lat ?? pinned.lat;
      lon = lon ?? pinned.lon;
      stationLabel = pinned.stationLabel;
    }
  }

  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { points: [], source: "unavailable", stationLabel: null };
  }

  try {
    const forecast = await fetchMetLocationForecast({ lat, lon, hours });
    if (forecast.length > 0) {
      return {
        points: forecast.map((p) => ({
          hour: p.hour,
          outdoorTempC: p.outdoorTempC,
        })),
        source: "met_locationforecast",
        stationLabel,
      };
    }
  } catch {
    // fall through to Frost fallback
  }

  const fallback = await loadFrostHourOfDayWeatherFallback({
    buildingId: input.buildingId,
    hours,
  });
  if (fallback.length > 0) {
    return {
      points: fallback,
      source: "frost_hour_of_day",
      stationLabel,
    };
  }

  return { points: [], source: "unavailable", stationLabel };
}
