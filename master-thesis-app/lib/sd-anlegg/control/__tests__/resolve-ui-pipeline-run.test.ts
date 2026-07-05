import { describe, expect, test } from "bun:test";
import { shouldKeepFailedSimulationVisible } from "../resolve-ui-pipeline-run";

function checkpoint(replayIndex: number) {
  return {
    version: 1 as const,
    replayIndex,
    inputFingerprint: "fp",
    pipelineRunId: "run-1",
    loopState: {
      tExtObserved: 22,
      tExtMpc: 22,
      tExtEmulated: 22,
      tRecMpc: null,
      tRecEmulated: null,
    },
  };
}

describe("shouldKeepFailedSimulationVisible", () => {
  test("viser feilet sim med delvis replay", () => {
    expect(
      shouldKeepFailedSimulationVisible({
        status: "FAILED",
        checkpoint: checkpoint(40),
        stepIndex: 40,
        stepTotal: 804,
      }),
    ).toBe(true);
  });

  test("skjuler feilet sim uten fremdrift", () => {
    expect(
      shouldKeepFailedSimulationVisible({
        status: "FAILED",
        checkpoint: checkpoint(0),
        stepIndex: 0,
        stepTotal: 804,
      }),
    ).toBe(false);
  });

  test("skjuler når status ikke er FAILED", () => {
    expect(
      shouldKeepFailedSimulationVisible({
        status: "COMPLETED",
        checkpoint: checkpoint(804),
        stepIndex: 804,
        stepTotal: 804,
      }),
    ).toBe(false);
  });
});
