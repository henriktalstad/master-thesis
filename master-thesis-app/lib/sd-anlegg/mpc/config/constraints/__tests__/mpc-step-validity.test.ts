import { describe, expect, it } from "bun:test";
import {
  assessMpcStepValidity,
  countOptimizableSteps,
  recordFallbackReason,
  emptyFallbackByReason,
} from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function baseStep(overrides: Partial<MpcTimestep> = {}): MpcTimestep {
  return {
    t: "2026-06-24T10:00:00.000Z",
    tMs: Date.parse("2026-06-24T10:00:00.000Z"),
    dowUtc: 3,
    hourUtc: 10,
    quarterUtc: 0,
    hourLocal: 10,
    uMeas: {
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 30,
      heatingValvePct: 10,
      coolingValvePct: 0,
    },
    supplySetpointOperatorC: null,
    supplySetpointCalcC: null,
    extractTempC: 20,
    outdoorTempC: 15,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1.2,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 1,
    buildingDistrictHeatingKwh: 0.5,
    heatingActive: true,
    coolingActive: false,
    ...overrides,
  };
}

describe("assessMpcStepValidity", () => {
  it("tillater optimizer når uMeas finnes og modus er gyldig", () => {
    const result = assessMpcStepValidity(baseStep());
    expect(result.canOptimize).toBe(true);
    expect(result.fallbackReason).toBeNull();
  });

  it("fallback ved manglende uMeas", () => {
    const result = assessMpcStepValidity(baseStep({ uMeas: null }));
    expect(result.canOptimize).toBe(false);
    expect(result.fallbackReason).toBe("missing_u_meas");
  });

  it("fallback ved samtidig varme og kjøling", () => {
    const result = assessMpcStepValidity(
      baseStep({ heatingActive: true, coolingActive: true }),
    );
    expect(result.canOptimize).toBe(false);
    expect(result.fallbackReason).toBe("simultaneous_heat_cool");
  });

  it("fallback ved aktiv alarm", () => {
    const result = assessMpcStepValidity(baseStep({ alarmActive: true }));
    expect(result.canOptimize).toBe(false);
    expect(result.fallbackReason).toBe("alarm");
  });

  it("fallback ved pumpealarm kun når varme/kjøling faktisk aktiv", () => {
    const idleHeating = assessMpcStepValidity(
      baseStep({
        pumpHeatingMalfunctionActive: true,
        heatingActive: false,
        uMeas: {
          supplySetpointC: 16,
          supplyFanPct: 0,
          exhaustFanPct: 0,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
      }),
    );
    expect(idleHeating.canOptimize).toBe(true);

    const activeHeating = assessMpcStepValidity(
      baseStep({ pumpHeatingMalfunctionActive: true, heatingActive: true }),
    );
    expect(activeHeating.canOptimize).toBe(false);
    expect(activeHeating.fallbackReason).toBe("pump_fault");

    const activeCooling = assessMpcStepValidity(
      baseStep({
        pumpCoolingMalfunctionActive: true,
        coolingActive: true,
        heatingActive: false,
      }),
    );
    expect(activeCooling.canOptimize).toBe(false);
    expect(activeCooling.fallbackReason).toBe("pump_fault");
  });
});

describe("countOptimizableSteps", () => {
  it("teller optimizable andel", () => {
    const steps = [
      baseStep(),
      baseStep({ uMeas: null }),
      baseStep({ heatingActive: true, coolingActive: true }),
    ];
    const { optimizableSteps, optimizablePct } = countOptimizableSteps(steps);
    expect(optimizableSteps).toBe(1);
    expect(optimizablePct).toBeCloseTo(1 / 3);
  });
});

describe("recordFallbackReason", () => {
  it("akkumulerer per årsak", () => {
    const counts = emptyFallbackByReason();
    recordFallbackReason(counts, "missing_u_meas");
    recordFallbackReason(counts, "alarm");
    recordFallbackReason(counts, "pump_fault");
    expect(counts.missing_u_meas).toBe(1);
    expect(counts.alarm).toBe(1);
    expect(counts.pump_fault).toBe(1);
  });
});
