export function utcDayMidnight(instant: Date): Date {
  return new Date(
    Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export function addUtcDays(day: Date, delta: number): Date {
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + delta);
  return utcDayMidnight(next);
}

export function utcYmd(day: Date): string {
  return day.toISOString().split("T")[0]!;
}
