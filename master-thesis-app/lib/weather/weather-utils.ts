export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const p = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * p) / 2) ** 2 +
    Math.cos(lat1 * p) *
      Math.cos(lat2 * p) *
      Math.sin(((lon2 - lon1) * p) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildWeatherSeriesId(input: {
  stationId: string;
  elementId: string;
  resolution: string;
  level?: number | null;
}): string {
  return `${input.stationId}|${input.elementId}|${input.resolution}|${input.level ?? ""}`;
}

export function monthChunks(start: Date, end: Date): { start: string; end: string }[] {
  const chunks: { start: string; end: string }[] = [];
  const cur = new Date(start);
  const until = new Date(end);
  if (cur >= until) return chunks;

  while (cur < until) {
    const s = new Date(cur);
    const e = new Date(s);
    e.setMonth(e.getMonth() + 1);
    const endStr = e < until ? isoDate(e) : until.toISOString();
    chunks.push({ start: isoDate(s), end: endStr });
    cur.setMonth(cur.getMonth() + 1);
  }
  return chunks;
}

export function hourKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
}

export function hourKeyToIsoUtc(hourKey: string): string {
  const [datePart, hourPart] = hourKey.split("T");
  const [y, m, day] = datePart.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, day, Number(hourPart), 0, 0, 0),
  ).toISOString();
}
