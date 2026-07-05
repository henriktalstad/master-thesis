import { resolveMpcScopePrior } from "@/lib/sd-anlegg/energy-attest";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import type { MpcReplayStep, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  MPC_STEP_HOURS,
  averagePowerKwFromStepEnergy,
  integratePowerSeriesToEnergyKwh,
  resolveTr003GroundTruthKwh,
} from "./energy-quantity";

export type { Tr003GroundTruthSource, Tr003MeasuredEnergy } from "./energy-quantity";
export {
  allocateHourlyEnergyToSteps,
  averagePowerKwFromStepEnergy,
  integratePowerSeriesToEnergyKwh,
  resolveTr003GroundTruthKwh,
} from "./energy-quantity";

export type DistrictHeatStepReading = Pick<
  MpcTimestep,
  | "districtMeterTr003PowerKw"
  | "districtMeterTr003EnergyKwh"
  | "buildingDistrictHeatingKwh"
>;

/** Instantaneous FV-effekt fra TR003 (320003OE001_effekt), kW. */
export function stepDistrictHeatKw(
  step: Pick<MpcTimestep, "districtMeterTr003PowerKw">,
): number | null {
  const power = step.districtMeterTr003PowerKw;
  if (power == null || !Number.isFinite(power) || power <= 0) return null;
  return power;
}

/** Kalibreringsmål per steg — TR003 effekt (kW) når tilgjengelig, ellers BHCC × attest-prior. */
export function stepDistrictHeatTargetKw(
  step: DistrictHeatStepReading,
  bhccShareFallback?: number,
): number {
  const circuitKw = stepDistrictHeatKw(step);
  if (circuitKw != null) return circuitKw;
  const share =
    bhccShareFallback ??
    resolveMpcScopePrior()?.bhccVentilationHeatShareFallback ??
    0.15;
  return (
    averagePowerKwFromStepEnergy(step.buildingDistrictHeatingKwh) * share
  );
}

/** ∫ TR003 effekt (kW) over 15-min-steg → energi (kWh). */
export function integrateDistrictHeatPowerKwh(
  steps: readonly Pick<MpcTimestep | MpcReplayStep, "districtMeterTr003PowerKw">[],
): number {
  return integratePowerSeriesToEnergyKwh(
    steps.map((step) => stepDistrictHeatKw(step)),
  );
}

/** Akkumulert TR003-energi per time (siste − første sample i timen), kWh. */
export function sumHourlyTr003EnergyDelta(
  steps: readonly Pick<MpcTimestep | MpcReplayStep, "t" | "districtMeterTr003EnergyKwh">[],
): number {
  const byHour = new Map<string, { first: number; last: number }>();
  for (const step of steps) {
    const energy = step.districtMeterTr003EnergyKwh;
    if (energy == null || !Number.isFinite(energy)) continue;
    const hourKey = controlHourKeyFromIso(step.t);
    const prev = byHour.get(hourKey);
    if (!prev) {
      byHour.set(hourKey, { first: energy, last: energy });
      continue;
    }
    prev.last = energy;
  }

  let total = 0;
  for (const { first, last } of byHour.values()) {
    const delta = last - first;
    if (delta > 0) total += delta;
  }
  return total;
}

/** TR003 målt energi — skiller effektintegral og energimåler. */
export function summarizeTr003MeasuredEnergy(input: {
  steps: readonly Pick<
    MpcTimestep | MpcReplayStep,
    "t" | "districtMeterTr003PowerKw" | "districtMeterTr003EnergyKwh"
  >[];
  bhccDistrictHeatingKwh?: number;
}): import("./energy-quantity").Tr003MeasuredEnergy {
  return resolveTr003GroundTruthKwh({
    fromEnergyMeterKwh: sumHourlyTr003EnergyDelta(input.steps),
    fromPowerIntegralKwh: integrateDistrictHeatPowerKwh(input.steps),
    bhccDistrictHeatingKwh: input.bhccDistrictHeatingKwh ?? 0,
  });
}

export { MPC_STEP_HOURS };
