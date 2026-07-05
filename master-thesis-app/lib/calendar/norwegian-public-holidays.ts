/**
 * Norske helligdager (fast + bevegelig påske).
 * Brukes for occupancy q_k = 0 på fridager.
 */

/** Gauss-algoritme for påskedag (Western/Gregorian). */
export function easterSundayYear(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function ymdUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD i Europe/Oslo for et UTC-instant. */
export function osloYmdFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function fixedHolidays(year: number): string[] {
  const y = String(year);
  return [`${y}-01-01`, `${y}-05-01`, `${y}-05-17`, `${y}-12-25`, `${y}-12-26`];
}

function movableHolidays(year: number): string[] {
  const easter = easterSundayYear(year);
  return [
    ymdUtc(addDaysUtc(easter, -3)), // skjærtorsdag
    ymdUtc(addDaysUtc(easter, -2)), // langfredag
    ymdUtc(easter), // 1. påskedag
    ymdUtc(addDaysUtc(easter, 1)), // 2. påskedag
    ymdUtc(addDaysUtc(easter, 39)), // Kristi himmelfartsdag
    ymdUtc(addDaysUtc(easter, 49)), // 1. pinsedag
    ymdUtc(addDaysUtc(easter, 50)), // 2. pinsedag
  ];
}

const holidayCache = new Map<number, ReadonlySet<string>>();

export function norwegianPublicHolidaysForYear(
  year: number,
): ReadonlySet<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const set = new Set([...fixedHolidays(year), ...movableHolidays(year)]);
  holidayCache.set(year, set);
  return set;
}

export function isNorwegianPublicHoliday(iso: string): boolean {
  const ymd = osloYmdFromIso(iso);
  const year = Number(ymd.slice(0, 4));
  return norwegianPublicHolidaysForYear(year).has(ymd);
}

/** Mandag–fredag før helligdag (forvarming). */
export function isNorwegianHolidayEve(iso: string): boolean {
  const d = new Date(iso);
  const next = addDaysUtc(d, 1);
  const nextYmd = osloYmdFromIso(next.toISOString());
  const year = Number(nextYmd.slice(0, 4));
  return norwegianPublicHolidaysForYear(year).has(nextYmd);
}
