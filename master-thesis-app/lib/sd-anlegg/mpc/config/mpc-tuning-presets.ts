import type { MpcSolverConfig } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  normalizeTuningPresetId,
  tuningPresetNomenclature,
} from "@/lib/sd-anlegg/control/control-nomenclature";

export type MpcTuningPresetId =
  | "comfort_guarded"
  | "baseline_v1"
  | "tuned_v2"
  | "tuned_v3"
  | "cost_focused"
  | "anlegg_pris_respons_v1";

export type MpcTuningPreset = {
  id: MpcTuningPresetId;
  label: string;
  description: string;
  solver: Pick<
    MpcSolverConfig,
    | "horizonSteps"
    | "lambdaMove"
    | "lambdaMoveTemporal"
    | "lambdaComfort"
    | "lambdaPeak"
    | "maxIterations"
    | "learningRate"
  >;
};

/** Komfort-tung stresstest: lav toleranse for proxy-avvik, mindre økonomisk fleksibilitet. */
export const MPC_TUNING_COMFORT_GUARDED: MpcTuningPreset = {
  id: "comfort_guarded",
  label: "Comfort guarded",
  description: "λ_comfort=4, λ_move=0.08, 30 iter — komfort-dominerende stresstest.",
  solver: {
    horizonSteps: 96,
    lambdaMove: 0.08,
    lambdaMoveTemporal: 0,
    lambdaComfort: 4,
    lambdaPeak: 0.15,
    maxIterations: 30,
    learningRate: 0.06,
  },
};

/** Standard etter første E2E-runde (2026-06-29). */
export const MPC_TUNING_BASELINE_V1: MpcTuningPreset = {
  id: "baseline_v1",
  label: "Baseline v1",
  description: "λ_comfort=2, replay 96×30 — marginal kostbesparelse.",
  solver: {
    horizonSteps: 96,
    lambdaMove: 0.08,
    lambdaMoveTemporal: 0,
    lambdaComfort: 2,
    lambdaPeak: 0.15,
    maxIterations: 30,
    learningRate: 0.06,
  },
};

/** Anbefalt etter sweep — mer δu, bedre konvergens, balansert komfort. */
export const MPC_TUNING_TUNED_V2: MpcTuningPreset = {
  id: "tuned_v2",
  label: "Tuned v2",
  description:
    "λ_comfort=1.5, λ_move=0.015, 60 iter, lr=0.12 — pris/komfort-balance.",
  solver: {
    horizonSteps: 96,
    lambdaMove: 0.015,
    lambdaMoveTemporal: 0,
    lambdaComfort: 1.5,
    lambdaPeak: 0.18,
    maxIterations: 60,
    learningRate: 0.12,
  },
};

export const MPC_TUNING_TUNED_V3: MpcTuningPreset = {
  id: "tuned_v3",
  label: tuningPresetNomenclature("tuned_v3").shortLabel,
  description: tuningPresetNomenclature("tuned_v3").description,
  solver: {
    horizonSteps: 96,
    lambdaMove: 0.015,
    lambdaMoveTemporal: 0.008,
    lambdaComfort: 1.5,
    lambdaPeak: 0.18,
    maxIterations: 60,
    learningRate: 0.12,
  },
};

/** Sensitivitet: lavere komfort-straff, høyere peak-straff — kost-fokusert. */
export const MPC_TUNING_COST_FOCUSED: MpcTuningPreset = {
  id: "cost_focused",
  label: "Cost focused",
  description: "λ_comfort=0.8, λ_peak=0.2, λ_move=0.02 — tester kostprioritet.",
  solver: {
    horizonSteps: 96,
    lambdaMove: 0.02,
    lambdaMoveTemporal: 0.004,
    lambdaComfort: 0.8,
    lambdaPeak: 0.2,
    maxIterations: 60,
    learningRate: 0.08,
  },
};

/**
 * Standard thesis-replay — pris-respons og total anleggstyring i scope.
 */
