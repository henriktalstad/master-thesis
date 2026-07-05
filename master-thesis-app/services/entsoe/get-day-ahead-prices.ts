import {
  parseEntsoeXmlSubHourly,
  type SubHourlyEurPoint,
} from "@/lib/entsoe/xml-to-json";
import {
  aggregateHourlyToDaily,
  aggregateQuarterHourlyToHourly,
  slotFromInstant,
  type QuarterHourlyPricePoint,
} from "@/lib/energy-prices/derive-energy-price-aggregates";
import { osloYmdFromDate } from "@/lib/utils";
import {
  getEurNokRateForDayAheadDelivery,
  logEurNokRateQuality,
} from "@/services/norges-bank/exchange";

export enum AreaCode {
  NO1 = "10YNO-1--------2",
  NO2 = "10YNO-2--------T",
  NO3 = "10YNO-3--------J",
  NO4 = "10YNO-4--------9",
  NO5 = "10Y1001A1001A48H",
}

export const AREA_CODE_MAP: Record<AreaCode, string> = {
  [AreaCode.NO1]: "NO1",
  [AreaCode.NO2]: "NO2",
  [AreaCode.NO3]: "NO3",
  [AreaCode.NO4]: "NO4",
  [AreaCode.NO5]: "NO5",
};

export const SHORT_TO_API_CODE: Record<string, AreaCode> = {
  NO1: AreaCode.NO1,
  NO2: AreaCode.NO2,
  NO3: AreaCode.NO3,
  NO4: AreaCode.NO4,
  NO5: AreaCode.NO5,
};

export interface PricePoint {
  date: string;
  price: number;
  area: string;
  areaCode: string;
}

export type DayAheadPriceBundle = {
  quarterHourly: QuarterHourlyPricePoint[];
  hourly: PricePoint[];
  daily: PricePoint | null;
};

