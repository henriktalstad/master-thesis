export const INFRASPAWN_SYNC_QUERY_WINDOW_MS = 60 * 60 * 1000;
export const INFRASPAWN_SYNC_MIN_QUERY_WINDOW_MS = 5 * 60 * 1000;

export function isInfluxFileLimitError(message: string): boolean {
  return /file limit|Parquet files/i.test(message);
}

export function shrinkSyncQueryWindowMs(currentMs: number): number | null {
  const next = Math.floor(currentMs / 2);
  if (next < INFRASPAWN_SYNC_MIN_QUERY_WINDOW_MS) return null;
  return next;
}

export function computeSyncWindowUntil(input: {
  cursor: Date;
  syncUntil: Date;
  windowMs: number;
}): Date {
  return new Date(
    Math.min(input.cursor.getTime() + input.windowMs, input.syncUntil.getTime()),
  );
}

export function advanceSyncAfterEmptyWindow(input: {
  windowUntil: Date;
  syncUntil: Date;
  windowMs: number;
}): { cursor: Date; windowUntil: Date; done: boolean } {
  const cursor = input.windowUntil;
  return {
    cursor,
    windowUntil: computeSyncWindowUntil({
      cursor,
      syncUntil: input.syncUntil,
      windowMs: input.windowMs,
    }),
    done: cursor.getTime() >= input.syncUntil.getTime(),
  };
}

export function advanceSyncAfterPage(input: {
  cursor: Date;
  windowUntil: Date;
  syncUntil: Date;
  pageMax: Date;
  rowCount: number;
  maxRowsPerRun: number;
  overlapMs: number;
  windowMs: number;
}): { cursor: Date; windowUntil: Date; done: boolean } {
  if (input.rowCount >= input.maxRowsPerRun) {
    return {
      cursor: new Date(input.pageMax.getTime() - input.overlapMs),
      windowUntil: input.windowUntil,
      done: false,
    };
  }

  const windowEndThreshold = input.windowUntil.getTime() - input.overlapMs;
  if (input.pageMax.getTime() >= windowEndThreshold) {
    const cursor = input.windowUntil;
    return {
      cursor,
      windowUntil: computeSyncWindowUntil({
        cursor,
        syncUntil: input.syncUntil,
        windowMs: input.windowMs,
      }),
      done: cursor.getTime() >= input.syncUntil.getTime(),
    };
  }

  return {
    cursor: new Date(input.pageMax.getTime() - input.overlapMs),
    windowUntil: input.windowUntil,
    done: true,
  };
}
