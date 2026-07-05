import { utcDayMidnight } from "@/lib/energy-prices/day-utils";
import type { PricePoint } from "@/services/entsoe/get-day-ahead-prices";

export { utcDayMidnight } from "@/lib/energy-prices/day-utils";

export type QuarterHourlyPricePoint = PricePoint & {
  hour: number;
  quarter: number;
};

export const QUARTERS_PER_HOUR = 4;

export function slotFromInstant(instant: Date): {
  dateUtc: Date;
  hour: number;
  quarter: number;
} {
  const minute = instant.getUTCMinutes();
  return {
    dateUtc: utcDayMidnight(instant),
    hour: instant.getUTCHours(),
    quarter: Math.floor(minute / 15),
  };
}

export function quarterHourlySlotKey(
  dateUtc: Date,
  hour: number,
  quarter: number,
  areaCode: string,
): string {
  const dp = dateUtc.toISOString().split("T")[0];
  return `${dp}|${hour}|${quarter}|${areaCode}`;
}

export function hourlySlotKey(
  dateUtc: Date,
  hour: number,
  areaCode: string,
): string {
  const dp = dateUtc.toISOString().split("T")[0];
  return `${dp}|${hour}|${areaCode}`;
}

export function aggregateQuarterHourlyToHourly(
  quarters: readonly QuarterHourlyPricePoint[],
): PricePoint[] {
  type Acc = { sum: number; count: number; area: string; areaCode: string };
  const acc = new Map<string, Acc>();

  for (const q of quarters) {
    if (!Number.isFinite(q.price)) continue;
    const key = hourlySlotKey(utcDayMidnight(new Date(q.date)), q.hour, q.areaCode);
    const cur = acc.get(key);
    if (cur) {
      cur.sum += q.price;
      cur.count += 1;
    } else {
      acc.set(key, {
        sum: q.price,
        count: 1,
        area: q.area,
        areaCode: q.areaCode,
      });
    }
  }

  const out: PricePoint[] = [];
  for (const [key, { sum, count, area, areaCode }] of acc) {
    const [dp, hourStr] = key.split("|");
    const hour = parseInt(hourStr!, 10);
    const [y, m, d] = dp!.split("-").map((x) => parseInt(x, 10));
    const iso = new Date(Date.UTC(y, m - 1, d, hour, 0, 0, 0)).toISOString();
    out.push({
      date: iso,
      price: parseFloat((sum / count).toFixed(4)),
      area,
      areaCode,
    });
  }

  return out.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export function aggregateHourlyToDaily(
  hourlyPrices: readonly PricePoint[],
  forDate: Date,
): PricePoint | null {
  if (!hourlyPrices.length) return null;

  const byHour = new Map<number, PricePoint>();
  for (const p of hourlyPrices) {
    byHour.set(new Date(p.date).getUTCHours(), p);
  }

  const completed: PricePoint[] = [];
  let lastValid: PricePoint | null = null;
  for (let hour = 0; hour < 24; hour++) {
    const atHour = byHour.get(hour);
    if (atHour) {
      completed.push(atHour);
      lastValid = atHour;
      continue;
    }
    let nextValid: PricePoint | null = null;
    for (let h2 = hour + 1; h2 < 24; h2++) {
      const cand = byHour.get(h2);
      if (cand) {
        nextValid = cand;
        break;
      }
    }
    const chosen = lastValid ?? nextValid ?? hourlyPrices[0]!;
    const ts = new Date(chosen.date);
    ts.setUTCHours(hour, 0, 0, 0);
    completed.push({ ...chosen, date: ts.toISOString() });
    lastValid = completed[completed.length - 1]!;
  }

  const averagePrice =
    completed.reduce((sum, p) => sum + p.price, 0) / completed.length;
  const dateStr = forDate.toISOString().split("T")[0];
  const first = completed[0]!;

  return {
    date: `${dateStr}T00:00:00.000Z`,
    price: parseFloat(averagePrice.toFixed(4)),
    area: first.area,
    areaCode: first.areaCode,
  };
}
