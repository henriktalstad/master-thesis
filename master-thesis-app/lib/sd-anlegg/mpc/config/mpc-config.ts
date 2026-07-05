import type { MpcControlBounds, MpcSolverConfig } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  applyTuningPreset,
  MPC_TUNING_ANLEGG_PRIS_RESPONS_V1,
  MPC_TUNING_TUNED_V3,
  presetById,
  type MpcTuningPresetId,
} from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import { normalizeTuningPresetId } from "@/lib/sd-anlegg/control/control-nomenclature";

export const MPC_CONTROL_MODEL_VERSION = "mpc-v1.1-building";

export const DEFAULT_MPC_BOUNDS: MpcControlBounds = {
  min: {
    supplySetpointC: 14,
    supplyFanPct: 0,
    exhaustFanPct: 0,
    heatingValvePct: 0,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  },
  max: {
    supplySetpointC: 26,
    supplyFanPct: 100,
    exhaustFanPct: 100,
    heatingValvePct: 100,
    coolingValvePct: 100,
    districtTr002ValvePct: 100,
    districtTr003ValvePct: 100,
  },
  maxDeltaPerStep: {
    supplySetpointC: 1.5,
    supplyFanPct: 12,
    exhaustFanPct: 12,
    heatingValvePct: 15,
    coolingValvePct: 15,
    districtTr002ValvePct: 12,
    districtTr003ValvePct: 12,
  },
};

function resolveDefaultTuningPresetId(): MpcTuningPresetId {
  const raw = process.env.MPC_TUNING_PRESET?.trim();
  if (!raw) return "anlegg_pris_respons_v1";
  return normalizeTuningPresetId(raw) ?? "anlegg_pris_respons_v1";
}

function solverFromPresetId(id: MpcTuningPresetId): MpcSolverConfig {
  const preset =
    id === "anlegg_pris_respons_v1"
      ? MPC_TUNING_ANLEGG_PRIS_RESPONS_V1
      : presetById(id);
  return applyTuningPreset(
    {
      horizonSteps: 96,
      stepMinutes: 15,
      comfortBandC: { min: 18, max: 24 },
      lambdaMove: MPC_TUNING_TUNED_V3.solver.lambdaMove,
      lambdaMoveTemporal: MPC_TUNING_TUNED_V3.solver.lambdaMoveTemporal,
      lambdaComfort: MPC_TUNING_TUNED_V3.solver.lambdaComfort,
      lambdaPeak: MPC_TUNING_TUNED_V3.solver.lambdaPeak,
      bounds: DEFAULT_MPC_BOUNDS,
      maxIterations: MPC_TUNING_TUNED_V3.solver.maxIterations,
      learningRate: MPC_TUNING_TUNED_V3.solver.learningRate,
    },
    preset,
  );
}

const DEFAULT_MPC_SOLVER_CONFIG: MpcSolverConfig =
  solverFromPresetId(resolveDefaultTuningPresetId());

