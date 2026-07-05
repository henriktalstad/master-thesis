import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

export type MpcFallbackReason =
  | "missing_u_meas"
  | "simultaneous_heat_cool"
  | "alarm"
  | "pump_fault"
  | null;

export type StepValidity = {
  canOptimize: boolean;
  fallbackReason: MpcFallbackReason;
};

export type MpcFallbackByReason = {
  missing_u_meas: number;
  simultaneous_heat_cool: number;
  alarm: number;
  pump_fault: number;
};

export function emptyFallbackByReason(): MpcFallbackByReason {
  return {
    missing_u_meas: 0,
    simultaneous_heat_cool: 0,
    alarm: 0,
    pump_fault: 0,
  };
}

export function recordFallbackReason(
  counts: MpcFallbackByReason,
  reason: MpcFallbackReason,
): void {
  if (!reason) return;
  if (reason === "missing_u_meas") counts.missing_u_meas += 1;
  if (reason === "simultaneous_heat_cool") counts.simultaneous_heat_cool += 1;
  if (reason === "alarm") counts.alarm += 1;
  if (reason === "pump_fault") counts.pump_fault += 1;
}

/** Methods eq:method_mpc_fallback — strukturert årsak for metrics, UI og LaTeX. */
function pumpFaultBlocksOptimization(step: MpcTimestep): boolean {
  if (step.pumpHeatingMalfunctionActive) {
    if (step.heatingActive) return true;
    if ((step.uMeas?.heatingValvePct ?? 0) > 8) return true;
  }
  if (step.pumpCoolingMalfunctionActive) {
    if (step.coolingActive) return true;
    if ((step.uMeas?.coolingValvePct ?? 0) > 8) return true;
  }
  return false;
}

export function assessMpcStepValidity(step: MpcTimestep): StepValidity {
  if (step.alarmActive) {
    return { canOptimize: false, fallbackReason: "alarm" };
  }
  if (pumpFaultBlocksOptimization(step)) {
    return { canOptimize: false, fallbackReason: "pump_fault" };
  }
  if (!step.uMeas) {
    return { canOptimize: false, fallbackReason: "missing_u_meas" };
  }
  if (step.heatingActive && step.coolingActive) {
    return { canOptimize: false, fallbackReason: "simultaneous_heat_cool" };
  }
  return { canOptimize: true, fallbackReason: null };
}

export function shouldUseFallback(step: MpcTimestep): boolean {
  return !assessMpcStepValidity(step).canOptimize;
}

export function countOptimizableSteps(steps: readonly MpcTimestep[]): {
  optimizableSteps: number;
  optimizablePct: number;
} {
  if (steps.length === 0) {
    return { optimizableSteps: 0, optimizablePct: 0 };
  }
  const optimizableSteps = steps.filter(
    (step) => assessMpcStepValidity(step).canOptimize,
  ).length;
  return {
    optimizableSteps,
    optimizablePct: optimizableSteps / steps.length,
  };
}

/** Gjenoppbygg deploy-årsak fra persistert replay-steg når fallbackReason mangler i DB. */
export function inferFallbackReasonFromReplayStep(step: {
  uBmsMeas?: MpcTimestep["uMeas"] | null;
  fallbackReason?: MpcFallbackReason | null;
  fireAlarmActive?: boolean;
  alarmActive?: boolean;
  pumpHeatingMalfunctionActive?: boolean;
  pumpCoolingMalfunctionActive?: boolean;
  heatingActive?: boolean;
  coolingActive?: boolean;
}): MpcFallbackReason {
  if (step.fallbackReason) return step.fallbackReason;
  if (!step.uBmsMeas) return "missing_u_meas";
  if (step.fireAlarmActive || step.alarmActive) return "alarm";
  const asTimestep = {
    ...step,
    uMeas: step.uBmsMeas,
  } as MpcTimestep;
  if (pumpFaultBlocksOptimization(asTimestep)) return "pump_fault";
  return null;
}
