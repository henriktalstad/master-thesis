import type { PolicyId } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcFallbackReason } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";

export type MpcForwardPlanStep = {
  t: string;
  spotKrPerKwh: number | null;
  effectiveMarginalKrPerKwh: number | null;
  outdoorTempC: number | null;
  uBmsSim: MpcControlVector;
  uMpc: MpcControlVector;
  predictedExtractC: number | null;
  expectedDeltaCostKr: number | null;
  usedFallback?: boolean;
  fallbackReason?: MpcFallbackReason;
};

export type MpcForwardPlan = {
  horizonSteps: number;
  stepMinutes: number;
  planSteps: MpcForwardPlanStep[];
  optimizedSteps: number;
  fallbackSteps: number;
  fallbackByReason: {
    missing_u_meas: number;
    simultaneous_heat_cool: number;
    alarm: number;
    pump_fault: number;
  };
  effect: {
    totalCostBaselineKr: number;
    totalCostMpcKr: number;
    deltaCostKr: number;
    deltaCostPct: number;
    controllableElectricKwhBaseline?: number;
    controllableElectricKwhMpc?: number;
    controllableHeatKwhBaseline?: number;
    controllableHeatKwhMpc?: number;
  };
  weatherSource: "met_locationforecast" | "frost_hour_of_day" | "unavailable";
  dayAheadHourCount: number;
  computedAt: string;
};

export type ControlPlanDiff = {
  previousComputedAt: string | null;
  currentComputedAt: string;
  activeCommandDelta: Partial<Record<keyof MpcControlVector, number>>;
  effectDeltaKr: number | null;
  effectDeltaPct: number | null;
  horizonStepsChanged: number;
  firstChangedStepAt: string | null;
  summary: string;
};

export type ControlTickState = {
  lastControlTickAt: string | null;
  planDiff: ControlPlanDiff | null;
  activeCommand: MpcControlVector | null;
};

export type ControlTickHistoryEntry = {
  id: string;
  tickAt: string;
  triggerSource: string;
  planDiff: ControlPlanDiff | null;
  activeCommand: MpcControlVector | null;
  effectDeltaKr: number | null;
};

export type LiveForwardPlans = Partial<Record<PolicyId, MpcForwardPlan>>;

export type ControlTickTriggerReason =
  | "initial"
  | "scheduled"
  | "measurement_deviation"
  | "comfort_deviation"
  | "weather_forecast_drift"
  | "price_spike"
  | "skipped_recent";

export type ControlTickTriggerAssessment = {
  shouldRun: boolean;
  reason: ControlTickTriggerReason;
  detail: string;
};
