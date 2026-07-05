import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const DEFAULT_COMFORT_BAND = { min: 18, max: 24 };

function meanAbsError(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export type ExtractComfortMae = {
  comparedSteps: number;
  maeObservedVsMpcC: number | null;
  maeObservedVsEmulatedC: number | null;
  maeObservedVsDemandC: number | null;
};

/** MAE avtrekk — observert vs simulerte plant-kjeder. */
export function summarizeExtractComfortMae(
  steps: readonly MpcReplayStep[],
): ExtractComfortMae {
  const mpcErrors: number[] = [];
  const emulatedErrors: number[] = [];
  const demandErrors: number[] = [];

  for (const step of steps) {
    const measured = step.extractTempMeasC;
    if (measured == null) continue;

    if (step.extractTempPredC != null) {
      mpcErrors.push(Math.abs(measured - step.extractTempPredC));
    }
    if (step.extractTempPredEmulatedC != null) {
      emulatedErrors.push(Math.abs(measured - step.extractTempPredEmulatedC));
    }
    if (step.extractTempPredDemandC != null) {
      demandErrors.push(Math.abs(measured - step.extractTempPredDemandC));
    }
  }

  const comparedSteps = Math.max(mpcErrors.length, emulatedErrors.length, demandErrors.length);

  return {
    comparedSteps,
    maeObservedVsMpcC: meanAbsError(mpcErrors),
    maeObservedVsEmulatedC: meanAbsError(emulatedErrors),
    maeObservedVsDemandC: meanAbsError(demandErrors),
  };
}

export type MpcComfortPoint = {
  t: string;
  measuredC: number | null;
  emulatedC: number | null;
  mpcC: number | null;
  demandC: number | null;
  comfortBandMinC: number;
  comfortBandMaxC: number;
  comfortViolationMpc: boolean;
  comfortViolationEmulated: boolean;
  comfortViolationDemand: boolean;
};

export function buildMpcComfortSeries(
  steps: readonly MpcReplayStep[],
): MpcComfortPoint[] {
  return steps
    .filter(
      (s) =>
        s.extractTempMeasC != null ||
        s.extractTempPredC != null ||
        s.extractTempPredEmulatedC != null ||
        s.extractTempPredDemandC != null,
    )
    .map((s) => ({
      t: s.t,
      measuredC: s.extractTempMeasC,
      emulatedC: s.extractTempPredEmulatedC ?? null,
      mpcC: s.extractTempPredC,
      demandC: s.extractTempPredDemandC ?? null,
      comfortBandMinC: s.comfortBandMinC ?? DEFAULT_COMFORT_BAND.min,
      comfortBandMaxC: s.comfortBandMaxC ?? DEFAULT_COMFORT_BAND.max,
      comfortViolationMpc: s.comfortViolation,
      comfortViolationEmulated: s.comfortViolationEmulated ?? false,
      comfortViolationDemand: s.comfortViolationDemand ?? false,
    }));
}

/** Dynamisk komfortband for graf — min/max over serien (f.eks. ukeplan). */
export function resolveComfortBandFromSeries(
  points: readonly MpcComfortPoint[],
  fallback = DEFAULT_COMFORT_BAND,
): { min: number; max: number } {
  if (points.length === 0) return fallback;
  const mins = points.map((p) => p.comfortBandMinC);
  const maxs = points.map((p) => p.comfortBandMaxC);
  return {
    min: Math.min(...mins),
    max: Math.max(...maxs),
  };
}
