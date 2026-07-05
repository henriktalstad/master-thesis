import type { ControlSdHourlyProfile } from "@/lib/sd-anlegg/control/control-sd-calibration";
import {
  applyFactorsToControlProfile,
  type ScenarioHourContext,
} from "@/lib/sd-anlegg/control/scenario-hour-adjustments";
import { computeScopedShadowFactors } from "@/lib/sd-anlegg/control/shadow-control-policy";
import { resolveStepPriceThresholds } from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import type { MpcControlVector, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { PolicyStepContext, PolicyStepResult } from "./types";

export function mpcVectorToSdProfile(
  u: MpcControlVector,
  step: MpcTimestep,
): ControlSdHourlyProfile {
  return {
    hour: step.t,
    supplySetpointC: u.supplySetpointC,
    supplySetpointCalcC: step.supplySetpointCalcC ?? undefined,
    supplyFanPct: u.supplyFanPct,
    exhaustFanPct: u.exhaustFanPct,
    heatingValvePct: u.heatingValvePct,
    coolingValvePct: u.coolingValvePct,
    extractTempC: step.extractTempC ?? undefined,
  };
}

function scaleValvePct(value: number, factor: number): number {
  return Math.round(Math.max(0, Math.min(100, value * factor)));
}

export function sdProfileToMpcVector(
  profile: ControlSdHourlyProfile | undefined,
  baseU?: MpcControlVector,
): MpcControlVector | null {
  if (!profile || profile.supplySetpointC == null) return null;
  return {
    supplySetpointC: profile.supplySetpointC,
    supplyFanPct: profile.supplyFanPct ?? 0,
    exhaustFanPct: profile.exhaustFanPct ?? 0,
    heatingValvePct: profile.heatingValvePct ?? 0,
    coolingValvePct: profile.coolingValvePct ?? 0,
    districtTr002ValvePct: baseU?.districtTr002ValvePct ?? 0,
    districtTr003ValvePct: baseU?.districtTr003ValvePct ?? 0,
  };
}

export function buildScenarioHourContextFromTimestep(
  ctx: PolicyStepContext,
  baseProfile: ControlSdHourlyProfile,
): ScenarioHourContext {
  const { step, priceThresholds, dailyPriceThresholds } = ctx;
  const dayThresholds = resolveStepPriceThresholds(
    step,
    priceThresholds,
    dailyPriceThresholds,
  );
  return {
    hourIso: step.t,
    hourUtc: step.hourUtc,
    hourLocal: step.hourLocal,
    occupancyQ: ctx.occupancyQ,
    spotKrPerKwh: step.spotKrPerKwh,
    effectiveMarginalKrPerKwh: step.effectiveMarginalKrPerKwh,
    outdoorTempC: step.outdoorTempC,
    profile: baseProfile,
    inForecastWindow: true,
    highPriceThreshold: dayThresholds.high,
    lowPriceThreshold: dayThresholds.low,
  };
}

/** Behovsstyrt policy på 15-min grid — utgangspunkt emulert BMS (sammenlignbar med forventet). */
export function computeDemandControlFromTimestep(
  ctx: PolicyStepContext,
): PolicyStepResult {
  const baseU = ctx.uBmsSim;
  const baseProfile = mpcVectorToSdProfile(baseU, ctx.step);
  const scenarioCtx = buildScenarioHourContextFromTimestep(ctx, baseProfile);
  const factors = computeScopedShadowFactors(scenarioCtx);
  const adjusted = applyFactorsToControlProfile(baseProfile, factors);
  const u = sdProfileToMpcVector(adjusted, baseU);
  if (!u) {
    return { u: null, skipped: true };
  }
  if (factors.heatingValveFactor !== 1) {
    u.districtTr002ValvePct = scaleValvePct(
      baseU.districtTr002ValvePct,
      factors.heatingValveFactor,
    );
    u.districtTr003ValvePct = scaleValvePct(
      baseU.districtTr003ValvePct,
      factors.heatingValveFactor,
    );
  }
  return {
    u,
    skipped: false,
    powerScale: factors.controlAdjusted
      ? { electric: factors.elecFactor, heat: factors.heatFactor }
      : undefined,
  };
}
