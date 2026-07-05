import { describe, expect, it } from "bun:test";
import {
  MPC_SIMULATION_RECENT_JOB_MS,
  MPC_SIMULATION_STALE_MAX_RUNTIME_MS,
  MPC_SIMULATION_STALE_NO_PROGRESS_MS,
} from "../control-constants";

function isSimulationJobStale(input: {
  stepIndex: number;
  startedAtMs: number;
  nowMs: number;
}): boolean {
  const ageMs = input.nowMs - input.startedAtMs;
  if (input.stepIndex <= 0 && ageMs >= MPC_SIMULATION_STALE_NO_PROGRESS_MS) {
    return true;
  }
  return ageMs >= MPC_SIMULATION_STALE_MAX_RUNTIME_MS;
}

describe("mpc simulation stale detection", () => {
  it("marks zero-progress jobs stale after no-progress timeout", () => {
    const startedAtMs = Date.now() - MPC_SIMULATION_STALE_NO_PROGRESS_MS - 1;
    expect(
      isSimulationJobStale({
        stepIndex: 0,
        startedAtMs,
        nowMs: Date.now(),
      }),
    ).toBe(true);
  });

  it("keeps fresh running jobs", () => {
    expect(
      isSimulationJobStale({
        stepIndex: 12,
        startedAtMs: Date.now() - 5 * 60_000,
        nowMs: Date.now(),
      }),
    ).toBe(false);
  });

  it("uses recent job display window constant", () => {
    expect(MPC_SIMULATION_RECENT_JOB_MS).toBe(3 * 60_000);
  });
});
