/** Influx lagrer tid som naive UTC (uten Z/offset) i SQL-literaler og JSON-svar. */
const INFLUX_TIMESTAMP_TZ_SUFFIX = /(?:[zZ]|[+-]\d{2}:\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

function normalizeInfluxFractionalSeconds(iso: string): string {
  return iso.replace(/\.(\d+)/, (_, fraction: string) => {
    const millis = fraction.slice(0, 3).padEnd(3, "0");
    return `.${millis}`;
  });
}

/** Serialiserer UTC-Date til Influx SQL-literal (samme kontrakt som `time`-kolonnen). */
export function formatInfluxSqlTimeLiteral(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}.${pad3(d.getUTCMilliseconds())}`;
}

/**
 * Parser Influx `time`-felt til korrekt UTC-Date uavhengig av server-tidssone.
 * Naive strenger (uten Z/offset) behandles som UTC — ikke lokal veggklokke.
 */
export function parseInfluxSqlTimestamp(timeRaw: string): Date {
  const trimmed = timeRaw.trim();
  if (!trimmed) return new Date(Number.NaN);

  const normalized = normalizeInfluxFractionalSeconds(trimmed.replace(" ", "T"));
  if (INFLUX_TIMESTAMP_TZ_SUFFIX.test(normalized)) {
    return new Date(normalized);
  }

  return new Date(`${normalized}Z`);
}

export function influxRowTimeLiteral(row: {
  sampledAt: Date;
  raw?: Record<string, unknown>;
}): string {
  const rawTime = row.raw?.time ?? row.raw?.Time;
  if (typeof rawTime === "string" && rawTime.trim()) {
    return rawTime.trim();
  }
  return formatInfluxSqlTimeLiteral(row.sampledAt);
}

export const INFRASPAWN_HOT_TAIL_LOOKBACK_HOURS = 6;
