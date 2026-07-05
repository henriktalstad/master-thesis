import { describe, expect, it } from "bun:test";
import {
  applyTuningPreset,
  inferTuningPresetFromSolver,
  MPC_TUNING_DEMAND_OPTIMAL,
  MPC_TUNING_TUNED_V2,
  MPC_TUNING_TUNED_V3,
  presetById,
} from "../mpc-tuning-presets";
import {
  resolveMpcReplaySolverConfig,
  resolveMpcSolverConfig,
} from "../mpc-config";

describe("mpc-tuning-presets", () => {
  it("tuned_v2 har lavere move-straff enn comfort_guarded", () => {
    const comfortGuarded = presetById("comfort_guarded");
    expect(MPC_TUNING_TUNED_V2.solver.lambdaMove).toBeLessThan(
      comfortGuarded.solver.lambdaMove,
    );
    expect(MPC_TUNING_TUNED_V2.solver.maxIterations).toBeGreaterThan(
      comfortGuarded.solver.maxIterations,
    );
  });

  it("tuned_v3 har temporal move-straff", () => {
    expect(MPC_TUNING_TUNED_V3.solver.lambdaMoveTemporal).toBeGreaterThan(0);
  });

  it("applyTuningPreset beholder bounds og stepMinutes", () => {
    const base = resolveMpcSolverConfig();
    const tuned = applyTuningPreset(base, MPC_TUNING_TUNED_V3);
    expect(tuned.bounds).toEqual(base.bounds);
    expect(tuned.stepMinutes).toBe(15);
    expect(tuned.lambdaComfort).toBe(1.5);
    expect(tuned.lambdaMoveTemporal).toBe(0.008);
  });

  it("inferTuningPresetFromSolver gjenkjenner anlegg_pris_respons_v1", () => {
    const preset = inferTuningPresetFromSolver(MPC_TUNING_DEMAND_OPTIMAL.solver);
    expect(preset?.id).toBe("anlegg_pris_respons_v1");
  });

  it("presetById aksepterer demand_optimal alias", () => {
    expect(presetById("demand_optimal").id).toBe("anlegg_pris_respons_v1");
  });
});

describe("resolveMpcReplaySolverConfig", () => {
  it("bruker anlegg_pris_respons_v1 default uten env", () => {
    const prev = { ...process.env };
    delete process.env.MPC_REPLAY_HORIZON_STEPS;
    delete process.env.MPC_REPLAY_MAX_ITERATIONS;
    delete process.env.MPC_FULL_REPLAY;
    delete process.env.MPC_DEV_HORIZON;
    delete process.env.MPC_LAMBDA_MOVE;
    delete process.env.MPC_LAMBDA_MOVE_TEMPORAL;
    delete process.env.MPC_TUNING_PRESET;

    const config = resolveMpcReplaySolverConfig();
    expect(config.horizonSteps).toBe(
      MPC_TUNING_DEMAND_OPTIMAL.solver.horizonSteps,
    );
    expect(config.maxIterations).toBe(
      MPC_TUNING_DEMAND_OPTIMAL.solver.maxIterations,
    );
    expect(config.learningRate).toBe(
      MPC_TUNING_DEMAND_OPTIMAL.solver.learningRate,
    );
    expect(config.lambdaMove).toBe(MPC_TUNING_DEMAND_OPTIMAL.solver.lambdaMove);
    expect(config.lambdaMoveTemporal).toBe(
      MPC_TUNING_DEMAND_OPTIMAL.solver.lambdaMoveTemporal,
    );

    process.env = prev;
  });

  it("mergeReplaySolverWithCalibration beholder replay-tuning", () => {
    const replay = resolveMpcReplaySolverConfig();
    const stale = { ...replay, lambdaMove: 0.08, lambdaComfort: 4 };
    const merged = resolveMpcReplaySolverConfig(stale);
    expect(merged.lambdaMove).toBe(replay.lambdaMove);
    expect(merged.lambdaComfort).toBe(replay.lambdaComfort);
  });

  it("MPC_LAMBDA_MOVE overstyrer preset", () => {
    const prev = process.env.MPC_LAMBDA_MOVE;
    process.env.MPC_LAMBDA_MOVE = "0.05";
    const config = resolveMpcReplaySolverConfig();
    expect(config.lambdaMove).toBe(0.05);
    if (prev == null) delete process.env.MPC_LAMBDA_MOVE;
    else process.env.MPC_LAMBDA_MOVE = prev;
  });
});
