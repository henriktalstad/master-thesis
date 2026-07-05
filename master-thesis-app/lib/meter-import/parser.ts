import * as XLSX from "xlsx";

export interface RawImportRow {
  rowIndex: number;
  cells: Record<string, string>;
}
export interface ParseResult {
  success: true;
  headers: string[];
  normalizedHeaders: string[];
  rows: RawImportRow[];
  sheetName: string;
  totalRows: number;
  availableSheets: string[];
}

export interface ParseError {
  success: false;
  error: string;
  details?: string;
}

export type MeterImportParseResult = ParseResult | ParseError;
const MIN_HEADER_CELLS = 2;
const MAX_HEADER_SCAN_ROWS = 15;
const MAX_TOTAL_ROWS = 5000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;


export function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zæøå0-9 _\-/]/g, "")
    .trim();
}


const HEADER_KEYWORD_HINTS = [
  "tag",
  "måler id",
  "maaler id",
  "måler-id",
  "maaler-id",
  "målernavn",
  "navn",
  "mpid",
  "målepunkt",
  "maalepunkt",
  "plassering",
  "lokasjon",
  "rom",
  "etasje",
  "blokk",
  "bygg",
  "system",
  "type",
  "energiart",
  "energibærer",
  "energibaerer",
  "kategori",
  "hovedmåler",
  "hovedmaaler",
  "undermåler",
  "undermaaler",
  "bus",
  "modbus",
];

