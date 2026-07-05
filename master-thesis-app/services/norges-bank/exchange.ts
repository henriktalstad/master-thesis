import {
  addDaysToYmd,
  formatNorwegianDateTime,
  osloYmdFromDate,
} from "@/lib/utils";

/** Rå NB EXR per kalenderdag (YYYY-MM-DD). */
const eurNokByDateCache = new Map<string, number>();

/** Løst kurs for en forespurt referansedag (kan være fallback til eldre bankdag). */
const resolvedRateCache = new Map<string, EurNokRateResult>();

export type EurNokRateResult = {
  rate: number;
  /** Kalenderdag kursen faktisk kom fra (NB EXR). */
  rateDateYmd: string;
  /** Dagen vi ba om (f.eks. auksjonsdag). */
  requestedDateYmd: string;
  /** true når rateDateYmd ≠ requestedDateYmd. */
  isFallback: boolean;
  /** Antall dager mellom forespurt og brukt dato (0 = treff på dagen). */
  staleDays: number;
};

function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map((x) => parseInt(x, 10));
  const [y2, m2, d2] = toYmd.split("-").map((x) => parseInt(x, 10));
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (24 * 3600 * 1000));
}

function previousYmd(ymd: string): string {
  return addDaysToYmd(ymd, -1);
}

/**
 * Auksjonsdag (Oslo) for day-ahead med levering på `deliveryOsloYmd`.
 * Nord Pool beregner day-ahead på D−1 (ved helg: siste bankdag før levering).
 */
export function dayAheadAuctionOsloYmd(deliveryOsloYmd: string): string {
  return addDaysToYmd(deliveryOsloYmd, -1);
}

async function fetchNbExrForYmd(ymd: string): Promise<number | null> {
  if (eurNokByDateCache.has(ymd)) {
    return eurNokByDateCache.get(ymd) as number;
  }

  const url = `https://data.norges-bank.no/api/data/EXR/B.EUR.NOK.SP?startPeriod=${ymd}&endPeriod=${ymd}&format=sdmx-json&locale=no`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;

  const json = await res.json();
  const observations =
    json?.data?.dataSets?.[0]?.series?.["0:0:0:0"]?.observations;
  if (!observations || typeof observations !== "object") return null;

  const obsKeys = Object.keys(observations);
  if (obsKeys.length === 0) return null;

  const firstKey = obsKeys.sort()[0];
  const rawVal = observations[firstKey]?.[0];
  const value = Number(
    typeof rawVal === "string" ? rawVal.replace(",", ".") : rawVal,
  );
  if (!Number.isFinite(value) || value <= 0) return null;

  eurNokByDateCache.set(ymd, value);
  return value;
}

/**
 * Henter EUR→NOK (NB EXR B.EUR.NOK.SP) for en referansedag (YYYY-MM-DD).
 * Fallback: gå bakover inntil 14 dager til observasjon finnes.
 */
export async function resolveEurNokRateForYmd(
  requestedDateYmd: string,
): Promise<EurNokRateResult | null> {
  const cached = resolvedRateCache.get(requestedDateYmd);
  if (cached) return cached;

  let probeYmd = requestedDateYmd;
  for (let i = 0; i < 14; i++) {
    const rate = await fetchNbExrForYmd(probeYmd);
    if (rate != null) {
      const staleDays = Math.abs(daysBetweenYmd(requestedDateYmd, probeYmd));
      const result: EurNokRateResult = {
        rate,
        rateDateYmd: probeYmd,
        requestedDateYmd,
        isFallback: probeYmd !== requestedDateYmd,
        staleDays,
      };
      resolvedRateCache.set(requestedDateYmd, result);
      return result;
    }
    probeYmd = previousYmd(probeYmd);
  }
  return null;
}

/**
 * EUR/NOK for ENTSO-E day-ahead: kurs fra **auksjonsdag** (Oslo), ikke leveringsdag.
 * Matcher Nord Pool-praksis (preliminær kurs ~auksjonsdagen) bedre enn NB på leveringsdato.
 */
export async function getEurNokRateForDayAheadDelivery(
  deliveryDate: Date,
): Promise<EurNokRateResult | null> {
  const deliveryOsloYmd = osloYmdFromDate(deliveryDate);
  const auctionOsloYmd = dayAheadAuctionOsloYmd(deliveryOsloYmd);
  return resolveEurNokRateForYmd(auctionOsloYmd);
}

/**
 * @deprecated Bruk {@link getEurNokRateForDayAheadDelivery} for spot/ENTSO-E.
 * Henter kurs for UTC-kalenderdagen til `targetDate` (ikke auksjonsdag).
 */
export async function getEurNokRateForDate(
  targetDate: Date,
): Promise<number | null> {
  try {
    const y = targetDate.getUTCFullYear();
    const m = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(targetDate.getUTCDate()).padStart(2, "0");
    const resolved = await resolveEurNokRateForYmd(`${y}-${m}-${d}`);
    return resolved?.rate ?? null;
  } catch (e) {
    console.warn(
      `[NB-EXR] Klarte ikke hente historisk EUR/NOK for ${formatNorwegianDateTime(
        targetDate,
        { shortDate: true },
      )}`,
      e,
    );
    return null;
  }
}

/** Logger advarsel når kurs er eldre enn ønsket auksjonsdag. */
export function logEurNokRateQuality(
  context: string,
  deliveryOsloYmd: string,
  resolved: EurNokRateResult,
): void {
  if (resolved.staleDays === 0) return;
  console.warn(
    `[NB-EXR] ${context}: levering ${deliveryOsloYmd} – ba om kurs ${resolved.requestedDateYmd}, ` +
      `bruker ${resolved.rateDateYmd} (${resolved.rate}, ${resolved.staleDays} dager tilbake)`,
  );
}

/** Hjelper for tester / diagnose. */
export function clearEurNokCachesForTests(): void {
  eurNokByDateCache.clear();
  resolvedRateCache.clear();
}
