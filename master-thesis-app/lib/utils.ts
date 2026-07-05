import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  DAYS_IN_PERIOD,
  PERIOD_DAYS,
  PERIOD_LABELS,
  PERIOD_LABEL_FORMAT,
  type PeriodOption,
} from "@/types/periods";
import {
  ELHUB_MPID_MAX_LENGTH,
  ELHUB_MPID_PREFIX,
  isValidElhubMpid,
} from "@/lib/meter-archetypes";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 0,
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0";
  }
  return value.toLocaleString("nb-NO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function roundPct1(v: number): number {
  return Math.round((v + Number.EPSILON) * 10) / 10;
}

export function generateEnergyAttestSlug(
  address: string,
  dateOfIssue?: Date | null,
  certificateNumber?: string,
): string {
  const normalizedAddress = address
    .toLowerCase()
    .replace(/[æøå]/g, (match) => {
      const replacements: Record<string, string> = { æ: "ae", ø: "o", å: "a" };
      return replacements[match] || match;
    })
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const year = dateOfIssue ? dateOfIssue.getFullYear() : undefined;

  const certSuffix = certificateNumber
    ? `-${certificateNumber.slice(-6)}`
    : "";

  const base =
    year !== undefined ? `${normalizedAddress}-${year}` : normalizedAddress;
  return `${base}${certSuffix}`.slice(0, 100);
}

