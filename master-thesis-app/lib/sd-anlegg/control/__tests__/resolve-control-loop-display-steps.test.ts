import { describe, expect, it } from "bun:test";
import {
  controlLoopStepDensity,
  resolveControlLoopDisplaySteps,
  trimControlLoopStepsToContinuousTail,
  trimLeadingGapOnly,
} from "@/lib/sd-anlegg/control/resolve-control-loop-display-steps";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function stepAt(iso: string): MpcReplayStep {
  return {
    t: iso,
    uBmsSim: {},
    uMpc: {},
  } as MpcReplayStep;
}

function denseSteps(count: number, startMs: number): MpcReplayStep[] {
  return Array.from({ length: count }, (_, i) =>
    stepAt(new Date(startMs + i * 15 * 60_000).toISOString()),
  );
}

describe("controlLoopStepDensity", () => {
  it("returnerer 0 for tom liste", () => {
    expect(controlLoopStepDensity([])).toBe(0);
  });

  it("returnerer ~1 for kontinuerlig 15-min rekke", () => {
    const steps = denseSteps(96, Date.parse("2026-07-01T00:00:00.000Z"));
    expect(controlLoopStepDensity(steps)).toBeCloseTo(1, 1);
  });

  it("returnerer lav verdi for spredte steg", () => {
    const sparse = [
      stepAt("2026-06-30T13:00:00.000Z"),
      stepAt("2026-07-01T18:15:00.000Z"),
      stepAt("2026-07-02T16:00:00.000Z"),
    ];
    expect(controlLoopStepDensity(sparse)).toBeLessThan(0.1);
  });
});

describe("resolveControlLoopDisplaySteps", () => {
  it("velger eval-replay når live er for spredt", () => {
    const live = denseSteps(20, Date.parse("2026-06-30T13:00:00.000Z"));
    const evalTail = denseSteps(96, Date.parse("2026-07-02T00:00:00.000Z"));
    const resolved = resolveControlLoopDisplaySteps(live, evalTail);
    expect(resolved.source).toBe("eval-replay");
    expect(resolved.steps).toHaveLength(96);
  });

  it("beholder live når dekningen er god", () => {
    const live = denseSteps(96, Date.parse("2026-07-02T00:00:00.000Z"));
    const evalTail = denseSteps(48, Date.parse("2026-07-01T00:00:00.000Z"));
    const resolved = resolveControlLoopDisplaySteps(live, evalTail);
    expect(resolved.source).toBe("live-replay");
    expect(resolved.steps).toHaveLength(96);
  });

  it("eval-modus bruker pipeline-replay uten live-forklaring", () => {
    const live = denseSteps(13, Date.parse("2026-07-04T07:00:00.000Z"));
    const evalReplay = denseSteps(999, Date.parse("2025-06-18T00:00:00.000Z"));
    const resolved = resolveControlLoopDisplaySteps(live, evalReplay, 15, {
      periodMode: "eval",
    });
    expect(resolved.source).toBe("eval-replay");
    expect(resolved.steps).toHaveLength(999);
  });
});

describe("trimLeadingGapOnly", () => {
  it("dropper kun ledende orphan-blokk før første store hull", () => {
    const prefix = denseSteps(20, Date.parse("2026-06-20T00:00:00.000Z"));
    const middle = denseSteps(48, Date.parse("2026-06-24T18:00:00.000Z"));
    const tail = denseSteps(2, Date.parse("2026-07-04T07:00:00.000Z"));
    const combined = [...prefix, ...middle, ...tail];
    const trimmed = trimLeadingGapOnly(combined, 15);
    expect(trimmed).toHaveLength(50);
    expect(trimmed[0]!.t).toBe(middle[0]!.t);
    expect(trimmed.at(-1)!.t).toBe(tail.at(-1)!.t);
  });

  it("beholder tett serie uten hull", () => {
    const steps = denseSteps(96, Date.parse("2026-07-01T00:00:00.000Z"));
    expect(trimLeadingGapOnly(steps, 15)).toHaveLength(96);
  });
});

describe("trimControlLoopStepsToContinuousTail", () => {
  it("beholder kun hale etter siste store hull", () => {
    const prefix = denseSteps(20, Date.parse("2026-06-20T00:00:00.000Z"));
    const suffix = denseSteps(48, Date.parse("2026-06-24T18:00:00.000Z"));
    const combined = [...prefix, ...suffix];
    const trimmed = trimControlLoopStepsToContinuousTail(combined, 15);
    expect(trimmed).toHaveLength(48);
    expect(trimmed[0]!.t).toBe(suffix[0]!.t);
    expect(trimmed.at(-1)!.t).toBe(suffix.at(-1)!.t);
  });

  it("beholder tett serie uten hull", () => {
    const steps = denseSteps(96, Date.parse("2026-07-01T00:00:00.000Z"));
    expect(trimControlLoopStepsToContinuousTail(steps, 15)).toHaveLength(96);
  });
});
