import { describe, expect, it } from "bun:test";
import { controlVector } from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import { isIncompleteReconcileSummary } from "@/lib/sd-anlegg/control/energy-reconcile-summary-utils";
import { summarizeMpcReplaySteps } from "@/lib/sd-anlegg/control/summarize-mpc-replay-steps";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function replayStep(overrides: Partial<MpcReplayStep> = {}): MpcReplayStep {
  return {
    t: "2026-06-24T10:00:00.000Z",
    uBmsMeas: controlVector({
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 30,
      heatingValvePct: 10,
      coolingValvePct: 0,
    }),
    uBmsSim: controlVector({
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 30,
      heatingValvePct: 10,
      coolingValvePct: 0,
    }),
    uMpc: controlVector({
      supplySetpointC: 18,
      supplyFanPct: 28,
      exhaustFanPct: 28,
      heatingValvePct: 10,
      coolingValvePct: 0,
    }),
    uDemand: controlVector({
      supplySetpointC: 18,
      supplyFanPct: 30,
      exhaustFanPct: 30,
      heatingValvePct: 10,
      coolingValvePct: 0,
    }),
    deltaU: controlVector({
      supplySetpointC: 0,
      supplyFanPct: -2,
      exhaustFanPct: -2,
      heatingValvePct: 0,
      coolingValvePct: 0,
    }),
    costBaselineKr: 1,
    costEmulatedKr: 1,
    costMpcKr: 0.9,
    costDemandKr: 1,
    usedFallback: false,
    comfortViolation: false,
    ...overrides,
  } as MpcReplayStep;
}

describe("isIncompleteReconcileSummary", () => {
  it("gjenkjenner scalar-stub uten time-alignment", () => {
    expect(
      isIncompleteReconcileSummary({
        evalStart: "2026-06-24T00:00:00.000Z",
        evalEnd: "2026-07-02T15:00:00.000Z",
        hoursAligned: 0,
        measured: {
          electricityKwh: 252,
          districtHeatingKwh: 474,
          totalCostKr: 774,
          hours: 0,
        },
        proxy: {
          observed: { elKwh: 0, heatKwh: 0, costKr: 0 },
          emulated: { elKwh: 44, heatKwh: 715, costKr: 561 },
          mpc: { elKwh: 39, heatKwh: 693, costKr: 547 },
        },
        shares: {
          controllableElectricShare: 0.4,
          controllableHeatShare: 0.2,
          proxyElectricShareOfMeasured: null,
          proxyHeatShareOfMeasured: null,
          proxyHeatShareOfCircuit: null,
          heatGroundTruth: "none",
        },
        deltaMpcVsEmulated: { costKr: -14, costPct: -2.5, elKwh: 0, heatKwh: 0 },
        heatingDemand: {
          activeSteps: 0,
          activeStepPct: 0,
          observed: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
          emulated: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
          mpc: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
          demand: { totalKwh: 0, batteryKwh: 0, districtKwh: 0 },
          tr003: {
            fromPowerIntegralKwh: 0,
            fromEnergyMeterKwh: 0,
            groundTruthKwh: 0,
            source: "none",
          },
        },
        districtDeltaT: [],
      }),
    ).toBe(true);
  });
});

describe("summarizeMpcReplaySteps fallbackReason", () => {
  it("bevarer pump_fault i stedet for å defaulte til missing_u_meas", () => {
    const summary = summarizeMpcReplaySteps([
      replayStep(),
      replayStep({
        usedFallback: true,
        fallbackReason: "pump_fault",
        pumpHeatingMalfunctionActive: true,
      }),
    ]);
    expect(summary?.fallbackByReason.pump_fault).toBe(1);
    expect(summary?.fallbackByReason.missing_u_meas).toBe(0);
  });
});
