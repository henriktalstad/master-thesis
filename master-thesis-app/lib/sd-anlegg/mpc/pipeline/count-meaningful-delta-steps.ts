import {
  controlVectorNormSq,
  deltaControlVectors,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import type { MpcReplayStep, MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import { isEconomicControlDelta } from "@/lib/sd-anlegg/mpc/controller/optimizer/actuator-cost-sensitivity";

/** Minimum ‖δu‖² for å telle som meningsfull endring (ca. 0.5 °C SP eller 5 % vifte). */
export const MEANINGFUL_DELTA_NORM_SQ = 0.25;

/** Avvik simulert MPC vs faktisk målt styring (uBmsMeas). */
export function countMpcVsObservedDeltaSteps(
  steps: readonly MpcReplayStep[],
): {
  deltaSteps: number;
  deltaPct: number;
  eligibleSteps: number;
} {
  const eligible = steps.filter((step) => step.uBmsMeas != null);
  if (eligible.length === 0) {
    return { deltaSteps: 0, deltaPct: 0, eligibleSteps: 0 };
  }
  const deltaSteps = eligible.filter((step) => {
    const delta = deltaControlVectors(step.uMpc, step.uBmsMeas!);
    return controlVectorNormSq(delta) > MEANINGFUL_DELTA_NORM_SQ;
  }).length;
  return {
    deltaSteps,
    deltaPct: Math.round((deltaSteps / eligible.length) * 1000) / 10,
    eligibleSteps: eligible.length,
  };
}

/** δu på vifte/ventil — faktisk kost-spaker i proxy-modellen. */
export function countEconomicDeltaSteps(
  steps: readonly MpcReplayStep[],
): { economicSteps: number; economicPct: number } {
  if (steps.length === 0) {
    return { economicSteps: 0, economicPct: 0 };
  }
  const economicSteps = steps.filter(
    (step) => !step.usedFallback && isEconomicControlDelta(step.deltaU),
  ).length;
  return {
    economicSteps,
    economicPct: Math.round((economicSteps / steps.length) * 1000) / 10,
  };
}

export function isMeaningfulControlDelta(delta: MpcControlVector): boolean {
  return controlVectorNormSq(delta) > MEANINGFUL_DELTA_NORM_SQ;
}