export function formatBytes(
  bytes: number,
  opts: {
    decimals?: number;
    sizeType?: "accurate" | "normal";
  } = {},
) {
  const { decimals = 0, sizeType = "normal" } = opts;

  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const accurateSizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
  if (bytes === 0) return "0 Byte";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${
    sizeType === "accurate"
      ? (accurateSizes[i] ?? "Bytest")
      : (sizes[i] ?? "Bytes")
  }`;
}

export function calculateAverageNumber(values: number[]): number {
  if (values.length === 0) {
    return 0; // Returns 0 if no values are given
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

export type RegionToElectricityZoneMap = {
  [key: string]: string;
};

export type MunicipalityToRegionMap = {
  [key: string]: string;
};

export const regionToElectricityZone: RegionToElectricityZoneMap = {
  Østlandet: "NO1",
  Sørlandet: "NO2",
  "Midt-Norge": "NO3",
  "Nord-Norge": "NO4",
  Vestlandet: "NO5",
  Oslo: "NO1",
  Akershus: "NO1",
  Buskerud: "NO1",
  Østfold: "NO1",
  Innlandet: "NO1",
  Vestfold: "NO1",
  Telemark: "NO2",
  Agder: "NO2",
  Rogaland: "NO2",
  Vestland: "NO5",
  "Møre og Romsdal": "NO3",
  Trøndelag: "NO3",
  Nordland: "NO4",
  Troms: "NO4",
  Finnmark: "NO4",
  Viken: "NO1",
};

export const countyCodeToName: Record<string, string> = {
  "03": "Oslo",
  "11": "Rogaland",
  "15": "Møre og Romsdal",
  "18": "Nordland",
  "30": "Akershus", // Viken (2020-2023) -> Mapper til Akershus for å treffe gyldige tariffer
  "31": "Østfold",
  "32": "Akershus",
  "33": "Buskerud",
  "34": "Innlandet",
  "38": "Vestfold", // Vestfold og Telemark (2020-2023) -> Mapper til Vestfold
  "39": "Vestfold",
  "40": "Telemark",
  "42": "Agder",
  "46": "Vestland",
  "50": "Trøndelag",
  "54": "Troms", // Troms og Finnmark (2020-2023) -> Mapper til Troms
  "55": "Troms",
  "56": "Finnmark",
  "99": "Uoppgitt",
};

export const countyNameToCode: Record<string, string> = Object.fromEntries(
  Object.entries(countyCodeToName).map(([code, name]) => [name, code]),
);

export const counties = Object.entries(countyCodeToName).map(
  ([code, name]) => ({
    code,
    name,
  }),
);

export function countyCodesFromMunicipalityNumber(
  municipalityNumber: string | null | undefined,
): string[] {
  if (!municipalityNumber) return [];
  const raw = municipalityNumber.trim();
  if (raw.length < 2) return [];
  const prefix = raw.slice(0, 2);

  if (prefix === "30") return ["31", "32", "33"];
  if (prefix === "38") return ["39", "40"];
  if (prefix === "54") return ["55", "56"];

  return [prefix.padStart(2, "0")];
}

export function countyNamesFromMunicipalityNumber(
  municipalityNumber: string | null | undefined,
): string[] {
  const codes = countyCodesFromMunicipalityNumber(municipalityNumber);
  const names = codes
    .map((c) => countyCodeToName[c])
    .filter((v): v is string => Boolean(v));
  return Array.from(new Set(names));
}

export const countyCodeToElectricityZone: Record<string, string> = {
  "03": "NO1", // Oslo
  "11": "NO2", // Rogaland
  "15": "NO3", // Møre og Romsdal
  "18": "NO4", // Nordland - Nordlánnda
  "30": "NO1", // Viken (Historisk) - hovedsakelig NO1
  "31": "NO1", // Østfold
  "32": "NO1", // Akershus
  "33": "NO1", // Buskerud
  "34": "NO1", // Innlandet
  "38": "NO1", // Vestfold og Telemark (Historisk) - blandet, mapper til NO1 som default
  "39": "NO1", // Vestfold
  "40": "NO2", // Telemark
  "42": "NO2", // Agder
  "46": "NO5", // Vestland
  "50": "NO3", // Trøndelag - Trööndelage
  "54": "NO4", // Troms og Finnmark (Historisk)
  "55": "NO4", // Troms - Romsa - Tromssa
  "56": "NO4", // Finnmark - Finnmárku - Finmarkku
  "99": "NO1", // Uoppgitt (default til Østlandet)
};

export const countyCodeToRegion: Record<string, string> = {
  "03": "Østlandet",
  "11": "Sørlandet", // Rogaland (ofte regnet som Sørlandet i regioninndeling)
  "15": "Midt-Norge",
  "18": "Nord-Norge",
  "30": "Østlandet", // Viken
  "31": "Østlandet",
  "32": "Østlandet",
  "33": "Østlandet",
  "34": "Østlandet",
  "38": "Østlandet", // Vestfold og Telemark (Telemark er også Sørlandet i strømsone, men geografisk Østlandet?)
  "39": "Østlandet",
  "40": "Sørlandet",
  "42": "Sørlandet",
  "46": "Vestlandet",
  "50": "Midt-Norge",
  "54": "Nord-Norge", // Troms og Finnmark
  "55": "Nord-Norge",
  "56": "Nord-Norge",
  "99": "Østlandet", // fallback
};

export const landsdelToFylker: Record<string, string[]> = {
  Østlandet: [
    "Oslo",
    "Akershus",
    "Innlandet",
    "Østfold",
    "Buskerud",
    "Vestfold",
    "Telemark",
  ],
  Sørlandet: ["Agder", "Rogaland"],
  Vestlandet: ["Vestland", "Møre og Romsdal"],
  "Midt-Norge": ["Trøndelag"],
  "Nord-Norge": ["Nordland", "Troms", "Finnmark"],
};

export function getRegionFromMunicipalityNumber(
  municipalityNumber: string,
): string {
  const countyCode = municipalityNumber.substring(0, 2);
  return countyCodeToRegion[countyCode] ?? "Østlandet";
}

export const countyNameToElectricityZone: Record<string, string> =
  Object.fromEntries(
    Object.entries(countyCodeToElectricityZone).map(([code, zone]) => [
      countyCodeToName[code],
      zone,
    ]),
  );

function buildPostNumberPrefixToZone(): Record<string, string> {
  const m: Record<string, string> = {};
  const no1 = "NO1";
  const no2 = "NO2";
  const no3 = "NO3";
  const no4 = "NO4";
  const no5 = "NO5";
  for (let i = 0; i <= 12; i++) m[String(i).padStart(2, "0")] = no1;
  for (let i = 13; i <= 39; i++) m[String(i).padStart(2, "0")] = no1;
  for (let i = 40; i <= 46; i++) m[String(i).padStart(2, "0")] = no2;
  for (let i = 47; i <= 49; i++) m[String(i).padStart(2, "0")] = no5;
  for (let i = 50; i <= 54; i++) m[String(i).padStart(2, "0")] = no3;
  for (let i = 55; i <= 59; i++) m[String(i).padStart(2, "0")] = no4;
  for (let i = 60; i <= 65; i++) m[String(i).padStart(2, "0")] = no3;
  for (let i = 66; i <= 69; i++) m[String(i).padStart(2, "0")] = no5;
  for (let i = 70; i <= 99; i++) m[String(i).padStart(2, "0")] = no4;
  return m;
}
export const postNumberPrefixToElectricityZone: Record<string, string> =
  buildPostNumberPrefixToZone();

export function getElectricityZoneForPostCode(
  postCode: string | null | undefined,
): string {
  if (!postCode || typeof postCode !== "string") return "ukjent";
  const raw = postCode.trim().replace(/\s/g, "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 2) return "ukjent";
  const prefix = digits.slice(0, 2);
  return postNumberPrefixToElectricityZone[prefix] ?? "ukjent";
}

export function orderedExtraCountyNamesForGridTariffLookup(
  region: string | null | undefined,
  alreadyTried: readonly string[],
  postCode?: string | null | undefined,
): string[] {
  const tried = new Set(alreadyTried.filter(Boolean));
  const r = region?.trim();
  if (!r) return [];

  let pool: string[];
  const fromLandsdel = landsdelToFylker[r];
  if (fromLandsdel?.length) {
    pool = fromLandsdel.filter((c) => !tried.has(c));
  } else if (!tried.has(r)) {
    pool = [r];
  } else {
    pool = [];
  }

  const zone = getElectricityZoneForPostCode(postCode);
  if (zone === "ukjent" || pool.length <= 1) {
    return pool.toSorted((a, b) => a.localeCompare(b, "nb"));
  }

  return pool.toSorted((a, b) => {
    const za = countyNameToElectricityZone[a];
    const zb = countyNameToElectricityZone[b];
    const ma = za === zone ? 0 : 1;
    const mb = zb === zone ? 0 : 1;
    if (ma !== mb) return ma - mb;
    return a.localeCompare(b, "nb");
  });
}

export function allCountyNamesForGridTariffLookup(
  countyCandidates: readonly string[],
  region: string | null | undefined,
  postCode?: string | null | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of countyCandidates) {
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  for (const c of orderedExtraCountyNamesForGridTariffLookup(
    region,
    countyCandidates,
    postCode,
  )) {
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

export function getElectricityZoneForMunicipalityName(
  name: string | null | undefined,
): string {
  if (!name || typeof name !== "string") return "ukjent";
  const trimmed = name.trim();
  if (!trimmed) return "ukjent";
  const zone = countyNameToElectricityZone[trimmed];
  if (zone) return zone;
  const lower = trimmed.toLowerCase();
  for (const [countyName, z] of Object.entries(countyNameToElectricityZone)) {
    if (countyName.toLowerCase() === lower) return z;
  }
  return "ukjent";
}

export const buildingCategory = [
  {
    label: "Småhus",
    description: "Eneboliger, tomannsboliger, rekkehus og andre småhus",
  },
  {
    label: "Boligblokker",
    description: "Flerfamiliehus, leilighetsbygg og boligblokker",
  },
  {
    label: "Kontorbygg",
    description: "Kontorbygg og administrasjonsbygninger",
  },
  {
    label: "Forretningsbygg",
    description: "Butikker, kjøpesentre og andre forretningsbygninger",
  },
  {
    label: "Skolebygg",
    description:
      "Grunnskoler, videregående skoler og andre undervisningsbygninger",
  },
  {
    label: "Universitets- og høgskolebygg",
    description: "Universiteter, høgskoler og forskningsinstitusjoner",
  },
  {
    label: "Barnehager",
    description: "Barnehager og andre barneinstitusjoner",
  },
  {
    label: "Sykehus",
    description: "Sykehus, klinikker og andre helseinstitusjoner",
  },
  {
    label: "Hoteller",
    description: "Hoteller, moteller og andre overnattingssteder",
  },
  {
    label: "Idrettsbygg",
    description: "Idrettshaller, svømmehaller og andre idrettsanlegg",
  },
  {
    label: "Kulturbygg",
    description: "Teatre, kinoer, museer og andre kulturbygninger",
  },
  {
    label: "Lett industri, verksteder",
    description: "Lett industri, verksteder og produksjonsbygninger",
  },
  {
    label: "Industribygg",
    description: "Tung industri og store produksjonsanlegg",
  },
];

export const kartverketToEnovaMapping: Record<string, string> = {
  Enebolig: "Småhus",
  Tomannsbolig: "Småhus",
  Smahus: "Småhus",
  Rekkehus: "Småhus",
  Kjedehus: "Småhus",
  Småhus: "Småhus",
  Boligblokk: "Boligblokker",
  Flerfamiliehus: "Boligblokker",
  Leilighetsbygg: "Boligblokker",
  Terrassehus: "Småhus",

  Kontor: "Kontorbygg",
  Kontorbygg: "Kontorbygg",
  Forretning: "Forretningsbygg",
  Butikk: "Forretningsbygg",
  Kjøpesenter: "Forretningsbygg",

  Skole: "Skolebygg",
  Grunnskole: "Skolebygg",
  "Videregående skole": "Skolebygg",
  Universitet: "Universitets- og høgskolebygg",
  Høgskole: "Universitets- og høgskolebygg",
  UniversitetHoyskole: "Universitets- og høgskolebygg",
  Barnehage: "Barnehager",

  Sykehus: "Sykehus",
  Klinikk: "Sykehus",
  Legekontor: "Sykehus",

  Hotell: "Hoteller",
  Motell: "Hoteller",

  Idrettshall: "Idrettsbygg",
  Svømmehall: "Idrettsbygg",
  Teater: "Kulturbygg",
  Kino: "Kulturbygg",
  Museum: "Kulturbygg",

  Industri: "Industribygg",
  Verksted: "Lett industri, verksteder",
  Lager: "Lett industri, verksteder",
  Produksjon: "Lett industri, verksteder",
};

export type DateRange = {
  from: Date;
  to: Date;
};

export interface CarbonIntensityOption {
  value: number;
  label: string;
  source: string;
}

export const carbonIntensityOptions: CarbonIntensityOption[] = [
  {
    value: 5.5,
    label: "GHG Protocol 2005",
    source: "GHG Protocol 2005",
  },
  {
    value: 7,
    label: "EN 15603:2008",
    source: "EN 15603:2008, vannkraft transformering primærenergi",
  },
  {
    value: 18,
    label: "ENTSO-E (2024)",
    source: "European Network of Transmission System Operators for Electricity",
  },
  {
    value: 19,
    label: "ENTSO-E (2023)",
    source: "European Network of Transmission System Operators for Electricity",
  },
  {
    value: 50,
    label: "SFT klimakalkulator",
    source: "SFT klimakalkulator",
  },
  {
    value: 107,
    label: "Nordisk miks",
    source: "Nordisk miks, 5 år snitt, Nordel, Vattenfall",
  },
  {
    value: 211,
    label: "Klimaløftet",
    source: "Klimaløftet, nordisk miks, ny",
  },
  {
    value: 275,
    label: "Klimaplan Oslo og Akershus",
    source: "Klimaplan Oslo og Akershus, middel import Danmark",
  },
  {
    value: 357,
    label: "OECD Europa snitt",
    source: "OECD Europa snitt, GBA, Statsbygg",
  },
  {
    value: 395,
    label: "Passivhusstandard",
    source:
      "Forslag passivhusstandard, Enova forbildeprosjekter, marginal gasskraft",
  },
  {
    value: 560,
    label: "Europeisk miks",
    source: "Europeisk miks, Ecohz",
  },
  {
    value: 600,
    label: "Enova veileder",
    source: "Enova veileder, energi- og klimaplaner",
  },
];

export function getPeriodTextDisplay(
  period: PeriodOption,
  isForPrevious = false,
): string {
  if (isForPrevious) {
    switch (period) {
      case "year":
        return "forrige år";
      case "month":
        return "forrige måned";
      case "7days":
        return "forrige uke";
      default:
        return "forrige periode";
    }
  }

  switch (period) {
    case "year":
      return "året";
    case "month":
      return "måneden";
    case "7days":
      return "uken";
    default:
      return "perioden";
  }
}

export function getCurrentPeriodRange(periodOption: PeriodOption): {
  startDate: Date;
  endDate: Date;
} {
  const fmtOsloDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const dateStrFromUTC = (d: Date) => fmtOsloDate.format(d);

  const now = new Date();
  const todayOsloStr = dateStrFromUTC(now);
  const yesterdayOsloStr = addDaysToYmd(todayOsloStr, -1);

  const periodLength = PERIOD_DAYS[periodOption] ?? 365;
  const daysBack = periodLength - 1;

  const startOsloStr = addDaysToYmd(yesterdayOsloStr, -daysBack);

  const startIso = toUTCForOslo(startOsloStr, 0);
  const endIso23 = toUTCForOslo(yesterdayOsloStr, 23);
  const startDate = new Date(startIso);
  const endDate = new Date(endIso23);
  endDate.setUTCMinutes(59, 59, 999);

  return { startDate, endDate };
}

export type ExtendedPeriodOption = PeriodOption | "day" | "3months" | "6months";

export function getPeriodRangeOslo(period: ExtendedPeriodOption): {
  from: Date;
  endDate: Date;
} {
  const fmtOslo = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const dateStrFromUTC = (d: Date) => fmtOslo.format(d);
  const now = new Date();
  const todayOsloStr = dateStrFromUTC(now);
  const yesterdayOsloStr = addDaysToYmd(todayOsloStr, -1);

  let startOsloStr: string;
  switch (period) {
    case "day":
      startOsloStr = yesterdayOsloStr;
      break;
    case "7days":
      startOsloStr = addDaysToYmd(yesterdayOsloStr, -6);
      break;
    case "month":
      startOsloStr = addDaysToYmd(yesterdayOsloStr, -29);
      break;
    case "3months": {
      const d = new Date(
        Date.UTC(
          parseInt(yesterdayOsloStr.slice(0, 4), 10),
          parseInt(yesterdayOsloStr.slice(5, 7), 10) - 1,
          parseInt(yesterdayOsloStr.slice(8, 10), 10),
          12,
          0,
          0,
        ),
      );
      d.setUTCMonth(d.getUTCMonth() - 3);
      startOsloStr = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
      break;
    }
    case "6months": {
      const d = new Date(
        Date.UTC(
          parseInt(yesterdayOsloStr.slice(0, 4), 10),
          parseInt(yesterdayOsloStr.slice(5, 7), 10) - 1,
          parseInt(yesterdayOsloStr.slice(8, 10), 10),
          12,
          0,
          0,
        ),
      );
      d.setUTCMonth(d.getUTCMonth() - 6);
      startOsloStr = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
      break;
    }
    case "year": {
      const d = new Date(
        Date.UTC(
          parseInt(yesterdayOsloStr.slice(0, 4), 10),
          parseInt(yesterdayOsloStr.slice(5, 7), 10) - 1,
          parseInt(yesterdayOsloStr.slice(8, 10), 10),
          12,
          0,
          0,
        ),
      );
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      startOsloStr = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
      break;
    }
    default:
      startOsloStr = addDaysToYmd(yesterdayOsloStr, -29);
  }

  const fromIso = toUTCForOslo(startOsloStr, 0);
  const endIso = toUTCForOslo(yesterdayOsloStr, 23);
  const endDate = new Date(endIso);
  endDate.setUTCMinutes(59, 59, 999);
  return { from: new Date(fromIso), endDate };
}

export function shiftRangeByYear(range: { from: Date; endDate: Date }): {
  from: Date;
  endDate: Date;
} {
  const from = new Date(range.from);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  const endDate = new Date(range.endDate);
  endDate.setUTCFullYear(endDate.getUTCFullYear() - 1);
  return { from, endDate };
}

export function getSisteFullførteMånedOslo(): { year: number; month: number } {
  const now = new Date();
  const todayOslo = osloYmdFromDate(now);
  const [y, m] = todayOslo.split("-").map((x) => parseInt(x, 10));
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  return { year: prevYear, month: prevMonth };
}

export function getSisteFullførteMånedOsloMedUtcRange(): {
  year: number;
  month: number;
  startUtc: Date;
  endUtc: Date;
} {
  const { year, month } = getSisteFullførteMånedOslo();
  const { periodStart, periodEnd } = getMånedPeriodeOslo(year, month);
  return {
    year,
    month,
    startUtc: periodStart,
    endUtc: periodEnd,
  };
}

export function getMånedPeriodeOslo(
  year: number,
  month: number,
): {
  periodStart: Date;
  periodEnd: Date;
} {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const periodStart = new Date(toUTCForOslo(`${year}-${pad2(month)}-01`, 0));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodEnd = new Date(
    toUTCForOslo(`${year}-${pad2(month)}-${pad2(lastDay)}`, 23),
  );
  periodEnd.setUTCMinutes(59, 59, 999);
  return { periodStart, periodEnd };
}

export function getNesteMånedStartOslo(year: number, month: number): Date {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return new Date(toUTCForOslo(`${next.y}-${pad2(next.m)}-01`, 0));
}

export function osloYmdFromDate(date: Date): string {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "1970-01-01";
  } catch {
    return "1970-01-01";
  }
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // YYYY-MM-DD
}

export function effectivePeriodMatchesCache(
  currentStart: Date,
  currentEnd: Date,
  periodAdjusted: { start: string; end: string } | undefined,
): boolean {
  if (!periodAdjusted) return false;
  try {
    const cacheStart = new Date(periodAdjusted.start);
    const cacheEnd = new Date(periodAdjusted.end);
    if (isNaN(cacheStart.getTime()) || isNaN(cacheEnd.getTime())) return false;
    return (
      osloYmdFromDate(cacheStart) === osloYmdFromDate(currentStart) &&
      osloYmdFromDate(cacheEnd) === osloYmdFromDate(currentEnd)
    );
  } catch {
    return false;
  }
}

export function utcYmdFromDate(date: Date): string {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "1970-01-01";
  } catch {
    return "1970-01-01";
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function osloHourFromDate(date: Date): number {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) return 0;
  } catch {
    return 0;
  }
  const fmt = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(fmt.format(date), 10);
}

export function osloDayOfWeekFromDate(date: Date): number {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) return 0;
  } catch {
    return 0;
  }
  const dayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[dayStr] ?? 0;
}

export function toOsloDateHour(d: Date): { date: string; hour: number } {
  try {
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      return { date: "1970-01-01", hour: 0 };
    }
    return {
      date: osloYmdFromDate(d),
      hour: osloHourFromDate(d),
    };
  } catch {
    return {
      date: utcYmdFromDate(d),
      hour: d.getUTCHours(),
    };
  }
}

export function generateOsloDayStringsInRange(
  start: Date,
  end: Date,
): string[] {
  const firstOslo = osloYmdFromDate(start);
  const lastOslo = osloYmdFromDate(end);
  const days: string[] = [];
  let current = firstOslo;
  while (current <= lastOslo) {
    days.push(current);
    current = addDaysToYmd(current, 1);
  }
  return days;
}

export function getUtcSlotsForOsloDay(
  osloYmd: string,
): { date: string; hour: number }[] {
  const startUtc = new Date(toUTCForOslo(osloYmd, 0));
  const nextDayYmd = addDaysToYmd(osloYmd, 1);
  const endUtc = new Date(toUTCForOslo(nextDayYmd, 0));
  const slots: { date: string; hour: number }[] = [];
  for (let t = startUtc.getTime(); t < endUtc.getTime(); t += 3600 * 1000) {
    const d = new Date(t);
    slots.push({ date: utcYmdFromDate(d), hour: d.getUTCHours() });
  }
  return slots;
}

export function getUtcDayStringsInRange(
  periodStart: Date,
  periodEnd: Date,
): string[] {
  const days: string[] = [];
  const start = new Date(
    Date.UTC(
      periodStart.getUTCFullYear(),
      periodStart.getUTCMonth(),
      periodStart.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      periodEnd.getUTCFullYear(),
      periodEnd.getUTCMonth(),
      periodEnd.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const current = new Date(start);
  while (current <= end) {
    days.push(utcYmdFromDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

export function addDaysToYmd(yyyyMmDd: string, deltaDays: number): string {
  const parts = yyyyMmDd.split("-").map((x) => parseInt(x, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return yyyyMmDd;
  }
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function utcHourBucketStartMs(d: Date): number {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return NaN;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    0,
    0,
    0,
  );
}

const UTC_HOUR_MS = 3600_000;

export function generateUtcHours(start: Date, end: Date): Date[] {
  try {
    if (!(start instanceof Date) || !(end instanceof Date)) return [];
  } catch {
    return [];
  }
  const startMs = utcHourBucketStartMs(start);
  const endMs = utcHourBucketStartMs(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return [];
  const out: Date[] = [];
  for (let ts = startMs; ts <= endMs; ts += UTC_HOUR_MS) {
    out.push(new Date(ts));
  }
  return out;
}

export function generateUtcHoursExclusiveEnd(
  start: Date,
  endExclusive: Date,
): Date[] {
  try {
    if (!(start instanceof Date) || !(endExclusive instanceof Date)) return [];
  } catch {
    return [];
  }
  const startMs = utcHourBucketStartMs(start);
  const endMs = endExclusive.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return [];
  const out: Date[] = [];
  for (let ts = startMs; ts < endMs; ts += UTC_HOUR_MS) {
    out.push(new Date(ts));
  }
  return out;
}

export function countUtcHoursExclusiveEnd(
  start: Date,
  endExclusive: Date,
): number {
  try {
    if (!(start instanceof Date) || !(endExclusive instanceof Date)) return 0;
  } catch {
    return 0;
  }
  const startMs = utcHourBucketStartMs(start);
  const endMs = endExclusive.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 0;
  }
  return Math.floor((endMs - 1 - startMs) / UTC_HOUR_MS) + 1;
}

export function generateOsloHoursInPeriod(
  start: Date,
  end: Date,
): Array<{ date: string; hour: number; datetime: string }> {
  const curStart = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
      start.getUTCHours(),
      0,
      0,
      0,
    ),
  );
  const curEnd = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      end.getUTCHours(),
      0,
      0,
      0,
    ),
  );
  const seen = new Map<string, string>();
  const cur = new Date(curStart);
  while (cur <= curEnd) {
    const date = osloYmdFromDate(cur);
    const hour = osloHourFromDate(cur);
    const key = `${date}_${hour}`;
    if (!seen.has(key)) seen.set(key, cur.toISOString());
    cur.setUTCHours(cur.getUTCHours() + 1);
  }
  return Array.from(seen.entries())
    .map(([key, datetime]) => {
      const [date, hourStr] = key.split("_");
      return { date, hour: parseInt(hourStr, 10), datetime };
    })
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.hour - b.hour;
    });
}

export function getDaysBetweenYmd(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  let cursor = startYmd;
  while (cursor <= endYmd) {
    out.push(cursor);
    cursor = addDaysToYmd(cursor, 1);
  }
  return out;
}

export function getOsloDaysBetween(startDate: Date, endDate: Date): string[] {
  return getDaysBetweenYmd(
    osloYmdFromDate(startDate),
    osloYmdFromDate(endDate),
  );
}

export function getDayCountInclusive(startDate: Date, endDate: Date): number {
  const start = osloYmdFromDate(startDate);
  const end = osloYmdFromDate(endDate);
  let n = 0;
  let cursor = start;
  while (cursor <= end) {
    n++;
    cursor = addDaysToYmd(cursor, 1);
  }
  return n;
}

export function toFullCalendarDaysOslo(
  start: Date,
  end: Date,
): {
  start: Date;
  end: Date;
} {
  const startYmd = osloYmdFromDate(start);
  const endYmd = osloYmdFromDate(end);
  const startDate = new Date(toUTCForOslo(startYmd, 0));
  const endDate = new Date(toUTCForOslo(endYmd, 23));
  endDate.setUTCMinutes(59, 59, 999);
  return { start: startDate, end: endDate };
}

export function getYearRangeOslo(year: number): { start: Date; end: Date } {
  const start = new Date(toUTCForOslo(`${year}-01-01`, 0));
  const end = new Date(toUTCForOslo(`${year}-12-31`, 23));
  end.setUTCMinutes(59, 59, 999);
  return { start, end };
}

export function getPreviousPeriodRange(
  _periodOption: PeriodOption,
  currentStart: Date,
  currentEnd: Date,
  comparisonMode?: "yoy" | "previous",
): { startDate: Date; endDate: Date } {
  const defaultMode = "yoy";
  const mode = comparisonMode ?? defaultMode;

  if (mode === "previous") {
    const startYmd = osloYmdFromDate(currentStart);
    const periodDays = getDayCountInclusive(currentStart, currentEnd);
    const prevEndYmd = addDaysToYmd(startYmd, -1);
    const prevStartYmd = addDaysToYmd(prevEndYmd, -(periodDays - 1));
    const previousStart = new Date(toUTCForOslo(prevStartYmd, 0));
    const previousEnd = new Date(toUTCForOslo(prevEndYmd, 23));
    previousEnd.setUTCMinutes(59, 59, 999);
    return { startDate: previousStart, endDate: previousEnd };
  }

  const startYmd = osloYmdFromDate(currentStart);
  const endYmd = osloYmdFromDate(currentEnd);
  const prevStartYear = parseInt(startYmd.slice(0, 4), 10) - 1;
  const prevEndYear = parseInt(endYmd.slice(0, 4), 10) - 1;
  let prevStartYmd = `${prevStartYear}${startYmd.slice(4)}`;
  let prevEndYmd = `${prevEndYear}${endYmd.slice(4)}`;

  if (prevStartYmd.endsWith("-02-29")) {
    const testDate = new Date(Date.UTC(prevStartYear, 1, 29));
    if (testDate.getUTCMonth() !== 1) prevStartYmd = `${prevStartYear}-02-28`;
  }
  if (prevEndYmd.endsWith("-02-29")) {
    const testDate = new Date(Date.UTC(prevEndYear, 1, 29));
    if (testDate.getUTCMonth() !== 1) prevEndYmd = `${prevEndYear}-02-28`;
  }

  const previousStart = new Date(toUTCForOslo(prevStartYmd, 0));
  const previousEnd = new Date(toUTCForOslo(prevEndYmd, 23));
  previousEnd.setUTCMinutes(59, 59, 999);

  return {
    startDate: previousStart,
    endDate: previousEnd,
  };
}

export function getPeriodDates(periodOption: PeriodOption): {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  labelFormat: string;
  daysDuration: number;
  periodStart: Date;
  periodEnd: Date;
} {
  const { startDate: currentStart, endDate: currentEnd } =
    getCurrentPeriodRange(periodOption);
  const previousRange = getPreviousPeriodRange(
    periodOption,
    currentStart,
    currentEnd,
    "previous",
  );
  const daysDuration = DAYS_IN_PERIOD[periodOption] ?? 365;
  const labelFormat = PERIOD_LABEL_FORMAT[periodOption] ?? "MMM";

  return {
    currentStart,
    currentEnd,
    previousStart: previousRange.startDate,
    previousEnd: previousRange.endDate,
    labelFormat,
    daysDuration,
    periodStart: currentStart,
    periodEnd: currentEnd,
  };
}

export function getNextLikelyPeriod(currentPeriod: PeriodOption): PeriodOption {
  switch (currentPeriod) {
    case "7days":
      return "month";
    case "month":
      return "year";
    case "year":
      return "month";
    default:
      return "year";
  }
}

export function getStandardizedPeriodDates(periodOption: PeriodOption): {
  start: Date;
  end: Date;
  useHourlyResolution: boolean;
  daysInPeriod: number;
  periodName: string;
  periodNameShort: string;
} {
  const { startDate: start, endDate: end } =
    getCurrentPeriodRange(periodOption);

  const daysInPeriod = getDayCountInclusive(start, end);

  const useHourlyResolution = daysInPeriod <= 92;

  const periodName = PERIOD_LABELS[periodOption] ?? "perioden";
  const periodNameShort =
    periodOption === "year"
      ? "året"
      : periodOption === "month"
        ? "måneden"
        : periodOption === "7days"
          ? "uken"
          : "perioden";

  return {
    start,
    end,
    useHourlyResolution,
    daysInPeriod,
    periodName,
    periodNameShort,
  };
}

export function toNorwegianTime(utcDate: Date): Date {

  if (!(utcDate instanceof Date) || isNaN(utcDate.getTime())) {
    return new Date(0);
  }
  const utcTimestamp = utcDate.getTime();
  const workingDate = new Date(utcTimestamp);

  const norwegianTimeFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = norwegianTimeFormatter.formatToParts(workingDate);
  const norwegianDateString = `${parts.find((p) => p.type === "year")?.value}-${
    parts.find((p) => p.type === "month")?.value
  }-${parts.find((p) => p.type === "day")?.value}T${
    parts.find((p) => p.type === "hour")?.value
  }:${parts.find((p) => p.type === "minute")?.value}:${
    parts.find((p) => p.type === "second")?.value
  }`;

  const norwegianDate = new Date(norwegianDateString);

  return norwegianDate;
}

export function utcToNorwegianTime(utcDate: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  const second = parts.find((p) => p.type === "second")?.value;

  const norwegianAsIso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  const norwegianTime = new Date(norwegianAsIso);

  return norwegianTime;
}

export function formatNorwegianDateTime(
  date: Date,
  options?: {
    includeTime?: boolean;
    includeSeconds?: boolean;
    shortDate?: boolean;
  },
): string {
  const {
    includeTime = true,
    includeSeconds = false,
    shortDate = false,
  } = options || {};

  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: shortDate ? "numeric" : "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  };

  if (includeTime) {
    dateOptions.hour = "2-digit";
    dateOptions.minute = "2-digit";

    if (includeSeconds) {
      dateOptions.second = "2-digit";
    }
  }

  return date.toLocaleDateString("nb-NO", dateOptions);
}

export function isNorwegianDaylightSavingTime(date: Date): boolean {
  const januaryOffset = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    timeZoneName: "longOffset",
  }).formatToParts(new Date(date.getFullYear(), 0, 1));

  const currentOffset = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    timeZoneName: "longOffset",
  }).formatToParts(date);

  const janOffsetStr =
    januaryOffset.find((p) => p.type === "timeZoneName")?.value || "";
  const currentOffsetStr =
    currentOffset.find((p) => p.type === "timeZoneName")?.value || "";

  return janOffsetStr !== currentOffsetStr;
}

export function utcIsoToNorwegianTime(isoString: string): Date {
  const utcDate = new Date(isoString);
  return toNorwegianTime(utcDate);
}

export function utcMidnightOnUtcCalendarDayOf(instant: Date): Date {
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

export function toUTCForOslo(dateStr: string, hour: number): string {
  try {
    const parts = dateStr.split("-").map((n) => parseInt(n, 10));
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day)
    ) {
      return `${dateStr}T${String(hour).padStart(2, "0")}:00:00Z`;
    }
    const baseUtc = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
    const displayedHour = parseInt(
      new Intl.DateTimeFormat("nb-NO", {
        timeZone: "Europe/Oslo",
        hour: "2-digit",
        hour12: false,
      }).format(baseUtc),
      10,
    );
    const offset = (displayedHour - hour + 24) % 24; // antall timer Oslo ligger foran UTC
    const correctedUtc = new Date(
      Date.UTC(year, month - 1, day, hour - offset, 0, 0),
    );
    return correctedUtc.toISOString();
  } catch {
    return `${dateStr}T${String(hour).padStart(2, "0")}:00:00Z`;
  }
}

export function formatNorwegianStandardDateTime(date: Date): string {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return "-";
    }
  } catch {
    return "-";
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}

export const formatterNOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface ChartDataPoint {
  date: string;
  value?: number;
  hour?: number;
  datetime?: string;
  volume_kwh?: number;
  cost?: number;
  price?: number;
  areaCode?: string;
  priceZone?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function normalizeAndSortChartData(
  chartData: ChartDataPoint[],
): ChartDataPoint[] {
  if (!chartData || chartData.length === 0) return [];

  const normalized = chartData.map((item) => {
    const newItem = { ...item };

    if (newItem.date && newItem.hour !== undefined) {
      const dateStr = newItem.date;
      const hour = Number(newItem.hour);

      const year = dateStr.split("-")[0];
      const month = dateStr.split("-")[1];
      const day = dateStr.split("-")[2];
      const normalizedHour = String(hour).padStart(2, "0");

      newItem.datetime = `${year}-${month}-${day}T${normalizedHour}:00:00Z`;
    } else if (newItem.datetime && typeof newItem.datetime === "string") {
      if (
        !newItem.datetime.endsWith("Z") &&
        !newItem.datetime.includes("+") &&
        !newItem.datetime.includes("-")
      ) {
        newItem.datetime = `${newItem.datetime}Z`;
      }
    }

    return newItem;
  });

  normalized.sort((a, b) => {
    if (a.date && b.date) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.hour !== undefined && b.hour !== undefined) {
        return a.hour - b.hour;
      }
    }
    if (a.datetime && b.datetime) {
      return a.datetime.localeCompare(b.datetime);
    }
    return 0;
  });

  return normalized;
}

export function normalizeAndSortUtcChartData(
  chartData: ChartDataPoint[],
): ChartDataPoint[] {
  if (!chartData || chartData.length === 0) return [];

  const normalized = chartData.map((item) => {
    const newItem = { ...item } as ChartDataPoint;

    if (newItem.date && newItem.hour !== undefined) {
      const dateStr = newItem.date;
      const hour = Number(newItem.hour);
      const normalizedHour = String(hour).padStart(2, "0");
      newItem.datetime = `${dateStr}T${normalizedHour}:00:00Z`;
    } else if (newItem.datetime && typeof newItem.datetime === "string") {
      const dt = newItem.datetime;
      if (!dt.endsWith("Z") && !dt.includes("+") && !dt.includes("-")) {
        newItem.datetime = `${dt}Z`;
      }
    }

    return newItem;
  });

  normalized.sort((a, b) => {
    if (a.date && b.date) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.hour !== undefined && b.hour !== undefined) {
        return (a.hour as number) - (b.hour as number);
      }
    }
    if (a.datetime && b.datetime) {
      return (a.datetime as string).localeCompare(b.datetime as string);
    }
    return 0;
  });

  return normalized;
}

export function formatMpid(mpid: string): string {
  if (mpid && mpid.length === 18 && isValidElhubMpid(mpid)) {
    return `${mpid.slice(0, 10)}-${mpid.slice(10)}`;
  }
  return mpid;
}

export function cleanMpidInput(input: string): string {
  let cleaned = input.replace(/\D/g, "");

  if (cleaned.length > 0) {
    if (!cleaned.startsWith(ELHUB_MPID_PREFIX)) {
      if (cleaned.length <= 8) {
        cleaned = ELHUB_MPID_PREFIX + cleaned;
      } else {
        cleaned = ELHUB_MPID_PREFIX + cleaned.slice(-8);
      }
    } else {
      if (cleaned.length < ELHUB_MPID_PREFIX.length) {
        cleaned = ELHUB_MPID_PREFIX;
      }
    }
  }

  if (cleaned.length > ELHUB_MPID_MAX_LENGTH) {
    cleaned = cleaned.slice(0, ELHUB_MPID_MAX_LENGTH);
  }

  return cleaned;
}

export function maskMpid(mpid: string): string {
  if (mpid && mpid.length === 18) {
    return `${ELHUB_MPID_PREFIX}****${mpid.slice(-4)}`;
  }
  return mpid;
}


export function mapKartverketToEnova(kartverketType: string): string | null {
  if (!kartverketType) return null;

  const normalized = kartverketType.trim();

  if (kartverketToEnovaMapping[normalized]) {
    return kartverketToEnovaMapping[normalized];
  }

  const lowerInput = normalized.toLowerCase();
  for (const [kartverketKey, enovaCategory] of Object.entries(
    kartverketToEnovaMapping,
  )) {
    if (
      lowerInput.includes(kartverketKey.toLowerCase()) ||
      kartverketKey.toLowerCase().includes(lowerInput)
    ) {
      return enovaCategory;
    }
  }

  return null;
}

export function isValidEnovaCategory(category: string): boolean {
  if (!category) return false;
  return buildingCategory.some((cat) => cat.label === category);
}

export function getValidEnovaCategories(): string[] {
  return buildingCategory.map((cat) => cat.label);
}

export function suggestEnovaCategory(
  buildingType?: string,
  context?: {
    address?: string;
    postalPlace?: string;
    buildingYear?: number;
  },
): string {
  if (buildingType) {
    const mapped = mapKartverketToEnova(buildingType);
    if (mapped) return mapped;
  }

  if (context?.address) {
    const addressLower = context.address.toLowerCase();

    if (
      addressLower.includes("skole") ||
      addressLower.includes("ungdomsskole") ||
      addressLower.includes("barneskole")
    ) {
      return "Skolebygg";
    }
    if (addressLower.includes("barnehage")) {
      return "Barnehager";
    }
    if (addressLower.includes("sykehus") || addressLower.includes("klinikk")) {
      return "Sykehus";
    }
    if (addressLower.includes("hotell")) {
      return "Hoteller";
    }
    if (addressLower.includes("kontor")) {
      return "Kontorbygg";
    }
  }

  if (context?.buildingYear) {
    if (context.buildingYear < 1980) {
      return "Småhus";
    }
  }

  return "Småhus";
}

export function getBuildingCategoryDisplayName(
  category: string | null,
): string {
  if (!category) return "Ukjent kategori";

  const mappings: Record<string, string> = {
    OFFICE_BUILDINGS: "Kontorbygg",
    APARTMENT_BLOCKS: "Boligblokker",
    SMALL_HOUSES: "Småhus",
    COMMERCIAL_BUILDINGS: "Kommersielle bygg",
    SCHOOL_BUILDINGS: "Skolebygg",
    UNIVERSITY_COLLEGE_BUILDINGS: "Universitet/høgskole",
    KINDERGARTENS: "Barnehager",
    HOSPITALS: "Sykehus",
    NURSING_HOMES: "Sykehjem",
    HOTELS: "Hoteller",
    SPORTS_BUILDINGS: "Idrettsbygg",
    CULTURAL_BUILDINGS: "Kulturbygg",
    LIGHT_INDUSTRY_WORKSHOPS: "Lett industri/verksteder",
    INDUSTRIAL_BUILDINGS: "Industribygg",
    WAREHOUSES: "Lagerbygninger",
  };

  return mappings[category] || category;
}

export function getElectricityZoneForRegion(region?: string | null): string {
  if (!region) return "ukjent";
  return regionToElectricityZone[region] || "ukjent";
}

export function getElectricityZoneForMunicipalityNumber(
  municipalityNumber?: string | null,
): string {
  if (!municipalityNumber) return "ukjent";
  const raw = municipalityNumber.trim();
  if (raw.length < 4) return "ukjent";
  const countyCode = raw.slice(0, 2).padStart(2, "0");
  if (countyCode === "99") return "ukjent";
  return countyCodeToElectricityZone[countyCode] || "ukjent";
}

export type MinimalBuildingForZone = {
  region?: string | null;
  municipalityNumber?: string | null;
  municipalityName?: string | null;
  postCode?: string | null;
  addresses?: Array<{
    address: string;
    postCode: string;
    postalPlace: string;
    isPrimary?: boolean;
  }>;
};

export function getDominantZoneFromBuildings(
  buildings: Array<MinimalBuildingForZone>,
): string {
  const counts: Record<string, number> = {};
  for (const b of buildings) {
    const { zone } = getElectricityZoneForBuilding(b);
    if (zone && zone !== "ukjent") counts[zone] = (counts[zone] || 0) + 1;
  }
  const zones = Object.keys(counts);
  if (zones.length === 0) return "ukjent";
  return zones.sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
}

export type ElectricityZoneSource =
  | "municipality"
  | "postCode"
  | "municipalityName"
  | "region"
  | "unknown";

export type BuildingLikeForZone = {
  region?: string | null;
  municipalityNumber?: string | null;
  municipalityName?: string | null;
  postCode?: string | null;
  addresses?: Array<{
    address?: string;
    postCode: string;
    postalPlace?: string;
    isPrimary?: boolean;
  }> | null;
};

export function toMinimalBuildingForZone(
  b: BuildingLikeForZone | null | undefined,
): MinimalBuildingForZone {
  if (!b) return {};
  return {
    region: b.region ?? null,
    municipalityNumber: b.municipalityNumber ?? null,
    municipalityName: b.municipalityName ?? null,
    postCode: b.postCode ?? null,
    addresses:
      b.addresses?.map((a) => ({
        address: a.address ?? "",
        postCode: a.postCode,
        postalPlace: a.postalPlace ?? "",
        isPrimary: a.isPrimary ?? false,
      })) ?? [],
  };
}

export function getElectricityZoneForBuilding(
  building: MinimalBuildingForZone,
): { zone: string; source: ElectricityZoneSource } {
  const zm = getElectricityZoneForMunicipalityNumber(
    building?.municipalityNumber || null,
  );
  if (zm && zm !== "ukjent") return { zone: zm, source: "municipality" };

  const postCodeToUse =
    building?.postCode ||
    building?.addresses?.find((a) => a.isPrimary !== false)?.postCode ||
    building?.addresses?.[0]?.postCode;
  const zp = getElectricityZoneForPostCode(postCodeToUse);
  if (zp && zp !== "ukjent") return { zone: zp, source: "postCode" };

  const zn = getElectricityZoneForMunicipalityName(
    building?.municipalityName || null,
  );
  if (zn && zn !== "ukjent") return { zone: zn, source: "municipalityName" };

  const zr = getElectricityZoneForRegion(building?.region || null);
  if (zr && zr !== "ukjent") return { zone: zr, source: "region" };

  return { zone: "ukjent", source: "unknown" };
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (!Array.isArray(items) || items.length === 0 || size <= 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}