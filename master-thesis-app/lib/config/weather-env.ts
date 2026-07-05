import { z } from "zod";

const weatherEnvSchema = z.object({
  FROST_CLIENT_ID: z.string().min(1).optional(),
  FROST_CLIENT_SECRET: z.string().min(1).optional(),
  FROST_BASE_URL: z.string().url().optional(),
  WEATHER_STATION_ID: z.string().min(1).default("SN68175"),
  WEATHER_FALLBACK_STATION_ID: z.string().min(1).default("SN68230"),
  WEATHER_MAX_DISTANCE_KM: z.coerce.number().positive().default(5),
  WEATHER_RESOLUTION_TIER_KM: z.coerce.number().positive().default(1),
  WEATHER_SYNC_YEARS: z.coerce.number().int().min(1).max(10).default(3),
  WEATHER_SUBHOURLY_DAYS: z.coerce.number().int().min(1).default(90),
  WEATHER_INCREMENTAL_OVERLAP_DAYS: z.coerce.number().int().min(1).default(3),
  WEATHER_NEAREST_CANDIDATES: z.coerce.number().int().min(5).default(25),
});

export type WeatherConfig = {
  frostClientId: string | undefined;
  frostClientSecret: string | undefined;
  frostBaseUrl: string;
  stationId: string;
  fallbackStationId: string;
  maxDistanceKm: number;
  resolutionTierKm: number;
  syncYears: number;
  subhourlyDays: number;
  incrementalOverlapDays: number;
  nearestCandidates: number;
};

let cached: WeatherConfig | null = null;

export function getWeatherConfig(): WeatherConfig {
  if (cached) return cached;

  const parsed = weatherEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Ugyldig vær-env: ${parsed.error.message}`);
  }

  const e = parsed.data;
  cached = {
    frostClientId: e.FROST_CLIENT_ID,
    frostClientSecret: e.FROST_CLIENT_SECRET,
    frostBaseUrl: e.FROST_BASE_URL ?? "https://frost.met.no",
    stationId: e.WEATHER_STATION_ID,
    fallbackStationId: e.WEATHER_FALLBACK_STATION_ID,
    maxDistanceKm: e.WEATHER_MAX_DISTANCE_KM,
    resolutionTierKm: e.WEATHER_RESOLUTION_TIER_KM,
    syncYears: e.WEATHER_SYNC_YEARS,
    subhourlyDays: e.WEATHER_SUBHOURLY_DAYS,
    incrementalOverlapDays: e.WEATHER_INCREMENTAL_OVERLAP_DAYS,
    nearestCandidates: e.WEATHER_NEAREST_CANDIDATES,
  };
  return cached;
}

export function requireFrostCredentials(): { clientId: string; clientSecret?: string } {
  const cfg = getWeatherConfig();
  if (!cfg.frostClientId) {
    throw new Error("FROST_CLIENT_ID må være satt for vær-sync");
  }
  return {
    clientId: cfg.frostClientId,
    clientSecret: cfg.frostClientSecret,
  };
}

export function hasFrostCredentials(): boolean {
  return Boolean(getWeatherConfig().frostClientId);
}
