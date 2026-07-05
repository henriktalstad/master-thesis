import { describe, expect, it } from "bun:test";
import {
  aggregateSdProfilesToBuckets,
  patchSdObservedOntoReplaySteps,
} from "@/lib/sd-anlegg/control/merge-fine-sd-with-replay-steps";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function replayStepAt(iso: string, observed?: number): MpcReplayStep {
  return {
    t: iso,
    uBmsSim: { supplySetpointC: 20 },
    uMpc: { supplySetpointC: 19 },
    uBmsMeas: observed != null ? { supplySetpointC: observed } : undefined,
    supplySetpointOperatorC: observed,
  } as MpcReplayStep;
}

describe("aggregateSdProfilesToBuckets", () => {
  it("gjennomsnittlig aggregerer 5-min til time", () => {
    const hourly = aggregateSdProfilesToBuckets(
      [
        { hour: "2026-07-03T12:00:00.000Z", supplySetpointC: 18 },
        { hour: "2026-07-03T12:05:00.000Z", supplySetpointC: 20 },
        { hour: "2026-07-03T12:10:00.000Z", supplySetpointC: 22 },
        { hour: "2026-07-03T12:15:00.000Z", supplySetpointC: 24 },
      ],
      60,
    );
    expect(hourly).toHaveLength(1);
    expect(hourly[0]?.hour.startsWith("2026-07-03T12:00:00")).toBe(true);
    expect(hourly[0]?.supplySetpointC).toBe(21);
  });
});

describe("patchSdObservedOntoReplaySteps", () => {
  it("oppdaterer observert på eksisterende steg", () => {
    const steps = [replayStepAt("2026-07-03T12:00:00Z", 17)];
    const patched = patchSdObservedOntoReplaySteps({
      replaySteps: steps,
      sdProfiles: [
        { hour: "2026-07-03T12:10:00Z", supplySetpointC: 20.7 },
        { hour: "2026-07-03T12:20:00Z", supplySetpointC: 20.8 },
      ],
      bucketMinutes: 60,
    });
    expect(patched[0]?.supplySetpointOperatorC).toBe(20.8);
    expect(patched[0]?.uBmsMeas?.supplySetpointC).toBe(20.8);
  });

  it("utvider hale med SD-only timer etter replay", () => {
    const steps = [replayStepAt("2026-07-02T17:00:00.000Z", 18)];
    const patched = patchSdObservedOntoReplaySteps({
      replaySteps: steps,
      sdProfiles: [
        { hour: "2026-07-03T12:00:00.000Z", supplySetpointC: 20.7 },
        { hour: "2026-07-03T13:00:00.000Z", supplySetpointC: 20.8 },
      ],
      bucketMinutes: 60,
      extendTail: true,
    });
    expect(patched).toHaveLength(3);
    expect(patched.at(-1)?.t.startsWith("2026-07-03T13:00:00")).toBe(true);
    expect(patched.at(-1)?.supplySetpointOperatorC).toBe(20.8);
  });
});
