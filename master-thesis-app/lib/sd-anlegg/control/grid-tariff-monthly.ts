import { osloYearMonthFromIso } from "./control-time-buckets";

export type MonthlyGridTariff = {
  month: string;
  energyLinkOre: number | null;
  capacityLinkKrPerKw: number | null;
  fixedLinkKrPerMonth: number | null;
  sampleTimestamp: string | null;
};

export type GridTariffRow = {
  timestamp: Date;
  energyLink: number | null;
  capacityLink: number | null;
  fixedLink: number | null;
};

/** Måned-intervaller som overlapper [since, until) — matcher NVE ankerdag per måned. */
export function monthRangesBetween(
  since: Date,
  until: Date,
): { timestamp: { gte: Date; lt: Date } }[] {
  const ranges: { timestamp: { gte: Date; lt: Date } }[] = [];
  const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1));
  const end = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), 1));
  while (cursor <= end) {
    const gte = new Date(cursor);
    const lt = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    ranges.push({ timestamp: { gte, lt } });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ranges;
}

export function monthsInRangeOslo(since: Date, until: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1));
  const end = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), 1));
  while (cursor <= end) {
    months.push(osloYearMonthFromIso(cursor.toISOString()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function averageFinite(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Bygg månedsindeks fra NVE-rader (ankerdag ≈ dag 15, 24 timer). */
export function buildMonthlyGridTariffIndex(
  rows: readonly GridTariffRow[],
  expectedMonths: readonly string[],
): { byMonth: Map<string, MonthlyGridTariff>; missingMonths: string[] } {
  const grouped = new Map<string, GridTariffRow[]>();
  for (const row of rows) {
    const month = osloYearMonthFromIso(row.timestamp.toISOString());
    const list = grouped.get(month) ?? [];
    list.push(row);
    grouped.set(month, list);
  }

  const byMonth = new Map<string, MonthlyGridTariff>();
  for (const [month, monthRows] of grouped) {
    const energyValues = monthRows
      .map((r) => r.energyLink)
      .filter((v): v is number => v != null && Number.isFinite(v));
    const capacityValues = monthRows
      .map((r) => r.capacityLink)
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
    const fixedValues = monthRows
      .map((r) => r.fixedLink)
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);

    byMonth.set(month, {
      month,
      energyLinkOre: averageFinite(energyValues),
      capacityLinkKrPerKw: averageFinite(capacityValues),
      fixedLinkKrPerMonth: averageFinite(fixedValues),
      sampleTimestamp: monthRows[0]?.timestamp.toISOString() ?? null,
    });
  }

  const missingMonths = expectedMonths.filter(
    (m) => !byMonth.has(m) || byMonth.get(m)?.capacityLinkKrPerKw == null,
  );
  return { byMonth, missingMonths };
}

export function resolveMonthlyGridTariff(
  month: string,
  byMonth: ReadonlyMap<string, MonthlyGridTariff>,
): MonthlyGridTariff | null {
  return byMonth.get(month) ?? null;
}
