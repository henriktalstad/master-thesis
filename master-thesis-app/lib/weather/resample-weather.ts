import type { WeatherPoint, WeatherResolution } from "@/lib/weather/weather-contract";
import { hourKeyToIsoUtc, hourKeyUtc } from "@/lib/weather/weather-utils";

/** PT1H → finere grid (hold konstant innen time). */
export function holdPiecewiseConstant(
  points: readonly WeatherPoint[],
  stepMs: number,
): WeatherPoint[] {
  if (points.length === 0 || stepMs <= 0) return [...points];

  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  const start = new Date(sorted[0].time).getTime();
  const end = new Date(sorted[sorted.length - 1].time).getTime();
  const out: WeatherPoint[] = [];

  let idx = 0;
  for (let t = start; t <= end; t += stepMs) {
    while (idx + 1 < sorted.length && new Date(sorted[idx + 1].time).getTime() <= t) {
      idx += 1;
    }
    const p = sorted[idx];
    if (!p || new Date(p.time).getTime() > t) continue;
    out.push({
      time: new Date(t).toISOString(),
      outdoorTempC: p.outdoorTempC,
      nativeResolution: p.nativeResolution,
    });
  }
  return out;
}

/** Sub-hourly → finere grid (lineær interpolasjon). */
export function linearInterpolate(
  points: readonly WeatherPoint[],
  stepMs: number,
): WeatherPoint[] {
  if (points.length === 0 || stepMs <= 0) return [...points];
  if (points.length === 1) return holdPiecewiseConstant(points, stepMs);

  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  const start = new Date(sorted[0].time).getTime();
  const end = new Date(sorted[sorted.length - 1].time).getTime();
  const out: WeatherPoint[] = [];

  let idx = 0;
  for (let t = start; t <= end; t += stepMs) {
    while (idx + 1 < sorted.length && new Date(sorted[idx + 1].time).getTime() < t) {
      idx += 1;
    }
    const a = sorted[idx];
    const b = sorted[Math.min(idx + 1, sorted.length - 1)];
    const ta = new Date(a.time).getTime();
    const tb = new Date(b.time).getTime();
    let value = a.outdoorTempC;
    if (tb > ta && t > ta) {
      const ratio = Math.min(1, (t - ta) / (tb - ta));
      value = a.outdoorTempC + ratio * (b.outdoorTempC - a.outdoorTempC);
    }
    out.push({
      time: new Date(t).toISOString(),
      outdoorTempC: Math.round(value * 10) / 10,
      nativeResolution: a.nativeResolution,
    });
  }
  return out;
}

export function resampleWeatherPoints(
  points: readonly WeatherPoint[],
  stepMs: number,
  nativeResolution: WeatherResolution,
): WeatherPoint[] {
  const isSubHourly =
    nativeResolution === "PT10M" || nativeResolution === "PT15M";
  if (stepMs >= 3_600_000 || !isSubHourly) {
    return holdPiecewiseConstant(points, stepMs);
  }
  return linearInterpolate(points, stepMs);
}

/** Aggreger observasjoner til PT1H snitt (UTC-timebøtte). */
export function aggregateToHourlyMean(
  rows: readonly { time: Date; value: number }[],
): Map<string, number> {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const key = hourKeyUtc(row.time);
    const b = buckets.get(key) ?? { sum: 0, count: 0 };
    b.sum += row.value;
    b.count += 1;
    buckets.set(key, b);
  }
  const out = new Map<string, number>();
  for (const [key, b] of buckets) {
    out.set(hourKeyToIsoUtc(key), Math.round((b.sum / b.count) * 10) / 10);
  }
  return out;
}