export const MPC_TUNING_ANLEGG_PRIS_RESPONS_V1: MpcTuningPreset = {
  id: "anlegg_pris_respons_v1",
  label: tuningPresetNomenclature("anlegg_pris_respons_v1").shortLabel,
  description: tuningPresetNomenclature("anlegg_pris_respons_v1").description,
  solver: {
    horizonSteps: 96,
    lambdaMove: 0.008,
    lambdaMoveTemporal: 0.002,
    lambdaComfort: 0.9,
    lambdaPeak: 0.17,
    maxIterations: 80,
    learningRate: 0.12,
  },
};

/** @deprecated Bruk anlegg_pris_respons_v1 — beholdt for env-alias demand_optimal. */
export const MPC_TUNING_DEMAND_OPTIMAL = MPC_TUNING_ANLEGG_PRIS_RESPONS_V1;

/** Full historical sweep — dev only; thesis uses MPC_THESIS_TUNING_PRESETS. */
export const MPC_TUNING_PRESETS_ALL: readonly MpcTuningPreset[] = [
  MPC_TUNING_COMFORT_GUARDED,
  MPC_TUNING_BASELINE_V1,
  MPC_TUNING_TUNED_V2,
  MPC_TUNING_TUNED_V3,
  MPC_TUNING_COST_FOCUSED,
  MPC_TUNING_ANLEGG_PRIS_RESPONS_V1,
];

/** Thesis appendix: canonical replay + two robustness contrasts. */
export const MPC_THESIS_TUNING_PRESETS: readonly MpcTuningPreset[] = [
  MPC_TUNING_ANLEGG_PRIS_RESPONS_V1,
  MPC_TUNING_COMFORT_GUARDED,
  MPC_TUNING_COST_FOCUSED,
];

/** @deprecated Alias for MPC_TUNING_PRESETS_ALL. */
export const MPC_TUNING_PRESETS = MPC_TUNING_PRESETS_ALL;

export function applyTuningPreset(
  base: MpcSolverConfig,
  preset: MpcTuningPreset,
): MpcSolverConfig {
  return {
    ...base,
    ...preset.solver,
    bounds: base.bounds,
    stepMinutes: base.stepMinutes,
    comfortBandC: base.comfortBandC,
  };
}

export function presetById(id: string): MpcTuningPreset {
  const normalized = normalizeTuningPresetId(id);
  if (!normalized) throw new Error(`Unknown preset: ${id}`);
  const preset = MPC_TUNING_PRESETS.find((p) => p.id === normalized);
  if (!preset) throw new Error(`Unknown preset: ${id}`);
  return preset;
}

const SOLVER_MATCH_KEYS = [
  "horizonSteps",
  "lambdaMove",
  "lambdaMoveTemporal",
  "lambdaComfort",
  "lambdaPeak",
  "maxIterations",
  "learningRate",
] as const;

/** Matcher lagret solver mot kjente presets (f.eks. for replay-provenance i UI). */
export function inferTuningPresetFromSolver(
  solver: Pick<MpcSolverConfig, (typeof SOLVER_MATCH_KEYS)[number]>,
): MpcTuningPreset | null {
  for (const preset of MPC_TUNING_PRESETS) {
    const matches = SOLVER_MATCH_KEYS.every(
      (key) => Math.abs((solver[key] ?? 0) - (preset.solver[key] ?? 0)) < 1e-6,
    );
    if (matches) return preset;
  }
  return null;
}

export const MPC_TUNING_SCORE_WEIGHTS = {
  highPriceShift: 0.3,
  comfortIncrease: 0.5,
  fallbackPct: 0.2,
} as const;

export function mpcTuningScore(input: {
  deltaCostVsEmulatedPct: number;
  highPriceShiftPct: number | null;
  comfortIncrease: number;
  fallbackPct: number;
}): number {
  return (
    -input.deltaCostVsEmulatedPct +
    (input.highPriceShiftPct ?? 0) * MPC_TUNING_SCORE_WEIGHTS.highPriceShift -
    Math.max(0, input.comfortIncrease) * MPC_TUNING_SCORE_WEIGHTS.comfortIncrease -
    input.fallbackPct * MPC_TUNING_SCORE_WEIGHTS.fallbackPct
  );
}
