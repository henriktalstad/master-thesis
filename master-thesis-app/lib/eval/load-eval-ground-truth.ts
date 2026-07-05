import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildMpcTimeGrid } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import type {
  CsvGroundTruthOverlay,
  EvalGroundTruthManifest,
  EvalGroundTruthValidation,
} from "./eval-ground-truth-types";

export type {
  CsvGroundTruthOverlay,
  EnergyGroundTruthBundle,
  EnergyGroundTruthSource,
  EvalGroundTruthComparison,
  EvalGroundTruthManifest,
  EvalGroundTruthValidation,
} from "./eval-ground-truth-types";

export type EvalGroundTruthSeries = {
  electricity15min: Map<string, number>;
  districtHeating15min: Map<string, number>;
  electricityHourly: Map<string, number>;
  districtHeatingHourly: Map<string, number>;
};

export function resolveEvalGroundTruthDir(cwd = process.cwd()): string {
  return resolve(cwd, "../data/eval");
}

function parseCsv(content: string): { header: string[]; rows: Record<string, string>[] } {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { header: [], rows: [] };

  const header = lines[0]!.split(",").map((cell) => cell.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]!] = cells[i] ?? "";
    }
    return row;
  });
  return { header, rows };
}

function normalizeStepKey(timestamp: string): string {
  return timestamp.trim().replace(/\.\d{3}Z$/, "Z");
}

function loadEnergySeries(
  filePath: string,
  timestampCol: string,
  valueCol: string,
): Map<string, number> {
  const content = readFileSync(filePath, "utf8");
  const { rows } = parseCsv(content);
  const series = new Map<string, number>();
  for (const row of rows) {
    const timestamp = row[timestampCol]?.trim();
    const value = Number(row[valueCol]);
    if (!timestamp || !Number.isFinite(value)) continue;
    series.set(normalizeStepKey(timestamp), value);
  }
  return series;
}

function fileExists(dir: string, name: string): boolean {
  return existsSync(resolve(dir, name));
}

export function loadEvalGroundTruthManifest(
  dir = resolveEvalGroundTruthDir(),
): EvalGroundTruthManifest | null {
  const manifestPath = resolve(dir, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")) as EvalGroundTruthManifest;
  } catch {
    return null;
  }
}

export function loadEvalGroundTruthSeries(
  dir = resolveEvalGroundTruthDir(),
): EvalGroundTruthSeries | null {
  const manifest = loadEvalGroundTruthManifest(dir);
  if (!manifest) return null;

  const series: EvalGroundTruthSeries = {
    electricity15min: new Map(),
    districtHeating15min: new Map(),
    electricityHourly: new Map(),
    districtHeatingHourly: new Map(),
  };

  if (fileExists(dir, "electricity_15min.csv")) {
    series.electricity15min = loadEnergySeries(
      resolve(dir, "electricity_15min.csv"),
      "timestamp_utc",
      "electricity_kwh",
    );
  }
  if (fileExists(dir, "district_heating_15min.csv")) {
    series.districtHeating15min = loadEnergySeries(
      resolve(dir, "district_heating_15min.csv"),
      "timestamp_utc",
      "heat_kwh",
    );
  }
  if (fileExists(dir, "electricity_hourly.csv")) {
    series.electricityHourly = loadEnergySeries(
      resolve(dir, "electricity_hourly.csv"),
      "timestamp_utc",
      "electricity_kwh",
    );
  }
  if (fileExists(dir, "district_heating_hourly.csv")) {
    series.districtHeatingHourly = loadEnergySeries(
      resolve(dir, "district_heating_hourly.csv"),
      "timestamp_utc",
      "heat_kwh",
    );
  }

  const hasData =
    series.electricity15min.size > 0 ||
    series.districtHeating15min.size > 0 ||
    series.electricityHourly.size > 0 ||
    series.districtHeatingHourly.size > 0;
  return hasData ? series : null;
}

