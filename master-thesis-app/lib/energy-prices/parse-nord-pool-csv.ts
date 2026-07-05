import type { PricePoint } from "@/services/entsoe/get-day-ahead-prices";

export type ParsedNordPoolRow = PricePoint & {
  hour: number;
  osloYmd: string;
};

export type ParseNordPoolCsvResult = {
  rows: ParsedNordPoolRow[];
  areaCode: string;
  priceUnit: "kr/kWh" | "NOK/MWh" | "ore/kWh";
  skippedRows: number;
};

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const counts = {
    ";": (headerLine.match(/;/g) ?? []).length,
    ",": (headerLine.match(/,/g) ?? []).length,
    "\t": (headerLine.match(/\t/g) ?? []).length,
  };
  if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseFlexibleDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v.includes("T") ? v : `${v}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmy = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) {
    const day = parseInt(dmy[1]!, 10);
    const month = parseInt(dmy[2]!, 10);
    const year = parseInt(dmy[3]!, 10);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  return null;
}

function inferPriceUnit(headers: string[], samplePrices: number[]): "kr/kWh" | "NOK/MWh" | "ore/kWh" {
  const joined = headers.join(" ").toLowerCase();
  if (joined.includes("øre") || joined.includes("ore/kwh")) return "ore/kWh";
  if (joined.includes("mwh")) return "NOK/MWh";
  const median = samplePrices.sort((a, b) => a - b)[
    Math.floor(samplePrices.length / 2)
  ];
  if (median != null && median > 0 && median < 15) return "kr/kWh";
  if (median != null && median > 50) return "NOK/MWh";
  return "kr/kWh";
}

function toKrPerKwh(raw: number, unit: "kr/kWh" | "NOK/MWh" | "ore/kWh"): number {
  if (unit === "ore/kWh") return raw / 100;
  if (unit === "NOK/MWh") return raw / 1000;
  return raw;
}

function findAreaColumn(headers: string[], areaCode: string): number {
  const normalized = headers.map(normalizeHeader);
  const idxExact = normalized.findIndex((h) => h === areaCode.toLowerCase());
  if (idxExact >= 0) return idxExact;

  const idxContains = normalized.findIndex(
    (h) => h.includes(areaCode.toLowerCase()) || h.includes("no_3"),
  );
  if (idxContains >= 0) return idxContains;

  const priceAreaIdx = normalized.findIndex((h) => h.includes("price_area"));
  if (priceAreaIdx >= 0) return -2;

  throw new Error(
    `Fant ikke priskolonne for ${areaCode}. Headers: ${headers.join(", ")}`,
  );
}

/**
 * Parser Nord Pool / spotpriser.csv (timeoppløsning).
 * Støtter vanlige norske semikolon-CSV og ISO delivery_start-format.
 */
export function parseNordPoolCsv(
  csvText: string,
  areaCode: string,
): ParseNordPoolCsvResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV er tom eller mangler datarader");
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = splitLine(lines[0]!, delimiter);
  const normalized = headers.map(normalizeHeader);

  const dateIdx = normalized.findIndex(
    (h) =>
      h.includes("delivery_start") ||
      h === "date" ||
      h === "dato" ||
      h.includes("delivery_date"),
  );
  const hourIdx = normalized.findIndex(
    (h) => h === "hour" || h === "time" || h === "time_utc" || h === "time_oslo",
  );
  const priceAreaIdx = normalized.findIndex((h) => h.includes("price_area"));
  const priceIdxDirect = normalized.findIndex(
    (h) =>
      h === "price" ||
      h.includes("spot") ||
      h.includes("pris") ||
      h.includes("nok"),
  );

  let areaCol = -1;
  try {
    areaCol = findAreaColumn(headers, areaCode);
  } catch {
    areaCol = priceIdxDirect;
  }

  const samplePrices: number[] = [];
  for (const line of lines.slice(1, Math.min(lines.length, 20))) {
    const cols = splitLine(line, delimiter);
    const raw =
      areaCol >= 0
        ? parseFloat(cols[areaCol]?.replace(",", ".") ?? "")
        : parseFloat(cols[priceIdxDirect]?.replace(",", ".") ?? "");
    if (Number.isFinite(raw)) samplePrices.push(raw);
  }

  const priceUnit = inferPriceUnit(headers, samplePrices);
  const rows: ParsedNordPoolRow[] = [];
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]!, delimiter);
    if (cols.length < 2) {
      skippedRows += 1;
      continue;
    }

    let dayBase: Date | null = null;
    let hour = 0;

    if (dateIdx >= 0) {
      const dateRaw = cols[dateIdx] ?? "";
      if (dateRaw.includes("T")) {
        const instant = new Date(dateRaw);
        if (Number.isNaN(instant.getTime())) {
          skippedRows += 1;
          continue;
        }
        dayBase = new Date(
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
        hour = instant.getUTCHours();
      } else {
        dayBase = parseFlexibleDate(dateRaw);
        if (!dayBase) {
          skippedRows += 1;
          continue;
        }
        if (hourIdx >= 0) {
          hour = parseInt(cols[hourIdx] ?? "0", 10);
          if (hour === 24) hour = 0;
        }
      }
    }

    if (!dayBase) {
      skippedRows += 1;
      continue;
    }

    if (priceAreaIdx >= 0) {
      const rowArea = (cols[priceAreaIdx] ?? "").toUpperCase();
      if (rowArea && rowArea !== areaCode && !rowArea.includes(areaCode)) {
        skippedRows += 1;
        continue;
      }
    }

    let priceRaw: number;
    if (areaCol >= 0) {
      priceRaw = parseFloat(cols[areaCol]?.replace(",", ".") ?? "");
    } else if (priceIdxDirect >= 0) {
      priceRaw = parseFloat(cols[priceIdxDirect]?.replace(",", ".") ?? "");
    } else {
      skippedRows += 1;
      continue;
    }

    if (!Number.isFinite(priceRaw)) {
      skippedRows += 1;
      continue;
    }

    const price = parseFloat(toKrPerKwh(priceRaw, priceUnit).toFixed(4));
    const iso = new Date(
      Date.UTC(
        dayBase.getUTCFullYear(),
        dayBase.getUTCMonth(),
        dayBase.getUTCDate(),
        hour,
        0,
        0,
        0,
      ),
    ).toISOString();

    const osloYmd = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Oslo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dayBase);

    rows.push({
      date: iso,
      price,
      area: areaCode,
      areaCode,
      hour,
      osloYmd,
    });
  }

  return { rows, areaCode, priceUnit, skippedRows };
}

export function filterRowsToEvalWindow(
  rows: ParsedNordPoolRow[],
  start: Date | null,
  end: Date | null,
): ParsedNordPoolRow[] {
  if (!start && !end) return rows;
  return rows.filter((r) => {
    const instant = new Date(r.date);
    if (start && instant.getTime() < start.getTime()) return false;
    if (end) {
      const endExclusive = end.getTime() + 86_400_000;
      if (instant.getTime() >= endExclusive) return false;
    }
    return true;
  });
}
