import { emulateBaselineControl } from "@/lib/sd-anlegg/mpc/controller/envelope-model/fit-baseline-emulator";
import { policyNomenclature } from "@/lib/sd-anlegg/control/control-nomenclature";
import { computeDemandControlFromTimestep } from "./demand-from-timestep";
import type { ControlPolicy, PolicyId, PolicyStepContext, PolicyStepResult } from "@/lib/sd-anlegg/mpc/shared/types";

const observedPolicy: ControlPolicy = {
  id: "observed",
  label: policyNomenclature("observed").shortLabel,
  claimLevel: "observed",
  computeControl(ctx: PolicyStepContext): PolicyStepResult {
    return { u: ctx.step.uMeas, skipped: ctx.step.uMeas == null };
  },
};

const emulatedPolicy: ControlPolicy = {
  id: "emulated",
  label: policyNomenclature("emulated").shortLabel,
  claimLevel: "predicted",
  computeControl(ctx: PolicyStepContext): PolicyStepResult {
    return { u: ctx.uBmsSim, skipped: false };
  },
};

const demandScopedPolicy: ControlPolicy = {
  id: "demand-scoped",
  label: policyNomenclature("demand-scoped").shortLabel,
  claimLevel: "simulated",
  computeControl(ctx: PolicyStepContext): PolicyStepResult {
    return computeDemandControlFromTimestep(ctx);
  },
};

const mpcPolicy: ControlPolicy = {
  id: "mpc-v1",
  label: policyNomenclature("mpc-v1").shortLabel,
  claimLevel: "simulated",
  computeControl(ctx: PolicyStepContext): PolicyStepResult {
    const u = ctx.uMpc ?? ctx.uBmsSim;
    return { u, skipped: false };
  },
};

const POLICY_REGISTRY: Record<PolicyId, ControlPolicy> = {
  observed: observedPolicy,
  emulated: emulatedPolicy,
  "demand-scoped": demandScopedPolicy,
  "mpc-v1": mpcPolicy,
};

export const REPLAY_POLICY_IDS: PolicyId[] = [
  "observed",
  "emulated",
  "demand-scoped",
  "mpc-v1",
];

export function getControlPolicy(id: PolicyId): ControlPolicy {
  return POLICY_REGISTRY[id];
}

export function getAllControlPolicies(): ControlPolicy[] {
  return REPLAY_POLICY_IDS.map((id) => POLICY_REGISTRY[id]);
}

/** Emulert baseline uten PolicyStepContext — brukt i replay før policy-kall. */
export function computeEmulatedControl(
  calibration: PolicyStepContext["calibration"],
  step: PolicyStepContext["step"],
  context?: {
    tExtPrev?: number | null;
    disturbed?: boolean;
  },
) {
  return emulateBaselineControl(calibration.emulator, step, context);
}
