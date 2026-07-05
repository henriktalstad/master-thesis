import { parseInfluxSqlTimestamp } from "@/lib/infraspawn/influx-sql-time";
import { buildInfraspawnPointRawMetadata } from "@/lib/infraspawn/point-metadata";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = row[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function pickNumber(
  row: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const v = row[key];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeRow(record: Record<string, unknown>): InfraspawnBacnetRow | null {
  const objectId = pickString(record, ["objectId", "object_id", "objectID"]);
  const timeRaw = pickString(record, ["time", "Time", "timestamp"]);
  if (!objectId || !timeRaw) return null;

  const sampledAt = parseInfluxSqlTimestamp(timeRaw);
  if (Number.isNaN(sampledAt.getTime())) return null;

  const row: InfraspawnBacnetRow = {
    objectId,
    sampledAt,
    valueNum: pickNumber(record, [
      "value_num",
      "valueNum",
      "value",
      "presentValue",
      "present_value",
      "analogValue",
      "analog_value",
      "numericValue",
      "numeric_value",
    ]),
    quality: pickString(record, ["quality", "Quality"]),
    objectName: pickString(record, ["objectName", "object_name"]),
    description: pickString(record, ["description", "Description"]),
    unit: pickString(record, ["unit", "Unit"]),
    raw: record,
  };

  return {
    ...row,
    raw: buildInfraspawnPointRawMetadata(row),
  };
}

function parseColumnarJson(parsed: unknown[]): InfraspawnBacnetRow[] {
  if (parsed.length < 2) return [];
  const header = parsed[0];
  if (!Array.isArray(header)) return [];
  const columns = header.map((c) => String(c));
  const rows: InfraspawnBacnetRow[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const values = parsed[i];
    if (!Array.isArray(values)) continue;
    const record: Record<string, unknown> = {};
    for (let c = 0; c < columns.length; c++) {
      record[columns[c]!] = values[c];
    }
    const row = normalizeRow(record);
    if (row) rows.push(row);
  }
  return rows;
}

export function parseInfluxSqlResponse(body: string): InfraspawnBacnetRow[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return [];
      if (parsed.length > 0 && asRecord(parsed[0])) {
        return parsed
          .map((item) => normalizeRow(asRecord(item)!))
          .filter((r): r is InfraspawnBacnetRow => r !== null);
      }
      return parseColumnarJson(parsed);
    } catch {
      return [];
    }
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const obj = asRecord(parsed);
      if (!obj) return [];
      const candidates = [
        obj.data,
        obj.rows,
        obj.results,
        obj.records,
      ];
      for (const c of candidates) {
        if (Array.isArray(c)) {
          return parseInfluxSqlResponse(JSON.stringify(c));
        }
      }
    } catch {
      return [];
    }
  }

  const lines = trimmed.split("\n").filter(Boolean);
  const rows: InfraspawnBacnetRow[] = [];
  for (const line of lines) {
    try {
      const obj = asRecord(JSON.parse(line));
      if (!obj) continue;
      const row = normalizeRow(obj);
      if (row) rows.push(row);
    } catch {}
  }
  return rows;
}
