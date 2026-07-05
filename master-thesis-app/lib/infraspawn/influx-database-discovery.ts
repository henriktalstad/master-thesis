export const INFRASPAWN_DEFAULT_INFLUX_DATABASE = "bacnet";

export type InfraspawnInfluxDatabaseDiscoveryMethod =
  | "configure"
  | "fallback"
  | "probe";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeDatabaseName(value: unknown): string | null {
  if (value == null) return null;
  const name = String(value).trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) return null;
  return name;
}

function extractDatabaseNameFromRecord(
  record: Record<string, unknown>,
): string | null {
  return normalizeDatabaseName(
    record.database_name ??
      record.databaseName ??
      record.name ??
      record.database ??
      record.db ??
      record["iox::database"],
  );
}

export function parseInfluxConfigureDatabaseResponse(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const names = new Set<string>();

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string") {
          const name = normalizeDatabaseName(item);
          if (name) names.add(name);
          continue;
        }
        const record = asRecord(item);
        if (!record) continue;
        const name = extractDatabaseNameFromRecord(record);
        if (name) names.add(name);
      }
      return [...names];
    }

    const obj = asRecord(parsed);
    if (!obj) return [];

    const candidates = [
      obj.databases,
      obj.data,
      obj.results,
      obj.items,
    ];
    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) continue;
      for (const item of candidate) {
        if (typeof item === "string") {
          const name = normalizeDatabaseName(item);
          if (name) names.add(name);
          continue;
        }
        const record = asRecord(item);
        if (!record) continue;
        const name = extractDatabaseNameFromRecord(record);
        if (name) names.add(name);
      }
    }

    const single = extractDatabaseNameFromRecord(obj);
    if (single) names.add(single);

    return [...names];
  } catch {
    return [];
  }
}

export function selectInfluxDatabaseCandidate(
  candidates: readonly string[],
): string | null {
  const unique = [...new Set(candidates.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0]!;
  const preferred = unique.find(
    (name) => name.toLowerCase() === INFRASPAWN_DEFAULT_INFLUX_DATABASE,
  );
  return preferred ?? unique[0]!;
}

export function orderInfluxDatabaseProbeCandidates(
  candidates: readonly string[],
): string[] {
  const unique = [...new Set(candidates.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return [INFRASPAWN_DEFAULT_INFLUX_DATABASE];
  }

  const preferred = unique.filter(
    (name) => name.toLowerCase() === INFRASPAWN_DEFAULT_INFLUX_DATABASE,
  );
  const rest = unique.filter(
    (name) => name.toLowerCase() !== INFRASPAWN_DEFAULT_INFLUX_DATABASE,
  );

  return [...preferred, ...rest];
}
