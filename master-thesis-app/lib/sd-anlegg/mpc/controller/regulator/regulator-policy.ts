import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import { controlVector } from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";

const DEFAULT_REGULATOR_U = controlVector({
  supplySetpointC: 18,
  supplyFanPct: 30,
  exhaustFanPct: 30,
});

/** Optimizer output — heat power or direct AHU vector. */
export type SupervisoryOutput = {
  qHeatKw?: number;
  uDirect?: MpcControlVector;
};

export type RegulatorState = {
  tExtC: number | null;
  tSupMeasC: number | null;
  uPrevious: MpcControlVector | null;
};

export interface RegulatorPolicy {
  id: string;
  apply(output: SupervisoryOutput, state: RegulatorState): MpcControlVector;
}

/** Nåværende mpc-v1: optimizer velger u_k direkte. */
export class DirectAhuRegulator implements RegulatorPolicy {
  id = "direct-ahu";

  apply(output: SupervisoryOutput, state: RegulatorState): MpcControlVector {
    if (output.uDirect) return output.uDirect;
    return state.uPrevious ?? DEFAULT_REGULATOR_U;
  }
}

/** Fremtidig fjernvarme cascade: q_h → T_sup (stub). */
export class CascadeHeatRegulator implements RegulatorPolicy {
  id = "cascade-heat";

  apply(output: SupervisoryOutput, state: RegulatorState): MpcControlVector {
    const base = state.uPrevious ?? DEFAULT_REGULATOR_U;

    if (output.uDirect) return output.uDirect;

    const q = output.qHeatKw ?? 0;
    const deltaT = Math.min(4, Math.max(-2, q / 50));
    return {
      ...base,
      supplySetpointC: Math.round((base.supplySetpointC + deltaT) * 10) / 10,
      heatingValvePct: Math.min(100, Math.max(0, base.heatingValvePct + q / 2)),
    };
  }
}

export const DEFAULT_REGULATOR = new DirectAhuRegulator();
