import { describe, expect, it } from "bun:test";
import { fitPowerProxyParams } from "@/lib/sd-anlegg/envelope-model";
import { fitPlantModel } from "@/lib/sd-anlegg/envelope-model";
import { fitBaselineEmulator } from "@/lib/sd-anlegg/envelope-model";
import { DEFAULT_MPC_BOUNDS } from "@/lib/sd-anlegg/mpc/config/mpc-config";
import { solveMpcHorizon } from "../solve-horizon";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

function baseStep(partial: Partial<MpcTimestep>): MpcTimestep {
  return {
    t: partial.t ?? "2026-06-20T08:00:00.000Z",
    tMs: Date.parse(partial.t ?? "2026-06-20T08:00:00.000Z"),
    dowUtc: 5,
    hourUtc: 8,
    quarterUtc: 0,
    hourLocal: 10,
    supplySetpointOperatorC: 18,
    supplySetpointCalcC: 18,
    extractTempC: 22,
    outdoorTempC: 12,
    spotKrPerKwh: 1,
    effectiveMarginalKrPerKwh: 1,
    heatKrPerKwh: 0.5,
    buildingElectricityKwh: 2,
    buildingDistrictHeatingKwh: 0.5,
    heatingActive: true,
    coolingActive: false,
    uMeas: {
      supplySetpointC: 20,
      supplyFanPct: 55,
      exhaustFanPct: 55,
      heatingValvePct: 40,
      coolingValvePct: 0,
    },
    ...partial,
  };
}

describe("solveMpcHorizon", () => {
  it(
    "reduserer planlagt kost vs emulert BMS når pris varierer i horisonten",
    () => {
      const train = Array.from({ length: 36 }, (_, i) =>
        baseStep({
          t: new Date(Date.parse("2026-06-20T06:00:00.000Z") + i * 15 * 60_000).toISOString(),
          tMs: Date.parse("2026-06-20T06:00:00.000Z") + i * 15 * 60_000,
          hourUtc: 6 + Math.floor(i / 4),
          effectiveMarginalKrPerKwh: i < 18 ? 3 : 0.5,
        }),
      );

      const plant = fitPlantModel(train);
      const emulator = fitBaselineEmulator(train);
      const power = fitPowerProxyParams(train);
      if (!plant) throw new Error("plant fit failed");

      const horizonSteps = 12;
      const calibration = {
        modelVersion: "mpc-v1",
        trainedAt: new Date().toISOString(),
        trainStepCount: train.length,
        holdoutStepCount: 0,
        emulator,
        plant,
        power,
        solver: {
          horizonSteps,
          stepMinutes: 15,
          comfortBandC: { min: 18, max: 24 },
          lambdaMove: 0.001,
          lambdaMoveTemporal: 0,
          lambdaComfort: 0.5,
          lambdaPeak: 0.01,
          bounds: DEFAULT_MPC_BOUNDS,
          maxIterations: 40,
          learningRate: 0.15,
        },
      };

      const uBmsHorizon = train.slice(0, horizonSteps).map((s, i) => ({
        ...s.uMeas!,
        // Sløser energi i dyre timer — gir MPC rom for δu
        supplyFanPct: i < horizonSteps / 2 ? 75 : s.uMeas!.supplyFanPct,
        exhaustFanPct: i < horizonSteps / 2 ? 75 : s.uMeas!.exhaustFanPct,
      }));
      const solution = solveMpcHorizon({
        startIndex: 0,
        steps: train,
        uBmsSimHorizon: uBmsHorizon,
        tExtInitial: 22,
        config: calibration.solver,
        calibration,
      });

      const zeroBaseline = solveMpcHorizon({
        startIndex: 0,
        steps: train,
        uBmsSimHorizon: uBmsHorizon,
        tExtInitial: 22,
        config: { ...calibration.solver, maxIterations: 0 },
        calibration,
      });

      expect(solution.totalCost).toBeLessThan(zeroBaseline.totalCost + 1e-4);

      const anyEconomicDelta = solution.deltaHorizon.some(
        (d) =>
          Math.abs(d.supplyFanPct) > 0.5 ||
          Math.abs(d.exhaustFanPct) > 0.5 ||
          Math.abs(d.heatingValvePct) > 0.5,
      );
      expect(anyEconomicDelta).toBe(true);
    },
    15_000,
  );
});
