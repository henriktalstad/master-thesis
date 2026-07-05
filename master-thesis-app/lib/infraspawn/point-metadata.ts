import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";

export type InfraspawnPointStatusMetadata = {
  quality: string | null;
  status_fault: boolean;
  status_inAlarm: boolean;
  status_outOfService: boolean;
  status_overridden: boolean;
  destination: string | null;
  frame: string | null;
  pointCount: number | null;
  pollCycle: number | null;
  errorCount: number | null;
  topic: string | null;
  lastSampledAt: string;
};

function pickBoolean(record: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (value === true || value === "true" || value === 1) return true;
  }
  return false;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (value == null || value === "") continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function buildInfraspawnPointRawMetadata(
  row: InfraspawnBacnetRow,
): Record<string, unknown> {
  const record = row.raw;
  const status: InfraspawnPointStatusMetadata = {
    quality: row.quality ?? pickString(record, ["quality", "Quality"]),
    status_fault: pickBoolean(record, ["status_fault", "statusFault"]),
    status_inAlarm: pickBoolean(record, ["status_inAlarm", "statusInAlarm"]),
    status_outOfService: pickBoolean(record, [
      "status_outOfService",
      "statusOutOfService",
    ]),
    status_overridden: pickBoolean(record, [
      "status_overridden",
      "statusOverridden",
    ]),
    destination: pickString(record, ["destination", "Destination"]),
    frame: pickString(record, ["frame", "Frame"]),
    pointCount: pickNumber(record, ["pointCount", "point_count"]),
    pollCycle: pickNumber(record, ["pollCycle", "poll_cycle"]),
    errorCount: pickNumber(record, ["errorCount", "error_count"]),
    topic: pickString(record, ["topic", "Topic"]),
    lastSampledAt: row.sampledAt.toISOString(),
  };

  return {
    ...record,
    ...status,
  };
}

export function parseInfraspawnPointStatusMetadata(
  raw: unknown,
): InfraspawnPointStatusMetadata | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const lastSampledAt = pickString(record, ["lastSampledAt", "time", "Time"]);
  if (!lastSampledAt) return null;

  return {
    quality: pickString(record, ["quality", "Quality"]),
    status_fault: pickBoolean(record, ["status_fault", "statusFault"]),
    status_inAlarm: pickBoolean(record, ["status_inAlarm", "statusInAlarm"]),
    status_outOfService: pickBoolean(record, [
      "status_outOfService",
      "statusOutOfService",
    ]),
    status_overridden: pickBoolean(record, [
      "status_overridden",
      "statusOverridden",
    ]),
    destination: pickString(record, ["destination", "Destination"]),
    frame: pickString(record, ["frame", "Frame"]),
    pointCount: pickNumber(record, ["pointCount", "point_count"]),
    pollCycle: pickNumber(record, ["pollCycle", "poll_cycle"]),
    errorCount: pickNumber(record, ["errorCount", "error_count"]),
    topic: pickString(record, ["topic", "Topic"]),
    lastSampledAt,
  };
}

export function isInfraspawnPointHealthy(
  status: InfraspawnPointStatusMetadata | null,
): boolean {
  if (!status) return true;
  if (status.status_fault || status.status_inAlarm || status.status_outOfService) {
    return false;
  }
  const quality = status.quality?.toLowerCase();
  return quality == null || quality === "ok";
}
