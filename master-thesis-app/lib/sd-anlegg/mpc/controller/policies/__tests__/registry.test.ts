import { describe, expect, it } from "bun:test";
import { getAllControlPolicies, getControlPolicy } from "../registry";
import { computeDemandControlFromTimestep } from "../demand-from-timestep";
import type { PolicyStepContext } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcControlVector, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

const baseU: MpcControlVector = {
  supplySetpointC: 18,
  supplyFanPct: 40,
  exhaustFanPct: 38,
  heatingValvePct: 10,
  coolingValvePct: 5,
  districtTr002ValvePct: 0,
  districtTr003ValvePct: 35,
};

function makeStep(overrides: Partial<MpcTimestep> = {}): MpcTimestep {
  return {
    t: "2026-06-25T10:00:00.000Z",
    tMs: Date.parse("2026-06-25T10:00:00.000Z"),
    dowUtc: 3,
    hourUtc: 10,
    quarterUtc: 0,
    hourLocal: 12,
    uMeas: baseU,
    supplySetpointOperatorC: 18,
    supplySetpointCalcC: 19,
    extractTempC: 22,
    outdoorTempC: 15,
    spotKrPerKwh: 1.2,
    effectiveMarginalKrPerKwh: 1.5,
    heatKrPerKwh: 0.8,
    buildingElectricityKwh: 2,
    buildingDistrictHeatingKwh: 1,
    heatingActive: false,
    coolingActive: true,
    ...overrides,
  };
}

function makeCtx(step: MpcTimestep): PolicyStepContext {
  return {
    step,
    stepIndex: 0,
    steps: [step],
    calibration: {} as PolicyStepContext["calibration"],
    tExtState: 22,
    uBmsSim: baseU,
    priceThresholds: { high: 2, low: 0.5 },
    canOptimize: true,
  };
}

describe("policy registry", () => {
  it("registrerer fire policies", () => {
    expect(getAllControlPolicies()).toHaveLength(4);
    expect(getControlPolicy("demand-scoped").claimLevel).toBe("simulated");
  });

  it("observed returnerer uMeas", () => {
    const result = getControlPolicy("observed").computeControl(makeCtx(makeStep()));
    expect(result.u?.supplySetpointC).toBe(18);
    expect(result.skipped).toBe(false);
  });

  it("mpc-v1 bruker uMpc når satt", () => {
    const ctx = makeCtx(makeStep());
    ctx.uMpc = { ...baseU, supplyFanPct: 25 };
    const result = getControlPolicy("mpc-v1").computeControl(ctx);
    expect(result.u?.supplyFanPct).toBe(25);
  });
});

describe("demand-from-timestep", () => {
  it("justerer vifter ved høy pris på dagtid", () => {
    const step = makeStep({
      effectiveMarginalKrPerKwh: 3,
      hourLocal: 14,
    });
    const result = computeDemandControlFromTimestep(makeCtx(step));
    expect(result.u).not.toBeNull();
    expect(result.u!.supplyFanPct).toBeLessThanOrEqual(baseU.supplyFanPct);
  });

  it("bevarer fjernvarmeventiler fra emulert baseline", () => {
    const step = makeStep({ hourLocal: 12, effectiveMarginalKrPerKwh: 1 });
    const result = computeDemandControlFromTimestep(makeCtx(step));
    expect(result.u).not.toBeNull();
    expect(result.u!.districtTr003ValvePct).toBe(baseU.districtTr003ValvePct);
  });

  it("trimmer vifter mer på dyr dagtime enn nøytral pris", () => {
    const neutral = computeDemandControlFromTimestep(
      makeCtx(makeStep({ effectiveMarginalKrPerKwh: 1.1, hourLocal: 14 })),
    );
    const expensive = computeDemandControlFromTimestep(
      makeCtx(
        makeStep({
          effectiveMarginalKrPerKwh: 2.5,
          hourLocal: 14,
          spotKrPerKwh: 2,
        }),
      ),
    );
    expect(expensive.u).not.toBeNull();
    expect(neutral.u).not.toBeNull();
    expect(expensive.u!.supplyFanPct).toBeLessThanOrEqual(
      neutral.u!.supplyFanPct,
    );
  });
});
