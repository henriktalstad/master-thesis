import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import { assessMpcStepValidity } from "./mpc-step-validity";

export function isNormalDriftTrainingStep(step: MpcTimestep): boolean {
  if (!assessMpcStepValidity(step).canOptimize) return false;
  if (step.frostRiskActive) return false;
  if (step.lowEfficiencyActive) return false;
  return true;
}

export function isDisturbedOperationStep(step: MpcTimestep): boolean {
  return !isNormalDriftTrainingStep(step);
}