function parseEnvNumber(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Env-overstyringer for tuning (MPC_LAMBDA_MOVE, MPC_LAMBDA_COMFORT, …). */
export function applyMpcSolverEnvOverrides(
  config: MpcSolverConfig,
): MpcSolverConfig {
  const lambdaMove = parseEnvNumber("MPC_LAMBDA_MOVE");
  const lambdaMoveTemporal = parseEnvNumber("MPC_LAMBDA_MOVE_TEMPORAL");
  const lambdaComfort = parseEnvNumber("MPC_LAMBDA_COMFORT");
  const lambdaPeak = parseEnvNumber("MPC_LAMBDA_PEAK");
  const maxIterations = parseEnvNumber("MPC_MAX_ITERATIONS");
  const learningRate = parseEnvNumber("MPC_LEARNING_RATE");

  return {
    ...config,
    ...(lambdaMove != null && lambdaMove >= 0 ? { lambdaMove } : {}),
    ...(lambdaMoveTemporal != null && lambdaMoveTemporal >= 0
      ? { lambdaMoveTemporal }
      : {}),
    ...(lambdaComfort != null && lambdaComfort >= 0 ? { lambdaComfort } : {}),
    ...(lambdaPeak != null && lambdaPeak >= 0 ? { lambdaPeak } : {}),
    ...(maxIterations != null && maxIterations >= 5 && maxIterations <= 120
      ? { maxIterations: Math.floor(maxIterations) }
      : {}),
    ...(learningRate != null && learningRate > 0 && learningRate <= 1
      ? { learningRate }
      : {}),
  };
}

/** Raskere replay under utvikling (6 t horisont). */
const DEV_MPC_SOLVER_CONFIG: MpcSolverConfig = {
  ...DEFAULT_MPC_SOLVER_CONFIG,
  horizonSteps: 24,
  maxIterations: 40,
};

/** Interaktiv replay — preferanse-preview og inkrementelle batcher. */
const INTERACTIVE_REPLAY_MPC_SOLVER_CONFIG: MpcSolverConfig = {
  ...DEFAULT_MPC_SOLVER_CONFIG,
  horizonSteps: 24,
  maxIterations: 30,
  learningRate: MPC_TUNING_TUNED_V3.solver.learningRate,
};

export type MpcReplaySolverProfile = "interactive" | "thesis";

/** Søkesenter for δu: hybrid = målt u_k ved i=0, emulert fremover (Walnum nær legacy). */
export type MpcSearchAnchorMode = "emulated" | "observed" | "hybrid";

export function resolveMpcSearchAnchorMode(): MpcSearchAnchorMode {
  const raw = process.env.MPC_SEARCH_ANCHOR?.trim().toLowerCase();
  if (raw === "emulated" || raw === "observed" || raw === "hybrid") {
    return raw;
  }
  return "hybrid";
}

/**
 * Receding-horizon replay: thesis bruker full horisont; interactive er raskere.
 */
const REPLAY_MPC_SOLVER_CONFIG: MpcSolverConfig = {
  ...solverFromPresetId(resolveDefaultTuningPresetId()),
};

function resolveReplaySolverProfile(): MpcReplaySolverProfile {
  const raw = process.env.MPC_REPLAY_PROFILE?.trim().toLowerCase();
  if (raw === "thesis" || raw === "interactive") return raw;
  return "thesis";
}

export function resolveMpcSolverConfig(): MpcSolverConfig {
  let config = DEFAULT_MPC_SOLVER_CONFIG;
  if (process.env.MPC_DEV_HORIZON === "1") {
    config = DEV_MPC_SOLVER_CONFIG;
  } else {
    const horizon = Number(process.env.MPC_HORIZON_STEPS ?? "96");
    if (Number.isFinite(horizon) && horizon >= 8 && horizon <= 96) {
      config = { ...DEFAULT_MPC_SOLVER_CONFIG, horizonSteps: Math.floor(horizon) };
    }
  }
  return applyMpcSolverEnvOverrides(config);
}

export function mergeReplaySolverWithCalibration(
  replayBase: MpcSolverConfig,
  calibrationSolver: MpcSolverConfig,
): MpcSolverConfig {
  return {
    ...calibrationSolver,
    ...replayBase,
    horizonSteps: replayBase.horizonSteps,
    maxIterations: replayBase.maxIterations,
  };
}

/** Solver for historisk replay — full 96-steg kun med MPC_FULL_REPLAY=1. */
export function resolveMpcReplaySolverConfig(
  calibrationSolver?: MpcSolverConfig,
  profile?: MpcReplaySolverProfile,
): MpcSolverConfig {
  if (process.env.MPC_FULL_REPLAY === "1") {
    return applyMpcSolverEnvOverrides(
      calibrationSolver ?? resolveMpcSolverConfig(),
    );
  }
  if (process.env.MPC_DEV_HORIZON === "1") {
    return DEV_MPC_SOLVER_CONFIG;
  }
  const effectiveProfile = profile ?? resolveReplaySolverProfile();
  const profileBase =
    effectiveProfile === "interactive"
      ? INTERACTIVE_REPLAY_MPC_SOLVER_CONFIG
      : REPLAY_MPC_SOLVER_CONFIG;
  const replayHorizon = Number(
    process.env.MPC_REPLAY_HORIZON_STEPS ??
      String(profileBase.horizonSteps),
  );
  const replayIters = Number(
    process.env.MPC_REPLAY_MAX_ITERATIONS ??
      String(profileBase.maxIterations),
  );
  const replayBase = applyMpcSolverEnvOverrides({
    ...profileBase,
    horizonSteps:
      Number.isFinite(replayHorizon) && replayHorizon >= 4 && replayHorizon <= 96
        ? Math.floor(replayHorizon)
        : profileBase.horizonSteps,
    maxIterations:
      Number.isFinite(replayIters) && replayIters >= 5 && replayIters <= 120
        ? Math.floor(replayIters)
        : profileBase.maxIterations,
  });
  return calibrationSolver
    ? mergeReplaySolverWithCalibration(replayBase, calibrationSolver)
    : replayBase;
}
