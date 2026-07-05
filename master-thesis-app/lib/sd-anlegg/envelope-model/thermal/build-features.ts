import { osloWeekdayFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import type { MpcControlVector, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import { OPTIONAL_PLANT_FEATURES } from "../spec/resolve-features";
import { clearSkySolarProxy } from "../disturbance/solar-proxy";

export type PlantFeatureInput = {
  tExtPrev: number;
  /** Forrige varmegjenvinner etter-temp — andre RC-tilstand (plant-v2). */
  tRecPrev?: number | null;
  u: MpcControlVector;
  step: MpcTimestep;
};

const optionalReaders = new Map(
  OPTIONAL_PLANT_FEATURES.map((def) => [def.id, def.read] as const),
);

export function plantFeatureValue(
  featureId: string,
  input: PlantFeatureInput,
): number | null {
  switch (featureId) {
    case "t_ext_prev":
      return input.tExtPrev;
    case "t_rec_prev":
      return input.tRecPrev ?? null;
    case "supply_setpoint":
      return input.u.supplySetpointC;
    case "supply_fan":
      return input.u.supplyFanPct / 100;
    case "exhaust_fan":
      return input.u.exhaustFanPct / 100;
    case "heat_valve":
      return input.u.heatingValvePct / 100;
    case "cool_valve":
      return input.u.coolingValvePct / 100;
    case "outdoor_temp":
      return input.step.outdoorTempC;
    case "hour_sin": {
      const hourRad = (input.step.hourLocal / 24) * 2 * Math.PI;
      return Math.sin(hourRad);
    }
    case "hour_cos": {
      const hourRad = (input.step.hourLocal / 24) * 2 * Math.PI;
      return Math.cos(hourRad);
    }
    case "weekend": {
      if (input.step.t) {
        const dowLocal = osloWeekdayFromIso(input.step.t);
        return dowLocal === 0 || dowLocal === 6 ? 1 : 0;
      }
      return input.step.dowUtc === 0 || input.step.dowUtc === 6 ? 1 : 0;
    }
    case "solar_proxy":
      return clearSkySolarProxy(input.step.tMs);
    default: {
      const read = optionalReaders.get(featureId);
      if (!read) return null;
      const value = read(input.step);
      return value != null && Number.isFinite(value) ? value : null;
    }
  }
}

export function buildPlantFeatureVector(
  featureNames: readonly string[],
  input: PlantFeatureInput,
): number[] | null {
  const values: number[] = [];
  for (const featureId of featureNames) {
    const value = plantFeatureValue(featureId, input);
    if (value == null) return null;
    values.push(value);
  }
  return values;
}

/** @deprecated Bruk buildPlantFeatureVector med params.featureNames */
export function buildPlantFeatures(input: {
  tExtPrev: number;
  u: MpcControlVector;
  outdoorTempC: number;
  hourLocal: number;
  dowUtc: number;
}): number[] {
  return buildPlantFeatureVector(
    [
      "t_ext_prev",
      "supply_setpoint",
      "supply_fan",
      "exhaust_fan",
      "heat_valve",
      "cool_valve",
      "outdoor_temp",
      "hour_sin",
      "hour_cos",
      "weekend",
    ],
    {
      tExtPrev: input.tExtPrev,
      u: input.u,
      step: {
        outdoorTempC: input.outdoorTempC,
        hourLocal: input.hourLocal,
        dowUtc: input.dowUtc,
      } as MpcTimestep,
    },
  )!;
}
