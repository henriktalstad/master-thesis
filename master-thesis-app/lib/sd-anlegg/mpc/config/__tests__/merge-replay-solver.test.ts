import { describe, expect, it } from "bun:test";
import { DEFAULT_MPC_BOUNDS } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { mergeReplaySolverWithCalibration } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { MPC_TUNING_COST_FOCUSED } from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import type { MpcSolverConfig } from "@/lib/sd-anlegg/mpc/shared/types";

const replayBase: MpcSolverConfig = {
  horizonSteps: 96,
  stepMinutes: 15,
  comfortBandC: { min: 18, max: 24 },
  lambdaMove: 0.015,
  lambdaMoveTemporal: 0.008,
  lambdaComfort: 1.5,
  lambdaPeak: 0.18,
  bounds: DEFAULT_MPC_BOUNDS,
  maxIterations: 60,
  learningRate: 0.12,
};

describe("mergeReplaySolverWithCalibration", () => {
  it("beholder replay-tuning og horisont selv om kalibrering har eldre preset", () => {
    const calibrationSolver: MpcSolverConfig = {
      ...replayBase,
      horizonSteps: 48,
      maxIterations: 30,
      lambdaMove: MPC_TUNING_COST_FOCUSED.solver.lambdaMove,
      lambdaMoveTemporal: MPC_TUNING_COST_FOCUSED.solver.lambdaMoveTemporal,
      lambdaComfort: MPC_TUNING_COST_FOCUSED.solver.lambdaComfort,
      learningRate: MPC_TUNING_COST_FOCUSED.solver.learningRate,
    };

    const merged = mergeReplaySolverWithCalibration(replayBase, calibrationSolver);

    expect(merged.horizonSteps).toBe(96);
    expect(merged.maxIterations).toBe(60);
    expect(merged.lambdaMoveTemporal).toBe(replayBase.lambdaMoveTemporal);
    expect(merged.lambdaComfort).toBe(replayBase.lambdaComfort);
    expect(merged.learningRate).toBe(replayBase.learningRate);
  });
});
