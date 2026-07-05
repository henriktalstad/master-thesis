import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";

/** Antall MPC-steg per kalendertime (15 min → 4). */
export const MPC_STEPS_PER_HOUR = 60 / MPC_STEP_MINUTES;

export const MPC_STEP_HOURS = MPC_STEP_MINUTES / 60;

/** Fordel time-aggregert energi (kWh) jevnt på N steg — BHCC → replay-steg. */
export function allocateHourlyEnergyToSteps(
  hourlyEnergyKwh: number,
  stepsPerHour = MPC_STEPS_PER_HOUR,
): number {
  if (!Number.isFinite(hourlyEnergyKwh) || stepsPerHour <= 0) return 0;
  return hourlyEnergyKwh / stepsPerHour;
}

/** Gjennomsnittlig effekt (kW) når stepEnergyKwh er energi levert i ett steg. */
export function averagePowerKwFromStepEnergy(
  stepEnergyKwh: number,
  stepMinutes = MPC_STEP_MINUTES,
): number {
  const stepHours = stepMinutes / 60;
  if (stepHours <= 0 || !Number.isFinite(stepEnergyKwh)) return 0;
  return stepEnergyKwh / stepHours;
}

/** ∫P·dt — summerer effektprøver (kW) over like lange intervaller → kWh. */
export function integratePowerSeriesToEnergyKwh(
  powerKwSeries: readonly (number | null | undefined)[],
  stepMinutes = MPC_STEP_MINUTES,
): number {
  const stepHours = stepMinutes / 60;
  let total = 0;
  for (const powerKw of powerKwSeries) {
    if (powerKw == null || !Number.isFinite(powerKw) || powerKw <= 0) continue;
    total += powerKw * stepHours;
  }
  return total;
}

export type Tr003GroundTruthSource =
  | "tr003_energy_meter"
  | "tr003_power_integral"
  | "bhcc"
  | "none";

export type Tr003MeasuredEnergy = {
  /** kWh fra OE001 effekt (∫kW·dt over 15-min). */
  fromPowerIntegralKwh: number;
  /** kWh fra energimåler (siste − første per time). */
  fromEnergyMeterKwh: number;
  /** Foretrukket referanse når minst én TR003-kilde finnes. */
  groundTruthKwh: number;
  source: Tr003GroundTruthSource;
};

/** Velg TR003-referanse: energimåler Δ foretrekkes fremfor effektintegral. */
export function resolveTr003GroundTruthKwh(input: {
  fromEnergyMeterKwh: number;
  fromPowerIntegralKwh: number;
  bhccDistrictHeatingKwh: number;
}): Tr003MeasuredEnergy {
  const fromEnergyMeterKwh = Math.max(0, input.fromEnergyMeterKwh);
  const fromPowerIntegralKwh = Math.max(0, input.fromPowerIntegralKwh);

  if (fromEnergyMeterKwh > 0.5) {
    return {
      fromPowerIntegralKwh,
      fromEnergyMeterKwh,
      groundTruthKwh: fromEnergyMeterKwh,
      source: "tr003_energy_meter",
    };
  }
  if (fromPowerIntegralKwh > 0.5) {
    return {
      fromPowerIntegralKwh,
      fromEnergyMeterKwh,
      groundTruthKwh: fromPowerIntegralKwh,
      source: "tr003_power_integral",
    };
  }
  if (input.bhccDistrictHeatingKwh > 0) {
    return {
      fromPowerIntegralKwh,
      fromEnergyMeterKwh,
      groundTruthKwh: input.bhccDistrictHeatingKwh,
      source: "bhcc",
    };
  }
  return {
    fromPowerIntegralKwh,
    fromEnergyMeterKwh,
    groundTruthKwh: 0,
    source: "none",
  };
}
