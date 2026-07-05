import { createHash } from "crypto";

import { MPC_CONTROL_MODEL_VERSION } from "./control-constants";
import { REPLAY_POLICY_IDS } from "@/lib/sd-anlegg/mpc/controller/policies/registry";
import { resolveStateBlendAlpha } from "@/lib/sd-anlegg/mpc/controller/state-estimator/extract-blend";

export function buildMpcInputFingerprint(input: {
  buildingId: string;
  evalStart: string;
  evalEnd: string;
  stepCount: number;
  modelVersion?: string;
  horizonSteps?: number;
  maxIterations?: number;
}): string {
  const payload = [
    input.buildingId,
    input.modelVersion ?? MPC_CONTROL_MODEL_VERSION,
    input.evalStart,
    input.evalEnd,
    String(input.stepCount),
    REPLAY_POLICY_IDS.join(","),
    String(input.horizonSteps ?? ""),
    String(input.maxIterations ?? ""),
    String(resolveStateBlendAlpha()),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}
