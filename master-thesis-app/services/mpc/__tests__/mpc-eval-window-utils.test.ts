import { describe, expect, it } from "bun:test";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import { trimEvalEndToMinOptimizablePct } from "@/services/mpc/mpc-eval-window-utils";

const uMeas: MpcControlVector = {
  supplySetpointC: 18,
  supplyFanPct: 40,
  exhaustFanPct: 35,
  heatingValvePct: 10,
  coolingValvePct: 0,
};

function stepAt(index: number, overrides: Partial<MpcTimestep> = {}): MpcTimestep {
  const t = new Date(Date.UTC(2026, 5, 24, 0, index * 15, 0)).toISOString();
  return {
    t,
    tMs: Date.parse(t),
    dowUtc: 0,
    hourUtc: 0,
    quarterUtc: 0,
    hourLocal: 0,
    uMeas,
    supplySetpointOperatorC: 18,
    supplySetpointCalcC: 18,
    extractTempC: 22,
    outdoorTempC: 15,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1.2,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 1,
    buildingDistrictHeatingKwh: 0,
    heatingActive: true,
    coolingActive: false,
    alarmActive: false,
    ...overrides,
  };
}

describe("trimEvalEndToMinOptimizablePct", () => {
  it("klipper påfølgende alarm-hale fra slutten", () => {
    const good = Array.from({ length: 100 }, (_, i) => stepAt(i));
    const bad = Array.from({ length: 6 }, (_, i) =>
      stepAt(100 + i, { alarmActive: true }),
    );
    const steps = [...good, ...bad];
    const evalEnd = new Date(Date.parse(steps[steps.length - 1]!.t) + 15 * 60 * 1000);

    const result = trimEvalEndToMinOptimizablePct({
      evalEnd,
      steps,
      minOptimizablePct: 0.95,
    });

    expect(result.trimmed).toBe(true);
    expect(result.steps.length).toBe(100);
    expect(result.optimizablePct).toBe(1);
  });

  it("lar spredte fallback midt i vinduet stå", () => {
    const steps = [
      ...Array.from({ length: 50 }, (_, i) => stepAt(i)),
      stepAt(50, { alarmActive: true }),
      ...Array.from({ length: 50 }, (_, i) => stepAt(51 + i)),
    ];
    const evalEnd = new Date(Date.parse(steps[steps.length - 1]!.t) + 15 * 60 * 1000);

    const result = trimEvalEndToMinOptimizablePct({
      evalEnd,
      steps,
      minOptimizablePct: 0.95,
    });

    expect(result.trimmed).toBe(false);
    expect(result.steps.length).toBe(101);
  });

  it("lar datasett stå når dekning allerede er tilstrekkelig", () => {
    const steps = Array.from({ length: 100 }, (_, i) => stepAt(i));
    const evalEnd = new Date(Date.parse(steps[steps.length - 1]!.t) + 15 * 60 * 1000);

    const result = trimEvalEndToMinOptimizablePct({
      evalEnd,
      steps,
      minOptimizablePct: 0.95,
    });

    expect(result.trimmed).toBe(false);
    expect(result.steps.length).toBe(100);
  });
});
