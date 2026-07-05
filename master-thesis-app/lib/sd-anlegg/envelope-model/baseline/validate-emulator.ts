import { emulateBaselineControl } from "@/lib/sd-anlegg/envelope-model/baseline/fit-emulator";
import {
  coolingActiveFromVector,
  heatingActiveFromVector,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import { isDisturbedOperationStep } from "@/lib/sd-anlegg/mpc/config/constraints/normal-drift-step";
import { classificationAccuracy, meanAbs } from "@/lib/sd-anlegg/envelope-model/lib/stats";
import type {
  BaselineEmulatorParams,
  EmulatorValidationMetrics,
  MpcTimestep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";

export function validateBaselineEmulator(
  steps: readonly MpcTimestep[],
  params: BaselineEmulatorParams,
): EmulatorValidationMetrics {
  const errors: Partial<
    Record<keyof import("@/lib/sd-anlegg/mpc/shared/types").MpcControlVector, number[]>
  > = {};
  const heatingPred: boolean[] = [];
  const heatingActual: boolean[] = [];
  const coolingPred: boolean[] = [];
  const coolingActual: boolean[] = [];

  let compared = 0;
  let tExtPrev =
    steps[0]?.extractTempC ?? params.defaultExtractSetpointC ?? 21;

  for (const step of steps) {
    if (!step.uMeas) continue;
    compared += 1;
    const sim = emulateBaselineControl(params, step, {
      tExtPrev,
      disturbed: isDisturbedOperationStep(step),
    });

    for (const key of MPC_CONTROL_KEYS) {
      const arr = errors[key] ?? [];
      arr.push(Math.abs(step.uMeas[key] - sim[key]));
      errors[key] = arr;
    }

    heatingPred.push(heatingActiveFromVector(sim));
    heatingActual.push(step.heatingActive);
    coolingPred.push(coolingActiveFromVector(sim));
    coolingActual.push(step.coolingActive);

    if (step.extractTempC != null) {
      tExtPrev = step.extractTempC;
    }
  }

  const mae: EmulatorValidationMetrics["mae"] = {};
  for (const key of MPC_CONTROL_KEYS) {
    const values = errors[key];
    if (values?.length) {
      mae[key] = Math.round(meanAbs(values) * 100) / 100;
    }
  }

  return {
    comparedSteps: compared,
    mae,
    heatingModeAccuracy: classificationAccuracy(heatingPred, heatingActual),
    coolingModeAccuracy: classificationAccuracy(coolingPred, coolingActual),
  };
}
