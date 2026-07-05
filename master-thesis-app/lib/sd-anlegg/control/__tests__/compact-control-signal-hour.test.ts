import { describe, expect, it } from "bun:test";
import {
  aggregateReplayStepsToControlHours,
  expandControlSignalHourToReplayStep,
} from "@/lib/sd-anlegg/control/compact-control-signal-hour";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function stepAt(iso: string, sp: number): MpcReplayStep {
  return {
    t: iso,
    uBmsMeas: {
      supplySetpointC: sp,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    },
    uBmsSim: {
      supplySetpointC: sp,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    },
    uMpc: {
      supplySetpointC: sp + 0.5,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    },
    costBaselineKr: 0,
    costEmulatedKr: 0,
    costMpcKr: 0,
  } as MpcReplayStep;
}

describe("aggregateReplayStepsToControlHours", () => {
  it("grupperer fire 15-min steg til ett timegjennomsnitt", () => {
    const steps = [
      stepAt("2026-07-01T10:00:00.000Z", 20),
      stepAt("2026-07-01T10:15:00.000Z", 21),
      stepAt("2026-07-01T10:30:00.000Z", 22),
      stepAt("2026-07-01T10:45:00.000Z", 23),
    ];
    const hours = aggregateReplayStepsToControlHours(steps);
    expect(hours).toHaveLength(1);
    expect(hours[0]!.payload.n).toBe(4);
    const replay = expandControlSignalHourToReplayStep(
      hours[0]!.hourAt,
      hours[0]!.payload,
    );
    expect(replay.uBmsMeas?.supplySetpointC).toBe(21.5);
    expect(replay.uMpc.supplySetpointC).toBe(22);
  });
});
