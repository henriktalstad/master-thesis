import type {
  ControlTickTriggerAssessment,
  ControlTickTriggerReason,
} from "@/lib/sd-anlegg/control/control-types-live";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";

const VECTOR_THRESHOLDS: Record<keyof MpcControlVector, number> = {
  supplySetpointC: 0.5,
  supplyFanPct: 3,
  exhaustFanPct: 3,
  heatingValvePct: 5,
  coolingValvePct: 5,
  districtTr002ValvePct: 5,
  districtTr003ValvePct: 5,
};

const EXTRACT_PREDICTION_TOLERANCE_C = 1.0;
/** Kontor-MPC skill: re-optimaliser ved ±2 °C værprognose-drift. */
export const WEATHER_FORECAST_DRIFT_TOLERANCE_C = 2.0;
/** Marginalpris over median × faktor → event-driven tick. */
export const PRICE_SPIKE_VS_MEDIAN_FACTOR = 1.4;
const CRON_MIN_INTERVAL_MS = 12 * 60 * 1000;
const POST_SYNC_DEBOUNCE_MS = 2 * 60 * 1000;

function controlVectorDeviation(
  reference: MpcControlVector,
  observed: MpcControlVector,
): Partial<Record<keyof MpcControlVector, number>> {
  const delta: Partial<Record<keyof MpcControlVector, number>> = {};
  for (const key of MPC_CONTROL_KEYS) {
    const d = observed[key] - reference[key];
    if (Math.abs(d) >= VECTOR_THRESHOLDS[key]) {
      delta[key] = Math.round(d * 10) / 10;
    }
  }
  return delta;
}

function msSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return nowMs - t;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function assessPriceSpike(input: {
  currentMarginalKrPerKwh: number | null;
  recentMarginalKrPerKwh: readonly number[];
  factor?: number;
}): { isSpike: boolean; medianKr: number | null; ratio: number | null } {
  const med = median([...input.recentMarginalKrPerKwh]);
  const current = input.currentMarginalKrPerKwh;
  if (med == null || current == null || med <= 0) {
    return { isSpike: false, medianKr: med, ratio: null };
  }
  const factor = input.factor ?? PRICE_SPIKE_VS_MEDIAN_FACTOR;
  const ratio = current / med;
  return { isSpike: ratio >= factor, medianKr: med, ratio };
}

export function assessWeatherForecastDrift(input: {
  outdoorTempMeasC: number | null;
  outdoorTempForecastC: number | null;
  toleranceC?: number;
}): { hasDrift: boolean; deltaC: number | null } {
  const { outdoorTempMeasC, outdoorTempForecastC } = input;
  if (outdoorTempMeasC == null || outdoorTempForecastC == null) {
    return { hasDrift: false, deltaC: null };
  }
  const deltaC = outdoorTempMeasC - outdoorTempForecastC;
  const tolerance = input.toleranceC ?? WEATHER_FORECAST_DRIFT_TOLERANCE_C;
  return {
    hasDrift: Math.abs(deltaC) >= tolerance,
    deltaC: Math.round(deltaC * 10) / 10,
  };
}

export function assessControlTickTrigger(input: {
  triggerSource: string;
  lastControlTickAt: string | null;
  activeCommand: MpcControlVector | null;
  uMeas: MpcControlVector | null;
  extractTempMeasC: number | null;
  extractTempPredC: number | null;
  comfortBand: { min: number; max: number };
  outdoorTempMeasC?: number | null;
  outdoorTempForecastC?: number | null;
  currentMarginalKrPerKwh?: number | null;
  recentMarginalKrPerKwh?: readonly number[];
  nowMs?: number;
}): ControlTickTriggerAssessment {
  const nowMs = input.nowMs ?? Date.now();
  const elapsedMs = msSince(input.lastControlTickAt, nowMs);

  if (input.lastControlTickAt == null) {
    return { shouldRun: true, reason: "initial", detail: "ingen tidligere tick" };
  }

  const comfortDeviation =
    input.extractTempMeasC != null &&
    (input.extractTempMeasC < input.comfortBand.min ||
      input.extractTempMeasC > input.comfortBand.max);

  const predictionDeviation =
    input.extractTempMeasC != null &&
    input.extractTempPredC != null &&
    Math.abs(input.extractTempMeasC - input.extractTempPredC) >=
      EXTRACT_PREDICTION_TOLERANCE_C;

  const controlDeviation =
    input.uMeas != null && input.activeCommand != null
      ? controlVectorDeviation(input.activeCommand, input.uMeas)
      : {};

  const hasControlDeviation = Object.keys(controlDeviation).length > 0;

  const weatherDrift = assessWeatherForecastDrift({
    outdoorTempMeasC: input.outdoorTempMeasC ?? null,
    outdoorTempForecastC: input.outdoorTempForecastC ?? null,
  });

  const priceSpike = assessPriceSpike({
    currentMarginalKrPerKwh: input.currentMarginalKrPerKwh ?? null,
    recentMarginalKrPerKwh: input.recentMarginalKrPerKwh ?? [],
  });

  if (comfortDeviation) {
    return {
      shouldRun: true,
      reason: "comfort_deviation",
      detail: `avtrekk ${input.extractTempMeasC} °C utenfor band`,
    };
  }

  if (weatherDrift.hasDrift) {
    return {
      shouldRun: true,
      reason: "weather_forecast_drift",
      detail: `utetemp avviker ${weatherDrift.deltaC} °C fra prognose (≥${WEATHER_FORECAST_DRIFT_TOLERANCE_C} °C)`,
    };
  }

  if (priceSpike.isSpike) {
    return {
      shouldRun: true,
      reason: "price_spike",
      detail: `marginalpris ${input.currentMarginalKrPerKwh?.toFixed(3)} kr/kWh (${Math.round((priceSpike.ratio ?? 1) * 100)} % av median)`,
    };
  }

  if (predictionDeviation) {
    return {
      shouldRun: true,
      reason: "measurement_deviation",
      detail: `avtrekk avviker ${Math.round((input.extractTempMeasC! - input.extractTempPredC!) * 10) / 10} °C fra prediksjon`,
    };
  }

  if (hasControlDeviation) {
    const keys = Object.keys(controlDeviation).join(", ");
    return {
      shouldRun: true,
      reason: "measurement_deviation",
      detail: `u avviker fra aktiv plan (${keys})`,
    };
  }

  const minIntervalMs =
    input.triggerSource === "post_sync" ? POST_SYNC_DEBOUNCE_MS : CRON_MIN_INTERVAL_MS;

  if (elapsedMs != null && elapsedMs < minIntervalMs) {
    return {
      shouldRun: false,
      reason: "skipped_recent",
      detail: `siste tick for ${Math.round(elapsedMs / 1000)} s siden`,
    };
  }

  const reason: ControlTickTriggerReason =
    input.triggerSource === "cron" ? "scheduled" : "scheduled";

  return {
    shouldRun: true,
    reason,
    detail:
      input.triggerSource === "cron"
        ? "cron-fallback"
        : `planlagt tick (${input.triggerSource})`,
  };
}
