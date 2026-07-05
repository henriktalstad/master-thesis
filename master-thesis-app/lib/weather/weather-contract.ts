/** Nærbyen 24/7 — Frost API-undersøkelse juni 2026 (Sorgenfrivegen 32B). */
export const NAERBYEN_BUILDING_ANCHOR = {
  lat: 63.404736,
  lon: 10.39973,
  label: "Sorgenfrivegen 32B, Trondheim",
} as const;

export const PINNED_WEATHER_STATION = {
  id: "SN68175",
  name: "E6 MOHOLTLIA",
  distanceKm: 1.97,
  primaryResolution: "PT10M",
  resolutionsAvailable: ["PT10M"] as const,
} as const;

export const WEATHER_FALLBACK_STATION = {
  id: "SN68230",
  name: "TRONDHEIM - RISVOLLAN",
  distanceKm: 1.34,
  primaryResolution: "PT1H",
} as const;

export type WeatherPurpose =
  | "display"
  | "replay"
  | "mpc"
  | "simulation"
  | "forecast";

export type WeatherResolution =
  | "PT10M"
  | "PT15M"
  | "PT1H"
  | "PT3H"
  | "P1D";

export const RESOLUTION_RANK: Record<WeatherResolution, number> = {
  PT10M: 5,
  PT15M: 4,
  PT1H: 3,
  PT3H: 2,
  P1D: 1,
};

export type WeatherPoint = {
  time: string;
  outdoorTempC: number;
  nativeResolution: WeatherResolution;
};

export type WeatherPeriod =
  | { kind: "since"; since: Date }
  | { kind: "range"; start: Date; end: Date };

export function targetStepMs(purpose: WeatherPurpose): number | null {
  switch (purpose) {
    case "simulation":
      return 5 * 60_000;
    case "mpc":
      return 15 * 60_000;
    case "display":
    case "replay":
    case "forecast":
      return 60 * 60_000;
    default:
      return 60 * 60_000;
  }
}
