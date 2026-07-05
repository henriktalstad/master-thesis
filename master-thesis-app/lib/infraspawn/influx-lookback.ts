/** Infraspawn/Influx SQL kan typisk bare spørres ~2 dager tilbake. */
export const INFRASPAWN_INFLUX_MAX_LOOKBACK_HOURS_DEFAULT = 48;

export function resolveInfluxMaxLookbackHours(): number {
  const raw = Number(
    process.env.INFRASPAWN_INFLUX_MAX_LOOKBACK_HOURS ??
      String(INFRASPAWN_INFLUX_MAX_LOOKBACK_HOURS_DEFAULT),
  );
  if (!Number.isFinite(raw) || raw <= 0) {
    return INFRASPAWN_INFLUX_MAX_LOOKBACK_HOURS_DEFAULT;
  }
  return Math.min(168, Math.max(1, Math.floor(raw)));
}
export const INFRASPAWN_INFLUX_MAX_LOOKBACK_HOURS =
  INFRASPAWN_INFLUX_MAX_LOOKBACK_HOURS_DEFAULT;

export function getInfluxEarliestQueryableAt(now: Date = new Date()): Date {
  return new Date(
    now.getTime() - resolveInfluxMaxLookbackHours() * 3_600_000,
  );
}

export function clipRangeToInfluxLookback(input: {
  start: Date;
  end: Date;
  now?: Date;
}): {
  start: Date;
  end: Date;
  clipped: boolean;
  influxEarliest: Date;
  queryable: boolean;
} {
  const influxEarliest = getInfluxEarliestQueryableAt(input.now);
  const end = input.end;
  let start = input.start;
  let clipped = false;

  if (start.getTime() < influxEarliest.getTime()) {
    start = influxEarliest;
    clipped = true;
  }

  return {
    start,
    end,
    clipped,
    influxEarliest,
    queryable: start.getTime() < end.getTime(),
  };
}

export function evalStartsBeforeInfluxLookback(
  evalStart: Date,
  now: Date = new Date(),
): boolean {
  return evalStart.getTime() < getInfluxEarliestQueryableAt(now).getTime();
}
