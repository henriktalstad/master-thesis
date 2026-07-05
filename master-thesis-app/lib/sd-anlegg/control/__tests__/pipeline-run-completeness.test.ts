import { describe, expect, test } from "bun:test";
import {
  isPipelineRunPersistentlyComplete,
  MIN_THESIS_REPLAY_STEPS,
} from "@/lib/sd-anlegg/control/pipeline-run-completeness-logic";

describe("isPipelineRunPersistentlyComplete", () => {
  test("avviser ufullstendig thesis-run (96/816)", () => {
    expect(
      isPipelineRunPersistentlyComplete({
        expectedStepCount: 816,
        persistedStepCount: 96,
      }),
    ).toBe(false);
  });

  test("godtar full thesis-run (804/804)", () => {
    expect(
      isPipelineRunPersistentlyComplete({
        expectedStepCount: 804,
        persistedStepCount: 804,
      }),
    ).toBe(true);
  });

  test("krever minst MIN_THESIS_REPLAY_STEPS for lange eval", () => {
    expect(
      isPipelineRunPersistentlyComplete({
        expectedStepCount: 804,
        persistedStepCount: MIN_THESIS_REPLAY_STEPS - 1,
      }),
    ).toBe(false);
  });
});
