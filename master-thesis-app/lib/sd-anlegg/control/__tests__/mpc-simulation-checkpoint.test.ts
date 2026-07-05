import { describe, expect, it } from "bun:test";
import {
  parseMpcSimulationCheckpoint,
  type MpcSimulationCheckpoint,
} from "../mpc-simulation-checkpoint";

const sample: MpcSimulationCheckpoint = {
  version: 1,
  replayIndex: 192,
  inputFingerprint: "fp-abc",
  pipelineRunId: "run-1",
  loopState: {
    tExtObserved: 21,
    tExtMpc: 21.5,
    tExtEmulated: 21.2,
    tExtDemand: 21.3,
    tRecMpc: 18,
    tRecEmulated: 18,
  },
};

describe("parseMpcSimulationCheckpoint", () => {
  it("parser gyldig checkpoint", () => {
    expect(parseMpcSimulationCheckpoint(sample)).toEqual(sample);
  });

  it("default tExtDemand til tExtEmulated i eldre checkpoints", () => {
    const legacy = {
      ...sample,
      loopState: {
        tExtObserved: 21,
        tExtMpc: 21.5,
        tExtEmulated: 21.2,
        tRecMpc: 18,
        tRecEmulated: 18,
      },
    };
    const parsed = parseMpcSimulationCheckpoint(legacy);
    expect(parsed?.loopState.tExtDemand).toBe(21.2);
  });

  it("avviser ugyldig versjon", () => {
    expect(parseMpcSimulationCheckpoint({ ...sample, version: 2 })).toBeNull();
  });

  it("avviser manglende loopState", () => {
    expect(
      parseMpcSimulationCheckpoint({ ...sample, loopState: undefined }),
    ).toBeNull();
  });
});
