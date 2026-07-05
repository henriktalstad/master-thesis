import "server-only";

/** MET Locationforecast 2.0 — timeprognose (met.no, komplement til Frost-observasjoner i DB). */
const LOCATIONFORECAST_URL =
  "https://api.met.no/weatherapi/locationforecast/2.0/compact";

export type MetLocationForecastHour = {
  hour: string;
  outdoorTempC: number;
};

type MetCompactResponse = {
  properties?: {
    timeseries?: Array<{
      time: string;
      data?: {
        instant?: { details?: { air_temperature?: number } };
        next_1_hours?: { details?: { air_temperature?: number } };
      };
    }>;
  };
};

export async function fetchMetLocationForecast(input: {
  lat: number;
  lon: number;
  hours?: number;
}): Promise<MetLocationForecastHour[]> {
  const hours = input.hours ?? 48;
  const url = `${LOCATIONFORECAST_URL}?lat=${input.lat.toFixed(4)}&lon=${input.lon.toFixed(4)}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "scoped-plattform/1.0 (sd-anlegg-styring)",
    },
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`Locationforecast ${res.status}`);
  }

  const json = (await res.json()) as MetCompactResponse;
  const series = json.properties?.timeseries ?? [];
  const now = Date.now();
  const horizonMs = hours * 3_600_000;

  const byHour = new Map<string, number>();

  for (const entry of series) {
    const t = new Date(entry.time).getTime();
    if (t < now - 3_600_000 || t > now + horizonMs) continue;

    const temp =
      entry.data?.next_1_hours?.details?.air_temperature ??
      entry.data?.instant?.details?.air_temperature;
    if (temp == null || !Number.isFinite(temp)) continue;

    const d = new Date(entry.time);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
    byHour.set(key, Math.round(temp * 10) / 10);
  }

  return [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, hours)
    .map(([hourKey, outdoorTempC]) => ({
      hour: hourKeyToIsoUtc(hourKey),
      outdoorTempC,
    }));
}

function hourKeyToIsoUtc(hourKey: string): string {
  const [datePart, hourPart] = hourKey.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d, Number(hourPart), 0, 0, 0),
  ).toISOString();
}
