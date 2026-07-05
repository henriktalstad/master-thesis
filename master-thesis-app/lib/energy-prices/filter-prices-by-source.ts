import { prisma } from "@/lib/db";
import { EnergyPriceSource } from "@/generated/client/enums";
import {
  canEntsoeWriteExistingSource,
  canNordPoolFillGapsWriteExisting,
} from "@/lib/energy-prices/energy-price-source";
import {
  hourlySlotKey,
  quarterHourlySlotKey,
} from "@/lib/energy-prices/derive-energy-price-aggregates";

const SPOT_MIN = -5_000;
const SPOT_MAX = 50_000;

export function isPlausibleSpotPriceKrPerKwh(
  price: number | null | undefined,
): boolean {
  if (price == null) return false;
  if (!Number.isFinite(price)) return false;
  if (price < SPOT_MIN || price > SPOT_MAX) return false;
  return true;
}

type PriceLike = {
  date: string;
  price: number;
  areaCode: string;
  type: "QUARTER_HOURLY" | "HOURLY" | "DAILY";
  hour?: number;
  quarter?: number;
};

function normalizeDateFromIso(dateStr: string): Date {
  const datePart = dateStr.split("T")[0];
  return new Date(`${datePart}T00:00:00.000Z`);
}

function hourFromIso(dateStr: string): number {
  return new Date(dateStr).getUTCHours();
}

function quarterFromIso(dateStr: string): number {
  return Math.floor(new Date(dateStr).getUTCMinutes() / 15);
}

function dailySlotKey(ymd: string, areaCode: string): string {
  return `${ymd}|${areaCode}`;
}

type ExistingQuarterHourly = {
  key: string;
  source: EnergyPriceSource | null;
  price: number | null;
};

type ExistingHourly = {
  key: string;
  source: EnergyPriceSource | null;
  price: number | null;
};

type ExistingDaily = {
  key: string;
  source: EnergyPriceSource | null;
  price: number | null;
};

async function loadExistingSlots(prices: PriceLike[]): Promise<{
  quarterHourly: Map<string, ExistingQuarterHourly>;
  hourly: Map<string, ExistingHourly>;
  daily: Map<string, ExistingDaily>;
}> {
  if (prices.length === 0) {
    return {
      quarterHourly: new Map(),
      hourly: new Map(),
      daily: new Map(),
    };
  }

  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  for (const p of prices) {
    const d = normalizeDateFromIso(p.date);
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }
  if (!minDate || !maxDate) {
    return {
      quarterHourly: new Map(),
      hourly: new Map(),
      daily: new Map(),
    };
  }

  const areaCodes = Array.from(new Set(prices.map((p) => p.areaCode)));

  const [existingQuarterHourly, existingHourly, existingDaily] =
    await Promise.all([
      prisma.quarterHourlyEnergyPrices.findMany({
        where: {
          areaCode: { in: areaCodes },
          date: { gte: minDate, lte: maxDate },
        },
        select: {
          date: true,
          hour: true,
          quarter: true,
          areaCode: true,
          source: true,
          price: true,
        },
      }),
      prisma.hourlyEnergyPrices.findMany({
        where: {
          areaCode: { in: areaCodes },
          date: { gte: minDate, lte: maxDate },
        },
        select: {
          date: true,
          hour: true,
          areaCode: true,
          source: true,
          price: true,
        },
      }),
      prisma.dailyEnergyPrices.findMany({
        where: {
          areaCode: { in: areaCodes },
          date: { gte: minDate, lte: maxDate },
        },
        select: { date: true, areaCode: true, source: true, averagePrice: true },
      }),
    ]);

  const quarterHourly = new Map<string, ExistingQuarterHourly>();
  for (const row of existingQuarterHourly) {
    if (
      !(row.date instanceof Date) ||
      row.hour == null ||
      row.quarter == null ||
      !row.areaCode
    ) {
      continue;
    }
    const key = quarterHourlySlotKey(
      row.date,
      row.hour,
      row.quarter,
      row.areaCode,
    );
    quarterHourly.set(key, {
      key,
      source: row.source,
      price: row.price,
    });
  }

  const hourly = new Map<string, ExistingHourly>();
  for (const row of existingHourly) {
    if (!(row.date instanceof Date) || row.hour == null || !row.areaCode)
      continue;
    const key = hourlySlotKey(row.date, row.hour, row.areaCode);
    hourly.set(key, {
      key,
      source: row.source,
      price: row.price,
    });
  }

  const daily = new Map<string, ExistingDaily>();
  for (const row of existingDaily) {
    if (!(row.date instanceof Date) || !row.areaCode) continue;
    const ymd = row.date.toISOString().split("T")[0];
    const key = dailySlotKey(ymd, row.areaCode);
    daily.set(key, {
      key,
      source: row.source,
      price: row.averagePrice,
    });
  }

  return { quarterHourly, hourly, daily };
}

function shouldWriteSlot(
  incoming: EnergyPriceSource,
  existing: { source: EnergyPriceSource | null; price: number | null } | undefined,
): boolean {
  if (!existing) return true;
  const priceOk = isPlausibleSpotPriceKrPerKwh(existing.price);
  if (incoming === EnergyPriceSource.ENTSOE) {
    return canEntsoeWriteExistingSource(existing.source);
  }
  return canNordPoolFillGapsWriteExisting(existing.source, priceOk);
}

export async function filterPricesForSourceIngest<T extends PriceLike>(
  prices: T[],
  incomingSource: EnergyPriceSource,
): Promise<T[]> {
  if (prices.length === 0) return [];

  const { quarterHourly, hourly, daily } = await loadExistingSlots(prices);

  const out: T[] = [];
  for (const p of prices) {
    if (p.type === "QUARTER_HOURLY") {
      const d = normalizeDateFromIso(p.date);
      const h = p.hour ?? hourFromIso(p.date);
      const q = p.quarter ?? quarterFromIso(p.date);
      const key = quarterHourlySlotKey(d, h, q, p.areaCode);
      if (shouldWriteSlot(incomingSource, quarterHourly.get(key))) {
        out.push(p);
      }
      continue;
    }

    if (p.type === "HOURLY") {
      const d = normalizeDateFromIso(p.date);
      const h = hourFromIso(p.date);
      const key = hourlySlotKey(d, h, p.areaCode);
      if (shouldWriteSlot(incomingSource, hourly.get(key))) {
        out.push(p);
      }
      continue;
    }

    const ymd = p.date.split("T")[0];
    const key = dailySlotKey(ymd!, p.areaCode);
    if (shouldWriteSlot(incomingSource, daily.get(key))) {
      out.push(p);
    }
  }
  return out;
}
