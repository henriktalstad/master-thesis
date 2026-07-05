import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import {
  estimateCoolingActive,
  estimateFanElectricityShare,
  estimateHeatingActive,
  simultaneousHeatCool,
} from "./control-sd-calibration";
import type { ScenarioHourContext, ScenarioHourFactors } from "./scenario-hour-adjustments";

const NEUTRAL: ScenarioHourFactors = {
  elecFactor: 1,
  heatFactor: 1,
  controlAdjusted: false,
  supplySetpointDeltaC: 0,
  supplyFanFactor: 1,
  exhaustFanFactor: 1,
  heatingValveFactor: 1,
  coolingValveFactor: 1,
};

function marginalKrPerKwh(ctx: ScenarioHourContext): number | null {
  return ctx.effectiveMarginalKrPerKwh ?? ctx.spotKrPerKwh;
}

function setpointHeadroom(profile: ControlSdHourlyProfile | undefined): number {
  if (!profile?.supplySetpointC || !profile.supplySetpointCalcC) return 0.5;
  const gap = profile.supplySetpointCalcC - profile.supplySetpointC;
  if (gap <= 0) return 0.25;
  return Math.min(1, gap / 3.5);
}

function fanTrimHeadroom(profile: ControlSdHourlyProfile | undefined): number {
  if (!profile) return 0.5;
  const avgFan =
    ((profile.supplyFanPct ?? 0) + (profile.exhaustFanPct ?? 0)) / 2;
  return Math.max(0, Math.min(1, (avgFan - 20) / 55));
}

function isOccupiedHour(ctx: ScenarioHourContext): boolean {
  if (ctx.occupancyQ != null) {
    return ctx.occupancyQ >= 0.5;
  }
  return ctx.hourLocal >= 6 && ctx.hourLocal < 22;
}

function isNightHour(ctx: ScenarioHourContext): boolean {
  return ctx.hourLocal >= 22 || ctx.hourLocal < 6;
}

function isMorningPreheatWindow(ctx: ScenarioHourContext): boolean {
  return ctx.hourLocal >= 4 && ctx.hourLocal < 8;
}

export function computeScopedShadowFactors(
  ctx: ScenarioHourContext,
): ScenarioHourFactors {
  const profile = ctx.profile;
  if (!profile) {
    return { ...NEUTRAL };
  }
  if (simultaneousHeatCool(profile)) {
    return { ...NEUTRAL, elecFactor: 0.99, heatFactor: 0.99 };
  }

  const price = marginalKrPerKwh(ctx);
  const outdoor = ctx.outdoorTempC;
  const factors: ScenarioHourFactors = { ...NEUTRAL };

  const expensive =
    price != null && price >= ctx.highPriceThreshold && isOccupiedHour(ctx);
  const cheap =
    price != null && price <= ctx.lowPriceThreshold;

  if (expensive) {
    const headroom = setpointHeadroom(profile);
    if (headroom > 0.15) {
      factors.controlAdjusted = true;
      factors.supplySetpointDeltaC = -0.35 * headroom;
      factors.elecFactor = 1 - 0.02 * headroom;
      if (estimateHeatingActive(profile)) {
        factors.heatFactor = 1 - 0.045 * headroom;
        factors.heatingValveFactor = factors.heatFactor;
      }
      if (estimateCoolingActive(profile) && outdoor != null && outdoor > 16) {
        factors.elecFactor = 1 - 0.025 * headroom;
        factors.coolingValveFactor = factors.elecFactor;
        factors.supplySetpointDeltaC = 0.15 * headroom;
      }
    }
    const fanHeadroom = fanTrimHeadroom(profile);
    const fanShare = estimateFanElectricityShare(profile);
    if (fanHeadroom > 0.12 && fanShare > 0.08) {
      const trim = 0.2 * fanHeadroom * Math.min(1, fanShare / 0.2);
      factors.controlAdjusted = true;
      factors.supplyFanFactor = Math.min(factors.supplyFanFactor, 1 - trim);
      factors.exhaustFanFactor = Math.min(factors.exhaustFanFactor, 1 - trim);
      factors.elecFactor = Math.min(factors.elecFactor, 1 - trim * 0.9);
    }
  }

  if (
    cheap &&
    isMorningPreheatWindow(ctx) &&
    outdoor != null &&
    outdoor < 4 &&
    estimateHeatingActive(profile)
  ) {
    factors.controlAdjusted = true;
    factors.heatFactor = Math.max(factors.heatFactor, 1.04);
    factors.heatingValveFactor = factors.heatFactor;
    factors.supplySetpointDeltaC = Math.max(factors.supplySetpointDeltaC, 0.2);
  }

  if (isNightHour(ctx) && (ctx.occupancyQ == null || ctx.occupancyQ >= 0.5)) {
    const headroom = fanTrimHeadroom(profile);
    const fanShare = estimateFanElectricityShare(profile);
    if (headroom > 0.2 && fanShare > 0.1) {
      const trim = 0.12 * headroom * Math.min(1, fanShare / 0.22);
      factors.controlAdjusted = true;
      factors.elecFactor = Math.min(factors.elecFactor, 1 - trim);
      factors.supplyFanFactor = 1 - trim;
      factors.exhaustFanFactor = 1 - trim;
    }
  }

  if (
    expensive &&
    estimateCoolingActive(profile) &&
    outdoor != null &&
    outdoor >= 8 &&
    outdoor <= 16
  ) {
    factors.controlAdjusted = true;
    factors.elecFactor = Math.min(factors.elecFactor, 0.96);
    factors.coolingValveFactor = Math.min(factors.coolingValveFactor, 0.96);
  }

  return factors;
}
