import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import { priceThreshold } from "@/lib/sd-anlegg/control/scenario-hour-adjustments";
import type { ControlHourlyPrice } from "@/lib/sd-anlegg/control/control-types";
/** Minimalt prisfelt for replay-steg og eval-timesteps. */
export type MpcPriceStep = {
  t: string;
  spotKrPerKwh?: number | null;
  effectiveMarginalKrPerKwh?: number | null;
  marginalKrPerKwh?: number | null;
};

function marginalPrice(step: MpcPriceStep): number | null {
  const value =
    step.effectiveMarginalKrPerKwh ?? step.marginalKrPerKwh ?? step.spotKrPerKwh;
  return value != null && Number.isFinite(value) ? value : null;
}

type HourlyPriceContext = {
  hourly: Map<string, number>;
  dailyThresholds: Map<string, { high: number; low: number }>;
};

function buildHourlyPriceContext(
  steps: readonly MpcPriceStep[],
): HourlyPriceContext {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const step of steps) {
    const price = marginalPrice(step);
    if (price == null) continue;
    const hourKey = controlHourKeyFromIso(step.t);
    const bucket = buckets.get(hourKey) ?? { sum: 0, count: 0 };
    bucket.sum += price;
    bucket.count += 1;
    buckets.set(hourKey, bucket);
  }

  const hourly = new Map(
    [...buckets.entries()].map(([hourKey, agg]) => [
      hourKey,
      agg.sum / agg.count,
    ]),
  );

  const byDate = new Map<string, ControlHourlyPrice[]>();
  for (const [hourKey, spotKrPerKwh] of hourly) {
    const dateKey = hourKey.slice(0, 10);
    const list = byDate.get(dateKey) ?? [];
    list.push({
      hour: `${hourKey}:00:00.000Z`,
      spotKrPerKwh,
      effectiveMarginalKrPerKwh: spotKrPerKwh,
    });
    byDate.set(dateKey, list);
  }

  const dailyThresholds = new Map<string, { high: number; low: number }>();
  for (const [dateKey, prices] of byDate) {
    dailyThresholds.set(dateKey, {
      high: priceThreshold(prices, 75),
      low: priceThreshold(prices, 25),
    });
  }

  return { hourly, dailyThresholds };
}

export function resolveStepPriceThresholds(
  step: MpcPriceStep,
  global: { high: number; low: number },
  daily?: ReadonlyMap<string, { high: number; low: number }>,
): { high: number; low: number } {
  const dateKey = step.t.slice(0, 10);
  return daily?.get(dateKey) ?? global;
}

export function buildPriceThresholdsFromSteps(
  steps: readonly MpcPriceStep[],
): { high: number; low: number } {
  const prices: ControlHourlyPrice[] = steps.map((step) => ({
    hour: step.t,
    spotKrPerKwh: step.spotKrPerKwh ?? null,
    effectiveMarginalKrPerKwh:
      step.effectiveMarginalKrPerKwh ?? step.marginalKrPerKwh ?? null,
  }));
  return {
    high: priceThreshold(prices, 75),
    low: priceThreshold(prices, 25),
  };
}

/** Daglig P75/P25 per UTC-dato — matcher thesis Results (daily 75th percentile). */
export function buildDailyPriceThresholdsFromSteps(
  steps: readonly MpcPriceStep[],
): Map<string, { high: number; low: number }> {
  return buildHourlyPriceContext(steps).dailyThresholds;
}

export type PriceBand = "high" | "medium" | "low";

export const PRICE_BAND_ORDER: readonly PriceBand[] = ["high", "medium", "low"];

export function classifyHourPriceBand(
  hourKey: string,
  hourPrice: number,
  dailyThresholds: ReadonlyMap<string, { high: number; low: number }>,
): PriceBand {
  const dateKey = hourKey.slice(0, 10);
  const day = dailyThresholds.get(dateKey);
  if (!day) return "medium";
  if (hourPrice >= day.high) return "high";
  if (hourPrice <= day.low) return "low";
  return "medium";
}

export function buildHourPriceBandsFromSteps(
  steps: readonly MpcPriceStep[],
): Map<string, PriceBand> {
  const { hourly, dailyThresholds } = buildHourlyPriceContext(steps);
  const bands = new Map<string, PriceBand>();
  for (const [hourKey, price] of hourly) {
    bands.set(hourKey, classifyHourPriceBand(hourKey, price, dailyThresholds));
  }
  return bands;
}
