import { prisma } from "@/lib/db";
import {
  addDaysToYmd,
  generateOsloDayStringsInRange,
  getUtcSlotsForOsloDay,
  osloYmdFromDate,
  toUTCForOslo,
  utcYmdFromDate,
} from "@/lib/utils";
import { hourUtcFromPriceRow } from "@/lib/sd-anlegg/control/control-effective-price-utils";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";

/** Minst 20 prissatte timer dekker normal 24t-leveransedag ( også 23t vår-DST). */
export const MIN_HOURLY_FOR_COMPLETE_OSLO_DAY = 20;

export type OsloDayPriceCoverage = {
  osloYmd: string;
  expectedSlots: number;
  pricedSlots: number;
  complete: boolean;
};

function pricedSlotKey(dateYmd: string, hour: number): string {
  return `${dateYmd}|${hour}`;
}

export async function countOsloDayHourlyPrices(
  areaCode: string,
  osloYmd: string,
): Promise<OsloDayPriceCoverage> {
  const slots = getUtcSlotsForOsloDay(osloYmd);
  if (slots.length === 0) {
    return {
      osloYmd,
      expectedSlots: 0,
      pricedSlots: 0,
      complete: false,
    };
  }

  const dateBounds = slots.map((slot) => new Date(`${slot.date}T00:00:00.000Z`));
  const minDate = dateBounds.reduce((a, b) => (a < b ? a : b));
  const maxDate = dateBounds.reduce((a, b) => (a > b ? a : b));

  const rows = await prisma.hourlyEnergyPrices.findMany({
    where: {
      areaCode,
      date: { gte: minDate, lte: maxDate },
      price: { not: null },
    },
    select: { date: true, hour: true },
  });

  const priced = new Set<string>();
  for (const row of rows) {
    if (!row.date || row.hour == null) continue;
    priced.add(pricedSlotKey(utcYmdFromDate(row.date), row.hour));
  }

  const pricedSlots = slots.filter((slot) =>
    priced.has(pricedSlotKey(slot.date, slot.hour)),
  ).length;

  return {
    osloYmd,
    expectedSlots: slots.length,
    pricedSlots,
    complete: pricedSlots >= MIN_HOURLY_FOR_COMPLETE_OSLO_DAY,
  };
}

export async function isOsloDayAheadPriceDayComplete(
  areaCode: string,
  osloYmd: string,
): Promise<boolean> {
  return (await countOsloDayHourlyPrices(areaCode, osloYmd)).complete;
}

/** Oslo-kalenderdager som dekker et UTC-instant-intervall (f.eks. 48t værprognose). */
export function osloDaysCoveringInstantRange(from: Date, until: Date): string[] {
  return generateOsloDayStringsInRange(from, until);
}

/** Day-ahead sync-vindu: i går, i dag og i morgen i Europe/Oslo. */
export function forwardOsloDeliveryDays(reference = new Date()): string[] {
  const todayOslo = osloYmdFromDate(reference);
  return [
    addDaysToYmd(todayOslo, -1),
    todayOslo,
    addDaysToYmd(todayOslo, 1),
  ];
}

/** UTC Date midt på en Oslo-leveransedag — brukes som anker mot ENTSO-E-filter. */
export function anchorDateForOsloDeliveryDay(osloYmd: string): Date {
  return new Date(toUTCForOslo(osloYmd, 12));
}

export type HourlyPriceRow = {
  date: Date;
  hour: number;
  price: number | null;
};

/** Henter spotrader for alle UTC-(date,hour)-slots som tilhører gitte Oslo-dager. */
export async function loadHourlyPricesForOsloDays(
  areaCode: string,
  osloDays: readonly string[],
): Promise<HourlyPriceRow[]> {
  if (osloDays.length === 0) return [];

  const slots = osloDays.flatMap((osloYmd) => getUtcSlotsForOsloDay(osloYmd));
  if (slots.length === 0) return [];

  const dateBounds = slots.map((slot) => new Date(`${slot.date}T00:00:00.000Z`));
  const minDate = dateBounds.reduce((a, b) => (a < b ? a : b));
  const maxDate = dateBounds.reduce((a, b) => (a > b ? a : b));

  const rows = await prisma.hourlyEnergyPrices.findMany({
    where: {
      areaCode,
      date: { gte: minDate, lte: maxDate },
    },
    select: { date: true, hour: true, price: true },
    orderBy: [{ date: "asc" }, { hour: "asc" }],
  });

  return rows.flatMap((row) => {
    if (row.date == null || row.hour == null) return [];
    return [{ date: row.date, hour: row.hour, price: row.price }];
  });
}

/** Bygger control hour keys (UTC ISO-bucket) fra DB-rader. */
export function pricedControlHourKeysFromRows(
  rows: readonly HourlyPriceRow[],
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!row.date || row.hour == null || row.price == null) continue;
    const iso = hourUtcFromPriceRow(row.date, row.hour);
    keys.add(controlHourKeyFromIso(iso));
  }
  return keys;
}
