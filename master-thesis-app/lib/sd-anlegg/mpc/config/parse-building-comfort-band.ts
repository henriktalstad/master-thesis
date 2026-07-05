export type ComfortBandC = { min: number; max: number };

const MIN_KEYS = [
  "comfortBandMinC",
  "minExtractTempC",
  "minTempC",
  "minTemp",
  "minC",
  "min",
  "lowerBound",
] as const;

const MAX_KEYS = [
  "comfortBandMaxC",
  "maxExtractTempC",
  "maxTempC",
  "maxTemp",
  "maxC",
  "max",
  "upperBound",
] as const;

const PREFERRED_NEST_KEYS = [
  "extractAir",
  "extract",
  "ventilation",
  "ahu",
  "default",
  "office",
] as const;

function readNumericField(obj: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function bandFromRecord(value: unknown): ComfortBandC | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const min = readNumericField(obj, MIN_KEYS);
  const max = readNumericField(obj, MAX_KEYS);
  if (min == null || max == null || min >= max) return null;
  return { min, max };
}

function bandFromNested(value: unknown): ComfortBandC | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;

  for (const key of PREFERRED_NEST_KEYS) {
    const nested = bandFromRecord(obj[key]);
    if (nested) return nested;
  }

  for (const nested of Object.values(obj)) {
    const band = bandFromRecord(nested);
    if (band) return band;
  }

  return null;
}

/** Leser `Building.comfortTargets` (JSON) til avtrekk/komfortband for MPC. */
export function parseComfortBandFromBuildingJson(
  json: unknown,
): ComfortBandC | null {
  if (json == null) return null;

  const direct = bandFromRecord(json);
  if (direct) return direct;

  if (Array.isArray(json)) {
    for (const item of json) {
      const band = bandFromRecord(item) ?? bandFromNested(item);
      if (band) return band;
    }
    return null;
  }

  return bandFromNested(json);
}

export function resolveComfortBandC(input: {
  base: ComfortBandC;
  comfortTargets?: unknown | null;
  overrides?: { comfortBandMinC?: number; comfortBandMaxC?: number } | null;
}): ComfortBandC {
  const fromDb = parseComfortBandFromBuildingJson(input.comfortTargets ?? null);
  const min =
    input.overrides?.comfortBandMinC ?? fromDb?.min ?? input.base.min;
  const max =
    input.overrides?.comfortBandMaxC ?? fromDb?.max ?? input.base.max;
  if (min >= max) return input.base;
  return { min, max };
}