function formatDateForEntsoe(date: Date): string {
  const utcDate = new Date(date);
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utcDate.getUTCDate()).padStart(2, "0");
  const hour = String(utcDate.getUTCHours()).padStart(2, "0");
  const minute = String(utcDate.getUTCMinutes()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}`;
}

const ENTSOE_RETRY_ATTEMPTS = 3;
const ENTSOE_RETRY_BASE_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

function resolveApiAreaCode(areaCode: string): AreaCode {
  if (areaCode.startsWith("10Y")) {
    if (!Object.values(AreaCode).includes(areaCode as AreaCode)) {
      throw new Error(`Ugyldig API områdekode: ${areaCode}`);
    }
    return areaCode as AreaCode;
  }
  if (!SHORT_TO_API_CODE[areaCode]) {
    throw new Error(`Ugyldig områdekode: ${areaCode}`);
  }
  return SHORT_TO_API_CODE[areaCode];
}

function sanitizeEurSeries(
  points: SubHourlyEurPoint[],
): SubHourlyEurPoint[] {
  const sorted = [...points].sort(
    (a, b) => a.instant.getTime() - b.instant.getTime(),
  );
  let lastValidEur: number | null = null;
  return sorted.map((p, idx, arr) => {
    const isValid = Number.isFinite(p.priceEurPerMwh);
    if (isValid) {
      lastValidEur = p.priceEurPerMwh;
      return p;
    }
    if (lastValidEur == null) {
      for (let j = idx + 1; j < arr.length; j++) {
        if (Number.isFinite(arr[j]!.priceEurPerMwh)) {
          return { ...p, priceEurPerMwh: arr[j]!.priceEurPerMwh };
        }
      }
      return { ...p, priceEurPerMwh: 0 };
    }
    return { ...p, priceEurPerMwh: lastValidEur };
  });
}

function convertEurPerMwhToNokPerKwh(
  eurPerMwh: number,
  exchangeRate: number,
  apiAreaCode: AreaCode,
): number {
  let nokPrice = (eurPerMwh * exchangeRate) / 1000;
  if (apiAreaCode !== AreaCode.NO4) {
    nokPrice *= 1.25;
  }
  return parseFloat(nokPrice.toFixed(4));
}

function convertSubHourlyToQuarterHourlyNok(
  points: SubHourlyEurPoint[],
  apiAreaCode: AreaCode,
  exchangeRate: number,
): QuarterHourlyPricePoint[] {
  const dbAreaCode = AREA_CODE_MAP[apiAreaCode] || "NO1";
  const sanitized = sanitizeEurSeries(points);

  return sanitized.map((p) => {
    const { dateUtc, hour, quarter } = slotFromInstant(p.instant);
    const iso = new Date(
      Date.UTC(
        dateUtc.getUTCFullYear(),
        dateUtc.getUTCMonth(),
        dateUtc.getUTCDate(),
        hour,
        quarter * 15,
        0,
        0,
      ),
    ).toISOString();

    return {
      date: iso,
      price: convertEurPerMwhToNokPerKwh(
        p.priceEurPerMwh,
        exchangeRate,
        apiAreaCode,
      ),
      area: dbAreaCode,
      areaCode: dbAreaCode,
      hour,
      quarter,
    };
  });
}

async function fetchEntsoeXml(
  apiAreaCode: AreaCode,
  date: Date,
  contractType: "A01" | "A07",
): Promise<string> {
  const securityToken = process.env.ENTSOE_SECURITY_TOKEN;
  if (!securityToken) {
    throw new Error("ENTSOE_SECURITY_TOKEN mangler i miljøvariablene");
  }

  const startDate = new Date(date);
  startDate.setUTCDate(startDate.getUTCDate() - 1);
  startDate.setUTCHours(22, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  endDate.setUTCHours(22, 0, 0, 0);

  const url = new URL("https://web-api.tp.entsoe.eu/api");
  url.searchParams.append("securityToken", securityToken);
  url.searchParams.append("documentType", "A44");
  url.searchParams.append("in_Domain", apiAreaCode);
  url.searchParams.append("out_Domain", apiAreaCode);
  url.searchParams.append("periodStart", formatDateForEntsoe(startDate));
  url.searchParams.append("periodEnd", formatDateForEntsoe(endDate));
  url.searchParams.append("contract_MarketAgreement.type", contractType);

  let response: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= ENTSOE_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/xml" },
      });

      if (res.ok) {
        response = res;
        break;
      }

      const isRetryable = isRetryableHttpStatus(res.status);
      const isLastAttempt = attempt === ENTSOE_RETRY_ATTEMPTS;
      if (!isRetryable || isLastAttempt) {
        throw new Error(`ENTSOE API feil: ${res.status} ${res.statusText}`);
      }

      lastError = new Error(
        `ENTSOE API feil: ${res.status} ${res.statusText}`,
      );
      const backoffMs =
        ENTSOE_RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 500);
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          `[ENTSOE] API ${res.status} – retry ${attempt + 1}/${ENTSOE_RETRY_ATTEMPTS} om ${Math.round(backoffMs / 1000)}s`,
        );
      }
      await sleep(backoffMs);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError" || attempt >= ENTSOE_RETRY_ATTEMPTS) {
        throw lastError;
      }
      const backoffMs =
        ENTSOE_RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 500);
      await sleep(backoffMs);
    }
  }

  if (!response) {
    throw lastError ?? new Error("ENTSOE API: Ukjent feil");
  }

  return response.text();
}

function filterPointsForOsloDay<T extends { instant?: Date; date?: string }>(
  points: T[],
  targetDate: Date,
  getInstant: (p: T) => Date,
): T[] {
  const fmtOsloYmd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const targetDateOslo = fmtOsloYmd.format(targetDate);
  return points.filter((p) => {
    const priceDateOslo = fmtOsloYmd.format(getInstant(p));
    return priceDateOslo === targetDateOslo;
  });
}

/**
 * Henter day-ahead bundle: 15-min + avledet time + dag.
 */
export async function getDayAheadPriceBundle(
  areaCode: string,
  date: Date,
  contractType: "A01" | "A07" = "A01",
): Promise<DayAheadPriceBundle> {
  if (!areaCode) throw new Error("AreaCode er påkrevd");
  if (!date) throw new Error("Dato er påkrevd");

  const apiAreaCode = resolveApiAreaCode(areaCode);
  const xml = await fetchEntsoeXml(apiAreaCode, date, contractType);
  const subHourlyEur = await parseEntsoeXmlSubHourly(xml);

  if (!subHourlyEur.length) {
    return { quarterHourly: [], hourly: [], daily: null };
  }

  const forTargetDayEur = filterPointsForOsloDay(
    subHourlyEur,
    date,
    (p) => p.instant,
  );

  const targetDateOslo = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const eurNokResolved = await getEurNokRateForDayAheadDelivery(date);
  if (eurNokResolved == null) {
    console.error(
      `[ENTSOE] Mangler historisk EUR/NOK for levering ${targetDateOslo} – hopper over prisene fra ENTSO-E for denne datoen.`,
    );
    return { quarterHourly: [], hourly: [], daily: null };
  }

  logEurNokRateQuality(
    "ENTSO-E day-ahead",
    osloYmdFromDate(date),
    eurNokResolved,
  );

  const quarterHourly = convertSubHourlyToQuarterHourlyNok(
    forTargetDayEur,
    apiAreaCode,
    eurNokResolved.rate,
  );
  const hourly = aggregateQuarterHourlyToHourly(quarterHourly);
  const daily = aggregateHourlyToDaily(hourly, date);

  return { quarterHourly, hourly, daily };
}