function validate15MinSeries(
  series: Map<string, number>,
  evalStart: string,
  evalEnd: string,
): EvalGroundTruthValidation {
  const expected = buildMpcTimeGrid(new Date(evalStart), new Date(evalEnd));
  let matched = 0;
  let extra = 0;
  const expectedSet = new Set(expected);

  for (const key of series.keys()) {
    if (expectedSet.has(key)) matched += 1;
    else extra += 1;
  }

  const missing = expected.length - matched;
  return {
    resolution: "15min",
    expectedSteps: expected.length,
    matchedSteps: matched,
    missingSteps: missing,
    extraSteps: extra,
    coveragePct:
      expected.length > 0
        ? Math.round((matched / expected.length) * 1000) / 10
        : 0,
  };
}

function sumMap(values: Map<string, number>): number {
  let total = 0;
  for (const value of values.values()) total += value;
  return Math.round(total * 10) / 10;
}

function pctDelta(actual: number, reference: number): number | null {
  if (reference <= 0) return null;
  return Math.round(((actual - reference) / reference) * 1000) / 10;
}

/** Valgfri ekstern CSV-overlay — sammenligner mot BHCC når filer finnes. */
export function compareCsvEvalGroundTruth(input: {
  dir?: string;
  evalStart: string;
  evalEnd: string;
  bhccElectricityKwh?: number | null;
  bhccDistrictHeatingKwh?: number | null;
}): CsvGroundTruthOverlay | null {
  const dir = input.dir ?? resolveEvalGroundTruthDir();
  const manifest = loadEvalGroundTruthManifest(dir);
  const series = loadEvalGroundTruthSeries(dir);
  if (!manifest || !series) return null;

  const evalStart = manifest.evalStart ?? input.evalStart;
  const evalEnd = manifest.evalEnd ?? input.evalEnd;

  const electricity15min =
    series.electricity15min.size > 0
      ? validate15MinSeries(series.electricity15min, evalStart, evalEnd)
      : null;
  const districtHeating15min =
    series.districtHeating15min.size > 0
      ? validate15MinSeries(series.districtHeating15min, evalStart, evalEnd)
      : null;

  const electricityKwh =
    series.electricity15min.size > 0
      ? sumMap(series.electricity15min)
      : series.electricityHourly.size > 0
        ? sumMap(series.electricityHourly)
        : null;
  const districtHeatingKwh =
    series.districtHeating15min.size > 0
      ? sumMap(series.districtHeating15min)
      : series.districtHeatingHourly.size > 0
        ? sumMap(series.districtHeatingHourly)
        : null;

  const bhccEl = input.bhccElectricityKwh ?? null;
  const bhccDh = input.bhccDistrictHeatingKwh ?? null;

  return {
    manifest,
    validation: { electricity15min, districtHeating15min },
    totals: { electricityKwh, districtHeatingKwh },
    vsBhcc:
      bhccEl != null || bhccDh != null
        ? {
            electricityDeltaKwh:
              electricityKwh != null && bhccEl != null
                ? Math.round((electricityKwh - bhccEl) * 10) / 10
                : null,
            electricityDeltaPct:
              electricityKwh != null && bhccEl != null
                ? pctDelta(electricityKwh, bhccEl)
                : null,
            districtHeatingDeltaKwh:
              districtHeatingKwh != null && bhccDh != null
                ? Math.round((districtHeatingKwh - bhccDh) * 10) / 10
                : null,
            districtHeatingDeltaPct:
              districtHeatingKwh != null && bhccDh != null
                ? pctDelta(districtHeatingKwh, bhccDh)
                : null,
          }
        : null,
  };
}

/** @deprecated Bruk compareCsvEvalGroundTruth */
export const compareEvalGroundTruth = compareCsvEvalGroundTruth;

export function aggregateEvalGroundTruthHourly(
  series15min: Map<string, number>,
): Map<string, number> {
  const hourly = new Map<string, number>();
  for (const [stepKey, kwh] of series15min) {
    const hourKey = controlHourKeyFromIso(stepKey);
    hourly.set(hourKey, (hourly.get(hourKey) ?? 0) + kwh);
  }
  return hourly;
}
