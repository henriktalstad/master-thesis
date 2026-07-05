import { NAERBYEN_BUILDING_ANCHOR } from "@/lib/weather/weather-contract";

const DEG2RAD = Math.PI / 180;

/**
 * Klar-himmel sol-proxy uten egen sensor: solhøyde (0–1, klippet ved
 * horisonten) fra UTC-tidsstempel og byggets bredde-/lengdegrad.
 * Ignorerer skydekke og tidsligningen (±~15 min) — brukes kun som en
 * grov disturbance-feature (d_k) i plantmodellen, ikke som målt
 * solstråling (dokumentert som "ikke i vær-pipeline" i UNAVAILABLE_PLANT_FEATURES).
 */
export function clearSkySolarProxy(
  tMs: number,
  lat = NAERBYEN_BUILDING_ANCHOR.lat,
  lon = NAERBYEN_BUILDING_ANCHOR.lon,
): number {
  const date = new Date(tMs);
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((tMs - startOfYear) / 86_400_000) + 1;

  const declinationDeg =
    23.45 * Math.sin(((360 / 365) * (dayOfYear + 284)) * DEG2RAD);
  const utcHourDecimal =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarTimeHours = utcHourDecimal + lon / 15;
  const hourAngleDeg = 15 * (solarTimeHours - 12);

  const latRad = lat * DEG2RAD;
  const decRad = declinationDeg * DEG2RAD;
  const hourAngleRad = hourAngleDeg * DEG2RAD;

  const sinElevation =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);

  return Math.max(0, sinElevation);
}
