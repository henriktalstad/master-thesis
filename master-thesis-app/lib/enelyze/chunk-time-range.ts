export type EnelyzeTimeInterval = {
  start: Date;
  /** Inkluderende slutt for API-kall (plattform sender ISO til end). */
  end: Date;
};

/**
 * Deler [start, endExclusive) i intervaller på maks `maxDays` kalenderdager.
 * Enelyze API tillater typisk maks ~31 dager per kall.
 */
export function generateEnelyzeIntervals(
  start: Date,
  endExclusive: Date,
  maxDays = 31,
): EnelyzeTimeInterval[] {
  if (!(start instanceof Date) || !(endExclusive instanceof Date)) return [];
  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    return [];
  }
  if (start >= endExclusive) return [];

  const intervals: EnelyzeTimeInterval[] = [];
  let currentStart = new Date(start);

  while (currentStart < endExclusive) {
    const currentEnd = new Date(currentStart);
    currentEnd.setUTCDate(currentEnd.getUTCDate() + maxDays - 1);
    currentEnd.setUTCHours(23, 59, 59, 999);

    const intervalEnd =
      currentEnd >= endExclusive
        ? new Date(endExclusive.getTime() - 1)
        : currentEnd;

    if (intervalEnd >= currentStart) {
      intervals.push({
        start: new Date(currentStart),
        end: intervalEnd,
      });
    }

    currentStart = new Date(intervalEnd);
    currentStart.setUTCDate(currentStart.getUTCDate() + 1);
    currentStart.setUTCHours(0, 0, 0, 0);
  }

  return intervals;
}
