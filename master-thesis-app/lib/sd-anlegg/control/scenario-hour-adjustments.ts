import type { ControlHourlyPrice, ControlScenarioId } from "./control-types";
import {
  controlHourKeyFromIso,
  osloHourFromIso,
} from "./control-time-buckets";
import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import {
  estimateCoolingActive,
  estimateFanElectricityShare,
  estimateHeatingActive,
  simultaneousHeatCool,
} from "./control-sd-calibration";
import { computeScopedShadowFactors } from "./shadow-control-policy";

export type ScenarioHourContext = {
  hourIso: string;
  /** UTC-time (legacy). */
  hourUtc: number;
  /** Lokal time Oslo — brukes for drift-/prisvinduer. */
  hourLocal: number;
  /** Normalisert belegg q ∈ [0,1] — null = ukjent (behandles som opptatt). */
  occupancyQ?: number | null;
  spotKrPerKwh: number | null;
  effectiveMarginalKrPerKwh: number | null;
  outdoorTempC: number | null;
  profile: ControlSdHourlyProfile | undefined;
  inForecastWindow: boolean;
  highPriceThreshold: number;
  lowPriceThreshold: number;
};

export type ScenarioHourFactors = {
  elecFactor: number;
  heatFactor: number;
  controlAdjusted: boolean;
  supplySetpointDeltaC: number;
  supplyFanFactor: number;
  exhaustFanFactor: number;
  heatingValveFactor: number;
  coolingValveFactor: number;
};

const NEUTRAL_FACTORS: ScenarioHourFactors = {
  elecFactor: 1,
  heatFactor: 1,
  controlAdjusted: false,
  supplySetpointDeltaC: 0,
  supplyFanFactor: 1,
  exhaustFanFactor: 1,
  heatingValveFactor: 1,
  coolingValveFactor: 1,
};

function hourKey(iso: string): string {
  return controlHourKeyFromIso(iso);
}

function parseHourUtc(iso: string): number {
  return new Date(iso).getUTCHours();
}

function marginalPriceValue(price: ControlHourlyPrice): number | null {
  return price.effectiveMarginalKrPerKwh ?? price.spotKrPerKwh;
}

export function priceThreshold(
  prices: readonly ControlHourlyPrice[],
  percentile: number,
): number {
  const values = prices
    .map(marginalPriceValue)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (values.length === 0) return Infinity;
  const idx = Math.min(
    values.length - 1,
    Math.floor((percentile / 100) * values.length),
  );
  return values[idx] ?? Infinity;
}

function setpointHeadroom(profile: ControlSdHourlyProfile | undefined): number {
  if (!profile?.supplySetpointC || !profile.supplySetpointCalcC) return 1;
  const gap = profile.supplySetpointCalcC - profile.supplySetpointC;
  if (gap <= 0) return 0.35;
  return Math.min(1, gap / 4);
}

function fanTrimHeadroom(profile: ControlSdHourlyProfile | undefined): number {
  if (!profile) return 0.6;
  const avgFan =
    ((profile.supplyFanPct ?? 0) + (profile.exhaustFanPct ?? 0)) / 2;
  return Math.max(0, Math.min(1, (avgFan - 25) / 60));
}

export function isInForecastWindow(
  hourKey: string,
  rowIndex: number,
  forecastHourKeys: ReadonlySet<string>,
  forecastStartIdx: number,
): boolean {
  return forecastHourKeys.size > 0
    ? forecastHourKeys.has(hourKey)
    : rowIndex >= forecastStartIdx;
}

export function buildScenarioHourContext(
  hourIso: string,
  spotByHour: ReadonlyMap<string, number | null>,
  effectiveMarginalByHour: ReadonlyMap<string, number | null>,
  outdoorByHour: ReadonlyMap<string, number | null>,
  profile: ControlSdHourlyProfile | undefined,
  inForecastWindow: boolean,
  highPriceThreshold: number,
  lowPriceThreshold: number,
): ScenarioHourContext {
  const key = hourKey(hourIso);
  return {
    hourIso,
    hourUtc: parseHourUtc(hourIso),
    hourLocal: osloHourFromIso(hourIso),
    spotKrPerKwh: spotByHour.get(key) ?? null,
    effectiveMarginalKrPerKwh: effectiveMarginalByHour.get(key) ?? null,
    outdoorTempC: outdoorByHour.get(key) ?? null,
    profile,
    inForecastWindow,
    highPriceThreshold,
    lowPriceThreshold,
  };
}