function countKeywordHits(normalizedCells: string[]): number {
  let hits = 0;
  for (const c of normalizedCells) {
    for (const kw of HEADER_KEYWORD_HINTS) {
      if (c === kw || c.includes(kw)) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

function detectHeaderRow(
  data: unknown[][],
): { rowIndex: number; headers: string[] } | null {
  let bestRow = -1;
  let bestScore = 0;
  let bestHeaders: string[] = [];

  const scanLimit = Math.min(data.length, MAX_HEADER_SCAN_ROWS);

  for (let i = 0; i < scanLimit; i++) {
    const row = data[i];
    if (!row || !Array.isArray(row)) continue;

    const textCells: string[] = [];
    for (const cell of row) {
      const val = cellToString(cell);
      if (val.length > 0 && val.length < 100) {
        textCells.push(val);
      }
    }

    const normalized = textCells.map(normalizeHeader);
    const uniqueCells = new Set(normalized);

    const allNumeric = textCells.every((c) => /^\d+([.,]\d+)?$/.test(c));
    if (allNumeric) continue;

    const keywordHits = countKeywordHits(normalized);
    const score = uniqueCells.size + keywordHits * 2;

    if (score > bestScore && uniqueCells.size >= MIN_HEADER_CELLS) {
      bestScore = score;
      bestRow = i;
      bestHeaders = textCells;
    }
  }

  if (bestRow === -1) return null;
  return { rowIndex: bestRow, headers: bestHeaders };
}


const SEPARATOR_VALUE_RX =
  /^(blokk|bygg|etasje|tavle|fordeling|gruppe|seksjon|hus|rom|del)\b/i;

function isSeparatorRow(cells: string[]): boolean {
  const nonEmpty = cells.filter((c) => c.length > 0);
  if (nonEmpty.length !== 1) return false;
  return SEPARATOR_VALUE_RX.test(nonEmpty[0].trim());
}
function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string") return cell.trim();
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "boolean") return cell ? "true" : "false";
  if (cell instanceof Date) return cell.toISOString().split("T")[0];
  return String(cell).trim();
}
function isEmptyRow(row: unknown[]): boolean {
  return row.every((cell) => cellToString(cell) === "");
}


export function parseExcelBuffer(
  buffer: ArrayBuffer | Buffer,
  options?: {
    sheetName?: string;
    maxRows?: number;
  },
): MeterImportParseResult {
  try {
    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: "Filen er for stor",
        details: `Maks ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB, filen er ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`,
      };
    }

    const workbook = XLSX.read(buffer, {
      type: buffer instanceof ArrayBuffer ? "array" : "buffer",
      cellDates: true,
      cellNF: false,
      cellText: false,
    });

    const availableSheets = workbook.SheetNames;
    if (availableSheets.length === 0) {
      return {
        success: false,
        error: "Ingen ark funnet i Excel-filen",
      };
    }

    const targetSheet = options?.sheetName ?? availableSheets[0];
    const sheet = workbook.Sheets[targetSheet];
    if (!sheet) {
      return {
        success: false,
        error: `Arket "${targetSheet}" finnes ikke`,
        details: `Tilgjengelige ark: ${availableSheets.join(", ")}`,
      };
    }

    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false, // Alle verdier som string for konsistens
    });

    return parseRaw2DArray(
      rawData,
      targetSheet,
      availableSheets,
      options?.maxRows,
    );
  } catch (err) {
    return {
      success: false,
      error: "Kunne ikke lese Excel-filen",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

export function parseCsvString(
  csvContent: string,
  fileName?: string,
): MeterImportParseResult {
  try {
    if (!csvContent || csvContent.trim().length === 0) {
      return { success: false, error: "CSV-filen er tom" };
    }

    const separator = detectCsvSeparator(csvContent);

    const lines = csvContent.split(/\r?\n/);
    const rawData: unknown[][] = lines.map((line) =>
      splitCsvLine(line, separator),
    );

    return parseRaw2DArray(rawData, fileName ?? "csv-import", [], undefined);
  } catch (err) {
    return {
      success: false,
      error: "Kunne ikke lese CSV-filen",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

function detectCsvSeparator(content: string): string {
  const sampleLines = content.split(/\r?\n/).slice(0, 5).join("\n");

  const candidates = [
    { sep: ";", count: (sampleLines.match(/;/g) || []).length },
    { sep: ",", count: (sampleLines.match(/,/g) || []).length },
    { sep: "\t", count: (sampleLines.match(/\t/g) || []).length },
    { sep: "|", count: (sampleLines.match(/\|/g) || []).length },
  ];

  candidates.sort((a, b) => b.count - a.count);
  return candidates[0].count > 0 ? candidates[0].sep : ",";
}

function splitCsvLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}


function parseRaw2DArray(
  rawData: unknown[][],
  sheetName: string,
  availableSheets: string[],
  maxRows?: number,
): MeterImportParseResult {
  if (rawData.length === 0) {
    return { success: false, error: "Ingen data funnet i filen" };
  }

  const headerDetection = detectHeaderRow(rawData);
  if (!headerDetection) {
    return {
      success: false,
      error: "Kunne ikke finne en header-rad",
      details:
        "Filen må ha en rad med minst 2 unike tekstceller (f.eks. kolonne-overskrifter). Sjekk at filen inneholder en tabell med overskrifter.",
    };
  }

  const { rowIndex: headerRowIndex, headers } = headerDetection;
  const normalizedHeaders = headers.map(normalizeHeader);

  const rowLimit = Math.min(
    rawData.length,
    headerRowIndex + 1 + (maxRows ?? MAX_TOTAL_ROWS),
  );

  const rows: RawImportRow[] = [];
  for (let i = headerRowIndex + 1; i < rowLimit; i++) {
    const rawRow = rawData[i];
    if (!rawRow || !Array.isArray(rawRow) || isEmptyRow(rawRow)) continue;

    const cells: Record<string, string> = {};
    const stringCells: string[] = [];
    for (let j = 0; j < headers.length; j++) {
      const key = normalizedHeaders[j];
      if (!key) continue;
      const val = cellToString(rawRow[j]);
      cells[key] = val;
      stringCells.push(val);
    }

    const hasValue = stringCells.some((v) => v.length > 0);
    if (!hasValue) continue;

    if (isSeparatorRow(stringCells)) continue;

    rows.push({
      rowIndex: i - headerRowIndex - 1, // 0-basert relativt til data-start
      cells,
    });
  }

  if (rows.length === 0) {
    return {
      success: false,
      error: "Ingen datarader funnet under header",
      details: `Header funnet på rad ${headerRowIndex + 1}: ${headers.join(", ")}`,
    };
  }

  return {
    success: true,
    headers,
    normalizedHeaders,
    rows,
    sheetName,
    totalRows: rows.length,
    availableSheets,
  };
}


export function parseFileBuffer(
  buffer: ArrayBuffer | Buffer,
  fileName: string,
  options?: { sheetName?: string; maxRows?: number },
): MeterImportParseResult {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(
      buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer),
    );
    return parseCsvString(text, fileName);
  }

  if (ext === "xlsx" || ext === "xls") {
    return parseExcelBuffer(buffer, options);
  }

  return {
    success: false,
    error: `Filformatet "${ext}" støttes ikke`,
    details: "Støttede formater: .xlsx, .xls, .csv, .tsv",
  };
}

export function getSampleRows(
  result: ParseResult,
  count: number = 5,
): RawImportRow[] {
  return result.rows.slice(0, count);
}

export function getUniqueColumnValues(
  result: ParseResult,
  normalizedHeader: string,
): string[] {
  const values = new Set<string>();
  for (const row of result.rows) {
    const val = row.cells[normalizedHeader];
    if (val && val.length > 0) {
      values.add(val);
    }
  }
  return Array.from(values);
}
