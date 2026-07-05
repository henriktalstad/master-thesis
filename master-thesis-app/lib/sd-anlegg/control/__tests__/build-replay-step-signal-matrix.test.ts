import { describe, expect, it } from "bun:test";
import { buildReplayStepSignalMatrix } from "@/lib/sd-anlegg/control/build-replay-step-signal-matrix";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const u = {
  supplySetpointC: 18.1,
  supplyFanPct: 42,
  exhaustFanPct: 38,
  heatingValvePct: 12,
  coolingValvePct: 0,
};

const step = {
  t: "2026-06-30T12:00:00.000Z",
  supplySetpointOperatorC: 17,
  uBmsMeas: u,
  uBmsSim: { ...u, supplyFanPct: 40 },
  uDemand: { ...u, supplyFanPct: 39 },
  uMpc: { ...u, supplySetpointC: 17.8 },
  supplySetpointCalcC: 18.0,
  extractSetpointC: 22.0,
  supplyTempMeasC: 19.2,
  extractTempMeasC: 23.1,
  outdoorTempBmsC: 14.5,
} as MpcReplayStep;

describe("buildReplayStepSignalMatrix", () => {
  it("mapper kontroll, plant og forstyrrelser fra replay-steg", () => {
    const matrix = buildReplayStepSignalMatrix(step);
    const supplyFan = matrix.find((r) => r.canonicalId === "supply.fan.command");
    expect(supplyFan?.observed).toBe(42);
    expect(supplyFan?.mpc).toBe(42);

    const operator = matrix.find((r) => r.canonicalId === "supply.setpoint");
    expect(operator?.observed).toBe(17);

    const supplyTemp = matrix.find((r) => r.canonicalId === "supply.temp");
    expect(supplyTemp?.observed).toBe(19.2);

    const outdoor = matrix.find((r) => r.canonicalId === "outdoor.temp");
    expect(outdoor?.observed).toBe(14.5);
  });
});
