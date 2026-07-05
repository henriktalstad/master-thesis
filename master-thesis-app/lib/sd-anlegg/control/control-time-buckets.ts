/** UTC time bucket key: YYYY-MM-DDTHH */
export function controlHourKeyFromIso(iso: string): string {
  const d = new Date(iso);
  return controlHourKeyFromDate(d);
}

export function controlHourKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
}

/** Klokkeslett 0–23 i Europe/Oslo for pris-/driftsvinduer. */
const OSLO_HOUR_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  hour: "numeric",
  hour12: false,
});

export function osloHourFromIso(iso: string): number {
  const parts = OSLO_HOUR_PARTS.formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value;
  return hour != null ? Number(hour) : new Date(iso).getUTCHours();
}

const OSLO_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Oslo",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Ukedag 0=son … 6=lør i Europe/Oslo. */
export function osloWeekdayFromIso(iso: string): number {
  const label = OSLO_WEEKDAY.format(new Date(iso));
  return WEEKDAY_INDEX[label] ?? new Date(iso).getUTCDay();
}

const OSLO_YM = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
});

/** Kalendermåned YYYY-MM i Europe/Oslo — for effekttopp per måned. */
export function osloYearMonthFromIso(iso: string): string {
  const parts = OSLO_YM.formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (year && month) return `${year}-${month}`;
  return iso.slice(0, 7);
}

export function bucketSamplesByHour(
  samples: readonly { t: string; value: number | null }[],
): Map<string, number> {
  const buckets = new Map<string, { sum: number; count: number }>();

  for (const sample of samples) {
    if (sample.value == null || Number.isNaN(sample.value)) continue;
    const key = controlHourKeyFromDate(new Date(sample.t));
    const agg = buckets.get(key) ?? { sum: 0, count: 0 };
    agg.sum += sample.value;
    agg.count += 1;
    buckets.set(key, agg);
  }

  return new Map(
    [...buckets.entries()].map(([key, agg]) => [
      key,
      Math.round((agg.sum / agg.count) * 10) / 10,
    ]),
  );
}

export function mergeHourlyMaps(
  ...maps: ReadonlyMap<string, number>[]
): Map<string, number> {
  const merged = new Map<string, number>();
  for (const map of maps) {
    for (const [key, value] of map) {
      merged.set(key, value);
    }
  }
  return merged;
}
