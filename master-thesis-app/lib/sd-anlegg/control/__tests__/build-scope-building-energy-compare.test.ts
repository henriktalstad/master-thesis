import { describe, expect, test } from "bun:test";
import { buildScopeBuildingEnergyCompare } from "../build-scope-building-energy-compare";
import type { CapacityTariffAnalysis } from "../build-capacity-tariff-analysis";
import type { MpcEnergyReconcileSummary } from "../build-mpc-energy-reconcile";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

function minimalReconcile(
  overrides: Partial<MpcEnergyReconcileSummary> = {},
): MpcEnergyReconcileSummary {
  return {
    evalStart: "2026-06-24T00:00:00.000Z",
    evalEnd: "2026-06-27T00:00:00.000Z",
    hoursAligned: 72,
    measured: {
      electricityKwh: 1000,
      districtHeatingKwh: 500,
      totalCostKr: 2000,
    },
    proxy: {
      observed: { elKwh: 80, heatKwh: 40, costKr: 100 },
      emulated: { elKwh: 75, heatKwh: 38, costKr: 95 },
      mpc: { elKwh: 70, heatKwh: 35, costKr: 90 },
    },
    shares: {
      controllableElectricShare: 7.5,
      controllableHeatShare: 7.6,
      proxyElectricShareOfMeasured: 7.5,
      proxyHeatShareOfMeasured: 7.6,
      proxyHeatShareOfCircuit: null,
      heatGroundTruth: "none",
    },
    deltaMpcVsEmulated: { costKr: -5, costPct: -5.3, elKwh: -5, heatKwh: -3 },
    heatingDemand: {
      activeSteps: 100,
      activeStepPct: 50,
      observed: { totalKwh: 40, batteryKwh: 10, districtKwh: 30 },
      emulated: { totalKwh: 38, batteryKwh: 9, districtKwh: 29 },
      mpc: { totalKwh: 35, batteryKwh: 8, districtKwh: 27 },
      tr003: {
        fromPowerIntegralKwh: 0,
        fromEnergyMeterKwh: 0,
        groundTruthKwh: 0,
        source: "none",
      },
    },
    districtDeltaT: [],
    circuitMeter: null,
    ...overrides,
  };
}

function minimalTariff(): CapacityTariffAnalysis {
  return {
    missingTariffMonths: [],
    tariffSyncedOnMiss: false,
    evalPeakKw: { observed: 1, emulated: 0.8, mpc: 0.7 },
    bhccEvalPeakKw: 3.4,
    bhccEvalPeakDistrictHeatingKw: 12,
    evalPeakDeltaKw: -0.1,
    evalPeakDeltaPct: -12.5,
    monthlyRows: [
      {
        month: "2026-06",
        observedPeakKw: 1,
        emulatedPeakKw: 0.8,
        mpcPeakKw: 0.7,
        observedPeakHour: null,
        emulatedPeakHour: null,
        mpcPeakHour: null,
        capacityLinkKrPerKw: 50,
        bhccElectricityKwh: 1000,
        bhccDistrictHeatingKwh: 500,
        bhccPeakElectricKw: 3.4,
        bhccPeakDistrictHeatingKw: 12,
        capacityCostEmulatedKr: 40,
        capacityCostMpcKr: 35,
        capacityCostDeltaKr: 5,
      },
    ],
    estimatedCapacityCostKr: { emulated: 40, mpc: 35, deltaKr: 5 },
    scopeNote: "test",
  };
}

describe("buildScopeBuildingEnergyCompare", () => {
  test("skiller el og fjernvarme med scope vs bygg", () => {
    const compare = buildScopeBuildingEnergyCompare({
      reconcile: minimalReconcile(),
      capacityTariff: minimalTariff(),
    });

    expect(compare?.rows).toHaveLength(2);
    const el = compare?.rows.find((r) => r.id === "el");
    const heat = compare?.rows.find((r) => r.id === "heat");

    expect(el?.scopeKwh).toBe(75);
    expect(el?.buildingKwh).toBe(1000);
    expect(el?.scopePeakKw).toBe(0.8);
    expect(el?.buildingPeakKw).toBe(3.4);
    expect(el?.sharePct).toBe(7.5);

    expect(heat?.scopeKwh).toBe(38);
    expect(heat?.buildingKwh).toBe(500);
    expect(heat?.buildingPeakKw).toBe(12);
  });

  test("beregner FV scope-topp fra replay-steg", () => {
    const steps: MpcReplayStep[] = [
      {
        t: "2026-06-24T10:00:00.000Z",
        proxyHeatKwhEmulated: 2.5,
      } as MpcReplayStep,
      {
        t: "2026-06-24T10:15:00.000Z",
        proxyHeatKwhEmulated: 5,
      } as MpcReplayStep,
    ];

    const compare = buildScopeBuildingEnergyCompare({
      reconcile: minimalReconcile(),
      capacityTariff: minimalTariff(),
      replaySteps: steps,
    });

    const heat = compare?.rows.find((r) => r.id === "heat");
    expect(heat?.scopePeakKw).toBe(7.5);
  });

  test("time-topp matcher BHCC-konvensjon (ikke 15-min spike)", () => {
    const steps: MpcReplayStep[] = [
      {
        t: "2026-06-24T10:00:00.000Z",
        proxyHeatKwhEmulated: 1,
      } as MpcReplayStep,
      {
        t: "2026-06-24T10:15:00.000Z",
        proxyHeatKwhEmulated: 1,
      } as MpcReplayStep,
      {
        t: "2026-06-24T10:30:00.000Z",
        proxyHeatKwhEmulated: 1,
      } as MpcReplayStep,
      {
        t: "2026-06-24T10:45:00.000Z",
        proxyHeatKwhEmulated: 1,
      } as MpcReplayStep,
    ];

    const compare = buildScopeBuildingEnergyCompare({
      reconcile: minimalReconcile(),
      capacityTariff: minimalTariff(),
      replaySteps: steps,
    });

    const heat = compare?.rows.find((r) => r.id === "heat");
    expect(heat?.scopePeakKw).toBe(4);
  });

  test("returnerer null uten data", () => {
    expect(
      buildScopeBuildingEnergyCompare({
        reconcile: null,
        capacityTariff: null,
      }),
    ).toBeNull();
  });
});
