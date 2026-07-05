import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  PLANT_FEATURE_COVERAGE_THRESHOLD,
  type PlantFeatureAvailability,
  type PlantFeatureCategory,
  type PlantFeatureScope,
} from "./signal-scope";

export const CORE_PLANT_FEATURE_IDS = [
  "t_ext_prev",
  "supply_setpoint",
  "supply_fan",
  "exhaust_fan",
  "heat_valve",
  "cool_valve",
  "outdoor_temp",
  "solar_proxy",
  "hour_sin",
  "hour_cos",
  "weekend",
] as const;

export type CorePlantFeatureId = (typeof CORE_PLANT_FEATURE_IDS)[number];

export type OptionalPlantFeatureDef = {
  id: string;
  label: string;
  category: PlantFeatureCategory;
  read: (step: MpcTimestep) => number | null | undefined;
};

export const OPTIONAL_PLANT_FEATURES: readonly OptionalPlantFeatureDef[] = [
  {
    id: "supply_temp_meas",
    label: "Tilluft temp. (målt)",
    category: "observation",
    read: (step) => step.supplyTempMeasC,
  },
  {
    id: "intake_temp_meas",
    label: "Inntak temp. (målt)",
    category: "observation",
    read: (step) => step.intakeTempMeasC,
  },
  {
    id: "heat_recovery_after_temp",
    label: "Temp. etter gjenvinner",
    category: "observation",
    read: (step) => step.heatRecoveryAfterTempC,
  },
  {
    id: "extract_setpoint",
    label: "Avtrekk SP (lokal BMS)",
    category: "disturbance",
    read: (step) => step.extractSetpointC,
  },
  {
    id: "supply_fan_flow",
    label: "Tilluft luftmengde",
    category: "observation",
    read: (step) => step.supplyFanFlowM3h,
  },
  {
    id: "exhaust_fan_flow",
    label: "Avtrekk luftmengde",
    category: "observation",
    read: (step) => step.exhaustFanFlowM3h,
  },
  {
    id: "heat_recovery_efficiency",
    label: "Gjenvinner virkningsgrad",
    category: "observation",
    read: (step) =>
      step.heatRecoveryEfficiencyPct != null
        ? step.heatRecoveryEfficiencyPct / 100
        : null,
  },
  {
    id: "heating_coil_temp",
    label: "Varmebatteri temp.",
    category: "observation",
    read: (step) => step.heatingCoilTempC,
  },
] as const;

export type UnavailablePlantFeatureDef = {
  id: string;
  label: string;
  category: PlantFeatureCategory;
  reason: string;
};

/** Signaler som ikke finnes i caset — dokumentert for metode/UI, aldri i modellen. */
export const UNAVAILABLE_PLANT_FEATURES: readonly UnavailablePlantFeatureDef[] = [
  {
    id: "solar_irradiance_measured",
    label: "Solstråling (målt)",
    category: "disturbance",
    reason:
      "Ingen pyranometer i vær-pipeline — erstattet av klar-himmel sol-proxy (solar_proxy) i kjerne-features",
  },
  {
    id: "occupancy",
    label: "Belegg / opptatt tid",
    category: "disturbance",
    reason: "Ingen sensor i BMS",
  },
  {
    id: "room_temp",
    label: "Romtemperatur",
    category: "observation",
    reason: "Ikke i BMS",
  },
  {
    id: "co2",
    label: "CO₂",
    category: "observation",
    reason: "Ikke i BMS",
  },
  {
    id: "supply_fan_pressure",
    label: "Trykk tilluftskanal",
    category: "observation",
    reason:
      "Ingen Infraspawn-dekning i eval-vindu (supply.fan.pressure / AI_SAFPressure)",
  },
  {
    id: "exhaust_fan_pressure",
    label: "Trykk avtrekkskanal",
    category: "observation",
    reason:
      "Ingen Infraspawn-dekning i eval-vindu (exhaust.fan.pressure / AI_EAFPressure)",
  },
] as const;

function isTrainableRow(prev: MpcTimestep, curr: MpcTimestep): boolean {
  return (
    curr.extractTempC != null &&
    prev.extractTempC != null &&
    curr.uMeas != null &&
    curr.outdoorTempC != null
  );
}

function coveragePct(present: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((present / total) * 1000) / 10;
}

function availabilityFromCoverage(pct: number | null): PlantFeatureAvailability {
  if (pct == null) return "missing";
  if (pct >= PLANT_FEATURE_COVERAGE_THRESHOLD * 100) return "available";
  if (pct > 0) return "partial";
  return "missing";
}

export function resolvePlantFeatureNames(
  steps: readonly MpcTimestep[],
  threshold = PLANT_FEATURE_COVERAGE_THRESHOLD,
): {
  featureNames: string[];
  featureScope: PlantFeatureScope[];
} {
  const trainable = steps.filter((step, i) =>
    i > 0 ? isTrainableRow(steps[i - 1]!, step) : false,
  );
  const trainableCount = trainable.length;

  const coreScope: PlantFeatureScope[] = CORE_PLANT_FEATURE_IDS.map((id) => ({
    featureId: id,
    label: coreFeatureLabel(id),
    category: coreFeatureCategory(id),
    availability: trainableCount > 0 ? "available" : "missing",
    usedInModel: true,
    coveragePct: trainableCount > 0 ? 100 : 0,
  }));

  const optionalActive: string[] = [];
  const optionalScope: PlantFeatureScope[] = OPTIONAL_PLANT_FEATURES.map((def) => {
    let present = 0;
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1]!;
      const curr = steps[i]!;
      if (!isTrainableRow(prev, curr)) continue;
      if (def.read(curr) != null) present += 1;
    }
    const pct = coveragePct(present, trainableCount);
    const availability = availabilityFromCoverage(pct);
    const used = pct != null && pct / 100 >= threshold;
    if (used) optionalActive.push(def.id);
    return {
      featureId: def.id,
      label: def.label,
      category: def.category,
      availability,
      usedInModel: used,
      coveragePct: pct,
    };
  });

  const unavailableScope: PlantFeatureScope[] = UNAVAILABLE_PLANT_FEATURES.map(
    (def) => ({
      featureId: def.id,
      label: def.label,
      category: def.category,
      availability: "missing" as const,
      usedInModel: false,
      coveragePct: null,
    }),
  );

  return {
    featureNames: [...CORE_PLANT_FEATURE_IDS, ...optionalActive],
    featureScope: [...coreScope, ...optionalScope, ...unavailableScope],
  };
}

function coreFeatureLabel(id: CorePlantFeatureId): string {
  const labels: Record<CorePlantFeatureId, string> = {
    t_ext_prev: "Forrige avtrekkstemp.",
    supply_setpoint: "Tilluft SP",
    supply_fan: "Tilluftvifte",
    exhaust_fan: "Avtrekkvifte",
    heat_valve: "Varmeventil",
    cool_valve: "Kjøleventil",
    outdoor_temp: "Utetemp.",
    solar_proxy: "Sol-proxy",
    hour_sin: "Time (sin)",
    hour_cos: "Time (cos)",
    weekend: "Helg",
  };
  return labels[id];
}

function coreFeatureCategory(id: CorePlantFeatureId): PlantFeatureCategory {
  if (id === "t_ext_prev") return "state";
  if (id === "outdoor_temp" || id === "solar_proxy") return "disturbance";
  if (id.startsWith("hour_") || id === "weekend") return "time";
  return "control";
}
