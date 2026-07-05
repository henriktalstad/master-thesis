import { describe, expect, test } from "bun:test";
import { buildMpcEnergyReconcile } from "@/lib/sd-anlegg/control/build-mpc-energy-reconcile";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

const power = {
  version: "power-v2",
  controllableElectricShare: 0.1,
  controllableHeatShare: 0.2,
  betaFan: 0.5,
  betaHeat: 0.47,
  betaCool: 0.28,
};

function step(t: string, costBase: number, costMpc: number): MpcReplayStep {
  const vector = {
    supplySetpointC: 18,
    supplyFanPct: 40,
    exhaustFanPct: 38,
    heatingValvePct: 10,
    coolingValvePct: 0,
    districtTr002ValvePct: 0,
    districtTr003ValvePct: 0,
  };
  return {
    t,
    uBmsMeas: vector,
    uBmsSim: vector,
    uMpc: { ...vector, supplyFanPct: 35 },
    deltaU: vector,
    extractTempMeasC: 22,
    extractTempPredC: 22,
    outdoorTempC: 10,
    electricKw: 0.5,
    heatKw: 0.2,
    marginalKrPerKwh: 1.2,
    costBaselineKr: costBase,
    costEmulatedKr: costBase,
    costMpcKr: costMpc,
    comfortViolation: false,
    usedFallback: false,
  };
}

describe("buildMpcEnergyReconcile", () => {
  test("kobler BHCC og proxy per time", () => {
    const { summary, hours } = buildMpcEnergyReconcile({
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-06-25T00:00:00.000Z",
      steps: [
        step("2026-06-24T10:00:00.000Z", 1, 0.8),
        step("2026-06-24T10:15:00.000Z", 1, 0.7),
      ],
      calibration: { power } as import("@/lib/sd-anlegg/mpc/shared/types").MpcCalibrationBundle,
      bhccRows: [
        {
          hour: new Date("2026-06-24T10:00:00.000Z"),
          electricityVolumeKwh: 50,
          districtHeatingVolumeKwh: 30,
          electricityTotalCost: 40,
          districtHeatingTotalCost: 20,
        },
      ],
    });

    expect(hours.length).toBeGreaterThan(0);
    expect(summary.measured.electricityKwh).toBe(50);
    expect(summary.measured.districtHeatingKwh).toBe(30);
    expect(summary.proxy.emulated.elKwh).toBeLessThan(summary.measured.electricityKwh);
    expect(summary.deltaMpcVsEmulated.costKr).toBeLessThan(0);
    expect(summary.heatingDemand.observed.totalKwh).toBeGreaterThanOrEqual(0);
    expect(summary.heatingDemand.activeStepPct).toBeGreaterThanOrEqual(0);
  });

  test("bruker lagret proxy kWh når tilgjengelig", () => {
    const { summary } = buildMpcEnergyReconcile({
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-06-25T00:00:00.000Z",
      steps: [
        {
          ...step("2026-06-24T10:00:00.000Z", 1, 0.8),
          proxyElKwhEmulated: 1.2,
          proxyHeatKwhEmulated: 0.4,
          proxyElKwhMpc: 1.0,
          proxyHeatKwhMpc: 0.35,
        },
      ],
      calibration: { power } as import("@/lib/sd-anlegg/mpc/shared/types").MpcCalibrationBundle,
      bhccRows: [
        {
          hour: new Date("2026-06-24T10:00:00.000Z"),
          electricityVolumeKwh: 100,
          districtHeatingVolumeKwh: 60,
          electricityTotalCost: 80,
          districtHeatingTotalCost: 40,
        },
      ],
    });

    expect(summary.proxy.emulated.elKwh).toBe(1.2);
    expect(summary.proxy.mpc.heatKwh).toBe(0.35);
  });

  test("beregner OE001 TR003 mot BHCC når energiteller finnes", () => {
    const vector = {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
    };
    const { summary } = buildMpcEnergyReconcile({
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-06-25T00:00:00.000Z",
      steps: [
        {
          ...step("2026-06-24T10:00:00.000Z", 1, 0.8),
          uBmsMeas: vector,
          districtMeterTr003EnergyKwh: 1000,
        },
        {
          ...step("2026-06-24T10:45:00.000Z", 1, 0.8),
          uBmsMeas: vector,
          districtMeterTr003EnergyKwh: 1007.5,
        },
      ],
      calibration: { power } as import("@/lib/sd-anlegg/mpc/shared/types").MpcCalibrationBundle,
      bhccRows: [
        {
          hour: new Date("2026-06-24T10:00:00.000Z"),
          electricityVolumeKwh: 50,
          districtHeatingVolumeKwh: 8,
          electricityTotalCost: 40,
          districtHeatingTotalCost: 20,
        },
      ],
    });

    expect(summary.circuitMeter?.tr003EnergyKwh).toBe(7.5);
    expect(summary.circuitMeter?.bhccDistrictHeatingKwh).toBe(8);
    expect(summary.circuitMeter?.gapPct).toBe(-6.25);
    expect(summary.shares.heatGroundTruth).toBe("tr003_energy_meter");
    expect(summary.shares.proxyHeatShareOfCircuit).not.toBeNull();
  });

  test("beregner ΔT tur/retur per krets og gap mot måler", () => {
    const { summary } = buildMpcEnergyReconcile({
      evalStart: "2026-06-24T00:00:00.000Z",
      evalEnd: "2026-06-25T00:00:00.000Z",
      steps: [
        {
          ...step("2026-06-24T10:00:00.000Z", 1, 0.8),
          districtTr003SupplyTempC: 70,
          districtTr003ReturnTempC: 40,
          districtMeterTr003SupplyTempC: 70,
          districtMeterTr003ReturnTempC: 45,
        },
        {
          ...step("2026-06-24T10:15:00.000Z", 1, 0.8),
          districtTr003SupplyTempC: 72,
          districtTr003ReturnTempC: 42,
          districtMeterTr003SupplyTempC: 72,
          districtMeterTr003ReturnTempC: 47,
        },
      ],
      calibration: { power } as import("@/lib/sd-anlegg/mpc/shared/types").MpcCalibrationBundle,
      bhccRows: [],
    });

    const tr003 = summary.districtDeltaT.find((c) => c.circuit === "tr003");
    expect(tr003?.bmsAvgDeltaTC).toBe(30);
    expect(tr003?.meterAvgDeltaTC).toBe(25);
    expect(tr003?.gapC).toBe(-5);

    const tr002 = summary.districtDeltaT.find((c) => c.circuit === "tr002");
    expect(tr002?.bmsAvgDeltaTC).toBeNull();
  });
});
