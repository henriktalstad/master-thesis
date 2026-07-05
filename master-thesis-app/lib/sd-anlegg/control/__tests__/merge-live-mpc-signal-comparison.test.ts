import { describe, expect, test } from "bun:test";
import { buildMpcSignalComparison } from "@/lib/sd-anlegg/control/build-mpc-signal-comparison";
import { mergeLiveMpcSignalComparison } from "@/lib/sd-anlegg/control/merge-live-mpc-signal-comparison";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function replayStep(t: string, sp: number): MpcReplayStep {
  const vector = {
    supplySetpointC: sp,
    supplyFanPct: 40,
    exhaustFanPct: 38,
    heatingValvePct: 10,
    coolingValvePct: 0,
  };
  return {
    t,
    uBmsMeas: vector,
    uBmsSim: { ...vector, supplySetpointC: sp - 0.5 },
    uMpc: { ...vector, supplySetpointC: sp - 1 },
    deltaU: vector,
    electricKw: 2,
    heatKw: 1,
    costBaselineKr: 1,
    costEmulatedKr: 1,
    costMpcKr: 0.8,
    comfortViolation: false,
    usedFallback: false,
  };
}

describe("mergeLiveMpcSignalComparison", () => {
  test("bygger live snapshot når Influx og replay matcher steg", () => {
    const stepAt = "2026-06-28T10:00:00.000Z";
    const comparison = buildMpcSignalComparison([replayStep(stepAt, 18)]);
    const livePoints: InfraspawnPointListItem[] = [
      {
        objectId: "sp-op",
        objectName: "SupplySetpoint",
        sourceId: "s1",
        unit: "degrees-celsius",
        lastValue: 17.2,
        lastSampledAt: stepAt,
      } as InfraspawnPointListItem,
      {
        objectId: "sp-calc",
        objectName: "SupplyPID_SetP",
        sourceId: "s1",
        unit: "degrees-celsius",
        lastValue: 18.4,
        lastSampledAt: stepAt,
      } as InfraspawnPointListItem,
    ];

    const { liveSnapshot, comparison: merged } = mergeLiveMpcSignalComparison({
      comparison,
      livePoints,
      liveSampledAt: stepAt,
      replaySteps: [replayStep(stepAt, 18)],
    });

    expect(liveSnapshot?.isLive).toBe(true);
    expect(liveSnapshot?.observed.supplySetpointOperatorC).toBe(17.2);
    expect(liveSnapshot?.observed.supplySetpointC).toBe(18.4);

    const operatorSeries = merged.series.find((s) => s.id === "supply_setpoint_operator");
    const livePoint = operatorSeries?.points.find((p) => p.hour === "2026-06-28T10:00:00Z");
    expect(livePoint?.observed).toBe(17.2);
    expect(livePoint?.reference).toBe(18.4);
    expect(liveSnapshot?.typicalBms?.supplySetpointC).toBe(17.5);
    expect(liveSnapshot?.mpc?.supplySetpointC).toBe(17);
  });

  test("prioriterer forward plan steg 0 over eval-replay for live snapshot", () => {
    const stepAt = "2026-06-30T13:00:00.000Z";
    const comparison = buildMpcSignalComparison([replayStep(stepAt, 18)]);
    const livePoints: InfraspawnPointListItem[] = [
      {
        objectId: "sp",
        objectName: "SupplySetpoint",
        sourceId: "s1",
        unit: "degrees-celsius",
        lastValue: 17,
        lastSampledAt: stepAt,
      } as InfraspawnPointListItem,
    ];

    const { liveSnapshot } = mergeLiveMpcSignalComparison({
      comparison,
      livePoints,
      liveSampledAt: stepAt,
      replaySteps: [replayStep(stepAt, 21)],
      liveControl: {
        forwardPlanStep0: {
          t: stepAt,
          spotKrPerKwh: 1,
          effectiveMarginalKrPerKwh: 1.2,
          outdoorTempC: 15,
          uBmsSim: {
            supplySetpointC: 19.5,
            supplyFanPct: 55,
            exhaustFanPct: 50,
            heatingValvePct: 12,
            coolingValvePct: 0,
          },
          uMpc: {
            supplySetpointC: 19,
            supplyFanPct: 52,
            exhaustFanPct: 48,
            heatingValvePct: 10,
            coolingValvePct: 0,
          },
          predictedExtractC: 21,
          expectedDeltaCostKr: -0.12,
        },
        activeCommand: {
          supplySetpointC: 18.8,
          supplyFanPct: 51,
          exhaustFanPct: 47,
          heatingValvePct: 9,
          coolingValvePct: 0,
        },
      },
    });

    expect(liveSnapshot?.typicalBms?.supplySetpointC).toBe(19.5);
    expect(liveSnapshot?.mpc?.supplySetpointC).toBe(18.8);
    expect(liveSnapshot?.deltaCostKr).toBe(-0.12);
  });

  test("flagger avvik når operatør-SP avviker fra simulert", () => {
    const stepAt = "2026-07-03T13:00:00.000Z";
    const comparison = buildMpcSignalComparison([replayStep(stepAt, 20.7)]);
    const livePoints: InfraspawnPointListItem[] = [
      {
        objectId: "sp-op",
        objectName: "SupplySetpoint",
        sourceId: "s1",
        unit: "degrees-celsius",
        lastValue: 17,
        lastSampledAt: stepAt,
      } as InfraspawnPointListItem,
      {
        objectId: "sp-calc",
        objectName: "SupplyPID_SetP",
        sourceId: "s1",
        unit: "degrees-celsius",
        lastValue: 20.7,
        lastSampledAt: stepAt,
      } as InfraspawnPointListItem,
    ];

    const { liveSnapshot } = mergeLiveMpcSignalComparison({
      comparison,
      livePoints,
      liveSampledAt: stepAt,
      replaySteps: [replayStep(stepAt, 20.7)],
    });

    expect(liveSnapshot?.hasMpcDeviation).toBe(true);
    expect(liveSnapshot?.observed.supplySetpointOperatorC).toBe(17);
    expect(liveSnapshot?.mpc?.supplySetpointC).toBe(19.7);
  });
});
