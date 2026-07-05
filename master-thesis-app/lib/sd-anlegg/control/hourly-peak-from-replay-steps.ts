import { controlHourKeyFromIso } from "./control-time-buckets";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { stepDistrictHeatKw } from "@/lib/sd-anlegg/envelope-model/power/district-heat-ground-truth";
import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";

const STEP_HOURS = MPC_STEP_MINUTES / 60;

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Maks timeenergi fra 15-min replay-steg — kWh/time ≈ kW.
 * Samme konvensjon som BHCC (maks hourlyVolumeKwh i eval-vinduet).
 */
export function hourlyPeakKwFromStepKwh(
  steps: readonly MpcReplayStep[],
  pickKwh: (step: MpcReplayStep) => number | null | undefined,
): number | null {
  const hourlyKwh = new Map<string, number>();
  for (const step of steps) {
    const kwh = pickKwh(step);
    if (kwh == null || !Number.isFinite(kwh) || kwh <= 0) continue;
    const hour = controlHourKeyFromIso(step.t);
    hourlyKwh.set(hour, (hourlyKwh.get(hour) ?? 0) + kwh);
  }
  if (hourlyKwh.size === 0) return null;
  return round1(Math.max(...hourlyKwh.values()));
}

export function pickProxyHeatKwhEmulated(step: MpcReplayStep): number | null {
  return (
    step.proxyHeatKwhEmulated ??
    step.proxyHeatKwhBaseline ??
    step.heatingDistrictKwhEmulated ??
    step.heatingDistrictKwhBaseline ??
    null
  );
}

export function pickProxyElKwhEmulated(step: MpcReplayStep): number | null {
  return step.proxyElKwhEmulated ?? step.proxyElKwhBaseline ?? null;
}

/** Maks TR003 timeenergi fra effekt-integrasjon eller energimåler Δ per time. */
export function hourlyPeakKwFromTr003Measured(
  steps: readonly MpcReplayStep[],
): number | null {
  const hourlyFromPower = new Map<string, number>();
  for (const step of steps) {
    const kw = stepDistrictHeatKw(step);
    if (kw == null) continue;
    const hour = controlHourKeyFromIso(step.t);
    hourlyFromPower.set(
      hour,
      (hourlyFromPower.get(hour) ?? 0) + kw * STEP_HOURS,
    );
  }
  if (hourlyFromPower.size > 0) {
    return round1(Math.max(...hourlyFromPower.values()));
  }

  const byHourEnergy = new Map<string, { first: number; last: number }>();
  for (const step of steps) {
    const energy = step.districtMeterTr003EnergyKwh;
    if (energy == null || !Number.isFinite(energy)) continue;
    const hour = controlHourKeyFromIso(step.t);
    const prev = byHourEnergy.get(hour);
    if (!prev) {
      byHourEnergy.set(hour, { first: energy, last: energy });
      continue;
    }
    prev.last = energy;
  }
  const hourlyDeltas: number[] = [];
  for (const { first, last } of byHourEnergy.values()) {
    const delta = last - first;
    if (delta > 0) hourlyDeltas.push(delta);
  }
  if (hourlyDeltas.length === 0) return null;
  return round1(Math.max(...hourlyDeltas));
}
