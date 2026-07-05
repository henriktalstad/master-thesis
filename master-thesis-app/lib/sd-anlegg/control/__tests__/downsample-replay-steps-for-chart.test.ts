import { describe, expect, it } from "bun:test";
import {
  downsampleReplayStepsForChart,
  loopChartDownsampleNote,
  LOOP_CHART_MAX_POINTS,
} from "@/lib/sd-anlegg/control/downsample-replay-steps-for-chart";
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

describe("downsampleReplayStepsForChart", () => {
  it("returnerer uendret serie under maks", () => {
    const steps = denseSteps(96, Date.parse("2026-07-01T00:00:00.000Z"));
    expect(downsampleReplayStepsForChart(steps)).toHaveLength(96);
  });

  it("beholder siste punkt ved downsampling", () => {
    const steps = denseSteps(1200, Date.parse("2026-07-01T00:00:00.000Z"));
    const down = downsampleReplayStepsForChart(steps, LOOP_CHART_MAX_POINTS);
    expect(down.length).toBeLessThanOrEqual(LOOP_CHART_MAX_POINTS + 1);
    expect(down.at(-1)?.t).toBe(steps.at(-1)?.t);
  });
});

describe("loopChartDownsampleNote", () => {
  it("returnerer null når alt vises", () => {
    expect(loopChartDownsampleNote(96, 96)).toBeNull();
  });

  it("forklarer reduksjon", () => {
    const note = loopChartDownsampleNote(400, 1200);
    expect(note).toContain("400");
    expect(note).toContain("200");
  });
});
