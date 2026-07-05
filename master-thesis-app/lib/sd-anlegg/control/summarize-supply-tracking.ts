import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function meanAbsError(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export type SupplyTrackingSummary = {
  /** Steg med både operatør-SP og målt tilluft. */
  comparedSteps: number;
  /** |T_sup,meas − T_sup,SP| — lokal BMS-sporing, ikke komfortproxy. */
  maeSetpointTrackingC: number | null;
  /** Siste observerte avvik (°C). */
  latestDeltaC: number | null;
};

/** Sekundær diagnostikk: hvor tett målt tilluft følger settpunkt. */
export function summarizeSupplySetpointTracking(
  steps: readonly MpcReplayStep[],
): SupplyTrackingSummary {
  const errors: number[] = [];
  let latestDelta: number | null = null;

  for (const step of steps) {
    const measured = step.supplyTempMeasC;
    const setpoint = step.uBmsMeas?.supplySetpointC;
    if (measured == null || setpoint == null || !Number.isFinite(measured) || !Number.isFinite(setpoint)) {
      continue;
    }
    const delta = measured - setpoint;
    errors.push(Math.abs(delta));
    latestDelta = Math.round(delta * 10) / 10;
  }

  return {
    comparedSteps: errors.length,
    maeSetpointTrackingC: meanAbsError(errors),
    latestDeltaC: latestDelta,
  };
}
