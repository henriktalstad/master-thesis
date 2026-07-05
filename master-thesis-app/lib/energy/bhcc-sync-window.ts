import { utcDayMidnight, addUtcDays } from "@/lib/energy-prices/day-utils";
import { getThesisEvalWindow, parseThesisEnvDate } from "@/lib/config/thesis-eval";
import {
  addDaysToYmd,
  osloYmdFromDate,
  toUTCForOslo,
} from "@/lib/utils";

export type BhccSyncWindow = {
  /** Inkluderende start (UTC instant). */
  start: Date;
  /** Eksklusiv slutt — alle timer med `hour < endExclusive`. */
  endExclusive: Date;
  /** Siste fullstendige Oslo-kalenderdag i vinduet (typisk i går). */
  throughOsloYmd: string;
};

/**
 * Byggenergi (BHCC) følger plattform-konvensjon: data er komplett t.o.m. i går
 * (T+1 fra Elhub/Enelyze). Daglig sync kjøres ca. kl. 10 Oslo dagen etter.
 */
export function resolveBhccSyncWindow(input?: {
  start?: Date;
  /** Eksklusiv slutt — overstyre default (start av i dag Oslo). */
  endExclusive?: Date;
  reference?: Date;
  /** false = inkluder også dagens timer (kun manuell/debug). */
  throughYesterdayOslo?: boolean;
}): BhccSyncWindow {
  const reference = input?.reference ?? new Date();
  const todayOslo = osloYmdFromDate(reference);
  const yesterdayOslo = addDaysToYmd(todayOslo, -1);

  const throughYesterday = input?.throughYesterdayOslo !== false;
  const defaultEndExclusive = throughYesterday
    ? new Date(toUTCForOslo(addDaysToYmd(todayOslo, 0), 0))
    : addUtcDays(utcDayMidnight(reference), 1);

  const evalWin = getThesisEvalWindow();
  const start =
    input?.start ??
    evalWin.start ??
    parseThesisEnvDate(process.env.BHCC_SYNC_START) ??
    addUtcDays(defaultEndExclusive, -90);

  const endExclusive = input?.endExclusive ?? defaultEndExclusive;
  const throughOsloYmd = throughYesterday ? yesterdayOslo : addDaysToYmd(todayOslo, -1);

  return { start, endExclusive, throughOsloYmd };
}

/** Siste N Oslo-døgn som bør re-upsertes ved daglig sync (default: i går + forrige). */
export function recentOsloDayRefreshStart(
  throughOsloYmd: string,
  days = Number(process.env.BHCC_REFRESH_DAYS ?? "2"),
): Date {
  const startYmd = addDaysToYmd(throughOsloYmd, -(Math.max(1, days) - 1));
  return new Date(toUTCForOslo(startYmd, 0));
}
