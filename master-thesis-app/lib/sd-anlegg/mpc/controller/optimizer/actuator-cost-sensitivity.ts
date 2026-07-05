import type { MpcControlVector, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

const FAN_ON_THRESHOLD_PCT = 5;
const VALVE_ACTIVE_THRESHOLD_PCT = 8;

/** Tilluft-SP påvirker varme/kjøle-proxy kun når ventil er aktiv. */
export function supplySetpointAffectsPower(input: {
  u: MpcControlVector;
  step: Pick<MpcTimestep, "heatingActive" | "coolingActive">;
}): boolean {
  if (input.step.heatingActive && input.u.heatingValvePct > VALVE_ACTIVE_THRESHOLD_PCT) {
    return true;
  }
  if (input.step.coolingActive && input.u.coolingValvePct > VALVE_ACTIVE_THRESHOLD_PCT) {
    return true;
  }
  return false;
}

/**
 * Vekt for gradient/δu per kanal — høy på vifte/ventil (kost-spaker), lav på SP uten effekt-kobling.
 */
export function actuatorCostWeight(input: {
  key: keyof MpcControlVector;
  u: MpcControlVector;
  step: Pick<MpcTimestep, "heatingActive" | "coolingActive">;
}): number {
  switch (input.key) {
    case "supplyFanPct":
      return input.u.supplyFanPct > FAN_ON_THRESHOLD_PCT ? 1 : 0.15;
    case "exhaustFanPct":
      return input.u.exhaustFanPct > FAN_ON_THRESHOLD_PCT ? 1 : 0.15;
    case "heatingValvePct":
      return input.step.heatingActive ? 1 : 0.1;
    case "coolingValvePct":
      return input.step.coolingActive ? 1 : 0.1;
    case "districtTr002ValvePct":
    case "districtTr003ValvePct":
      return input.step.heatingActive ? 1 : 0.08;
    case "supplySetpointC":
      return supplySetpointAffectsPower(input) ? 0.55 : 0.06;
    default:
      return 1;
  }
}

export function isEconomicControlDelta(delta: MpcControlVector): boolean {
  return (
    Math.abs(delta.supplyFanPct) > 0.5 ||
    Math.abs(delta.exhaustFanPct) > 0.5 ||
    Math.abs(delta.heatingValvePct) > 0.5 ||
    Math.abs(delta.coolingValvePct) > 0.5 ||
    Math.abs(delta.districtTr002ValvePct) > 0.5 ||
    Math.abs(delta.districtTr003ValvePct) > 0.5
  );
}

/** Optimizer itererer kost-spaker før komfort-only SP. */
export const MPC_OPTIMIZER_KEY_ORDER: readonly (keyof MpcControlVector)[] = [
  "supplyFanPct",
  "exhaustFanPct",
  "heatingValvePct",
  "districtTr002ValvePct",
  "districtTr003ValvePct",
  "coolingValvePct",
  "supplySetpointC",
];
