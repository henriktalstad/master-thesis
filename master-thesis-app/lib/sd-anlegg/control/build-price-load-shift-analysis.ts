import { controlHourKeyFromIso } from "./control-time-buckets";
import {
  buildHourPriceBandsFromSteps,
  type PriceBand,
} from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export type PriceBandEnergy = {
  baselineKwh: number;
  mpcKwh: number;
  deltaKwh: number;
  deltaPct: number | null;
};

export type PriceLoadShiftAnalysis = {
  highPriceHours: number;
  bands: Record<PriceBand, PriceBandEnergy>;
  deltaE_hp_kwh: number;
  deltaE_hp_pct: number | null;
  highPriceCostBaselineKr: number;
  highPriceCostMpcKr: number;
  highPriceCostDeltaKr: number;
  highPriceCostDeltaPct: number | null;
  interpretation: string;
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function pctDelta(newVal: number, baseVal: number): number | null {
  if (baseVal <= 0) return null;
  return round2(((newVal - baseVal) / baseVal) * 100);
}

function stepBaselineKwh(step: MpcReplayStep): number {
  const el =
    step.proxyElKwhEmulated ??
    step.proxyElKwhBaseline ??
    0;
  const heat =
    step.proxyHeatKwhEmulated ??
    step.proxyHeatKwhBaseline ??
    0;
  return el + heat;
}

function stepMpcKwh(step: MpcReplayStep): number {
  if (step.proxyElKwhMpc != null || step.proxyHeatKwhMpc != null) {
    return (step.proxyElKwhMpc ?? 0) + (step.proxyHeatKwhMpc ?? 0);
  }
  const stepHours = 15 / 60;
  return (step.electricKw + step.heatKw) * stepHours;
}

function stepControllableKwhEmulated(step: MpcReplayStep): number {
  return stepBaselineKwh(step);
}

function stepControllableKwhMpc(step: MpcReplayStep): number {
  return stepMpcKwh(step);
}

export { stepControllableKwhEmulated, stepControllableKwhMpc };

function emulatedCostKr(step: MpcReplayStep): number {
  return step.costEmulatedKr ?? step.costBaselineKr;
}

function finalizeBand(baselineKwh: number, mpcKwh: number): PriceBandEnergy {
  const deltaKwh = round2(baselineKwh - mpcKwh);
  return {
    baselineKwh: round2(baselineKwh),
    mpcKwh: round2(mpcKwh),
    deltaKwh,
    deltaPct: pctDelta(mpcKwh, baselineKwh),
  };
}

function interpretLoadShift(deltaE_hp_kwh: number): string {
  if (Math.abs(deltaE_hp_kwh) < 0.05) {
    return "Lite endring i høypris-timer";
  }
  if (deltaE_hp_kwh > 0) {
    return "Simulert forslag bruker mindre energi i høypris-timer";
  }
  return "Simulert forslag bruker mer energi i høypris-timer";
}

export function buildPriceLoadShiftAnalysis(
  steps: readonly MpcReplayStep[],
): PriceLoadShiftAnalysis | null {
  if (steps.length === 0) return null;

  const hourBands = buildHourPriceBandsFromSteps(steps);
  const highPriceHours = [...hourBands.values()].filter((b) => b === "high").length;

  const accum = {
    high: { baseline: 0, mpc: 0, costBase: 0, costMpc: 0 },
    medium: { baseline: 0, mpc: 0, costBase: 0, costMpc: 0 },
    low: { baseline: 0, mpc: 0, costBase: 0, costMpc: 0 },
  };

  for (const step of steps) {
    const hourKey = controlHourKeyFromIso(step.t);
    const band = hourBands.get(hourKey) ?? "medium";
    const baselineKwh = stepBaselineKwh(step);
    const mpcKwh = stepMpcKwh(step);
    accum[band].baseline += baselineKwh;
    accum[band].mpc += mpcKwh;
    accum[band].costBase += emulatedCostKr(step);
    accum[band].costMpc += step.costMpcKr;
  }

  const high = accum.high;
  const deltaE_hp_kwh = round2(high.baseline - high.mpc);
  const deltaE_hp_pct = pctDelta(high.mpc, high.baseline);
  const highPriceCostDeltaKr = round2(high.costBase - high.costMpc);

  return {
    highPriceHours,
    bands: {
      high: finalizeBand(high.baseline, high.mpc),
      medium: finalizeBand(accum.medium.baseline, accum.medium.mpc),
      low: finalizeBand(accum.low.baseline, accum.low.mpc),
    },
    deltaE_hp_kwh,
    deltaE_hp_pct,
    highPriceCostBaselineKr: round2(high.costBase),
    highPriceCostMpcKr: round2(high.costMpc),
    highPriceCostDeltaKr,
    highPriceCostDeltaPct: pctDelta(high.costMpc, high.costBase),
    interpretation: interpretLoadShift(deltaE_hp_kwh),
  };
}

export function emptyPriceLoadShiftAnalysis(): PriceLoadShiftAnalysis {
  return {
    bands: {
      high: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null },
      medium: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null },
      low: { baselineKwh: 0, mpcKwh: 0, deltaKwh: 0, deltaPct: null },
    },
    deltaE_hp_kwh: 0,
    deltaE_hp_pct: null,
    highPriceHours: 0,
    highPriceCostBaselineKr: 0,
    highPriceCostMpcKr: 0,
    highPriceCostDeltaKr: 0,
    highPriceCostDeltaPct: null,
    interpretation: "Ingen prisdata",
  };
}
