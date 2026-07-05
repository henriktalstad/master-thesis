import type { MpcCalibrationBundle, MpcControlVector, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

export const POLICY_IDS = [
  "observed",
  "emulated",
  "demand-scoped",
  "mpc-v1",
] as const;

export type PolicyId = (typeof POLICY_IDS)[number];

export type PolicyClaimLevel = "observed" | "predicted" | "simulated";

export type PolicyStepContext = {
  step: MpcTimestep;
  stepIndex: number;
  steps: readonly MpcTimestep[];
  calibration: MpcCalibrationBundle;
  tExtState: number;
  uBmsSim: MpcControlVector;
  /** Normalisert belegg q ∈ [0,1] for steget. */
  occupancyQ?: number;
  /** Fylt av replay-løkken for mpc-v1 etter solveMpcHorizon. */
  uMpc?: MpcControlVector;
  priceThresholds: { high: number; low: number };
  /** Daglig P75/P25 — brukes for pris-respons på flate sommerpriser. */
  dailyPriceThresholds?: ReadonlyMap<
    string,
    { high: number; low: number }
  >;
  canOptimize: boolean;
};

export type PolicyStepResult = {
  u: MpcControlVector | null;
  skipped: boolean;
  /** Proxy-skala når shadow-policy justerer uten full effekt i TR003-anker. */
  powerScale?: { electric: number; heat: number };
};

export type ControlPolicy = {
  id: PolicyId;
  label: string;
  claimLevel: PolicyClaimLevel;
  computeControl(ctx: PolicyStepContext): PolicyStepResult;
};

export type PolicySummaryKpi = {
  policyId: PolicyId;
  label: string;
  thesisLabel: string;
  controlMode: import("@/lib/sd-anlegg/control/control-nomenclature").ControlModeId;
  controlModeLabel: string;
  role: "reference" | "comparator" | "proposed";
  claimLevel: PolicyClaimLevel;
  totalCostKr: number;
  deltaCostVsObservedKr: number;
  deltaCostVsObservedPct: number;
  comfortViolations: number;
  peakElectricKw: number;
  controllableElectricKwh: number;
  controllableHeatKwh: number;
};