function marginalKr(ctx: ScenarioHourContext): number | null {
  return ctx.effectiveMarginalKrPerKwh ?? ctx.spotKrPerKwh;
}

export function computeScenarioHourFactors(
  scenarioId: ControlScenarioId,
  ctx: ScenarioHourContext,
): ScenarioHourFactors {
  if (scenarioId === "baseline") return { ...NEUTRAL_FACTORS };

  const profile = ctx.profile;
  const factors: ScenarioHourFactors = { ...NEUTRAL_FACTORS };

  if (scenarioId === "price_aware_temperature") {
    const price = marginalKr(ctx);
    if (
      price != null &&
      price >= ctx.highPriceThreshold &&
      ctx.hourLocal >= 6 &&
      ctx.hourLocal < 22
    ) {
      const headroom = setpointHeadroom(profile);
      if (headroom > 0 && !simultaneousHeatCool(profile)) {
        factors.controlAdjusted = true;
        factors.supplySetpointDeltaC = -0.4 * headroom;
        factors.elecFactor = 1 - 0.025 * headroom;
        if (estimateHeatingActive(profile)) {
          factors.heatFactor = 1 - 0.05 * headroom;
          factors.heatingValveFactor = factors.heatFactor;
        }
        if (estimateCoolingActive(profile)) {
          factors.elecFactor = 1 - 0.02 * headroom;
          factors.coolingValveFactor = factors.elecFactor;
        }
      }
    }
  }

  if (scenarioId === "night_ventilation_trim") {
    const isNight = ctx.hourLocal >= 22 || ctx.hourLocal < 6;
    if (isNight) {
      const headroom = fanTrimHeadroom(profile);
      const fanShare = estimateFanElectricityShare(profile);
      const trim = 0.1 * headroom * Math.min(1, fanShare / 0.25);
      factors.controlAdjusted = true;
      factors.elecFactor = 1 - trim;
      factors.supplyFanFactor = 1 - trim;
      factors.exhaustFanFactor = 1 - trim;
    }
  }

  if (scenarioId === "mpc_weather_price_48h" && ctx.inForecastWindow) {
    return computeScopedShadowFactors(ctx);
  }

  return factors;
}

export function applyFactorsToControlProfile(
  profile: ControlSdHourlyProfile | undefined,
  factors: ScenarioHourFactors,
): ControlSdHourlyProfile | undefined {
  if (!profile) return undefined;

  const round1 = (v: number) => Math.round(v * 10) / 10;
  const roundPct = (v: number) => Math.round(v);

  return {
    hour: profile.hour,
    supplySetpointC:
      profile.supplySetpointC != null
        ? round1(profile.supplySetpointC + factors.supplySetpointDeltaC)
        : profile.supplySetpointC,
    supplySetpointCalcC: profile.supplySetpointCalcC,
    extractSetpointC: profile.extractSetpointC,
    supplyFanPct:
      profile.supplyFanPct != null
        ? roundPct(profile.supplyFanPct * factors.supplyFanFactor)
        : profile.supplyFanPct,
    exhaustFanPct:
      profile.exhaustFanPct != null
        ? roundPct(profile.exhaustFanPct * factors.exhaustFanFactor)
        : profile.exhaustFanPct,
    heatingValvePct:
      profile.heatingValvePct != null
        ? roundPct(profile.heatingValvePct * factors.heatingValveFactor)
        : profile.heatingValvePct,
    coolingValvePct:
      profile.coolingValvePct != null
        ? roundPct(profile.coolingValvePct * factors.coolingValveFactor)
        : profile.coolingValvePct,
    extractTempC: profile.extractTempC,
    supplyTempC: profile.supplyTempC,
  };
}
