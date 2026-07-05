import {
  BUILDING_CONTROL_PROFILE_360102,
  resolveBuildingControlProfile,
  type BuildingControlProfile,
  type HvacControlScopeId,
} from "./building-control-profile";
import {
  PLANT_CONTROL_ACTUATORS,
  MPC_ALGORITHM_NOMENCLATURE,
  ANLEGG_CONTROL_COMPARISON_TAGLINE,
} from "./control-nomenclature";

export type PlantControlScopeSummary = {
  buildingSlug: string;
  siteLabel: string;
  ahuLabel: string;
  simulationScopeShort: string;
  simulationScopeLong: string;
  algorithm: typeof MPC_ALGORITHM_NOMENCLATURE;
  comparisonTagline: string;
  actuators: ReadonlyArray<{
    key: string;
    label: string;
    scope: "ventilation" | "district_heating";
  }>;
  actuatorCount: number;
  scopes: ReadonlyArray<{
    id: HvacControlScopeId;
    title: string;
    description: string;
    signalCount: number;
  }>;
  thesisScopeNote: string;
};

function scopeFromProfile(profile: BuildingControlProfile): PlantControlScopeSummary {
  return {
    buildingSlug: profile.buildingSlug,
    siteLabel: profile.siteLabel,
    ahuLabel: profile.ahuLabel,
    simulationScopeShort: profile.simulationScopeShort,
    simulationScopeLong: profile.simulationScopeLong,
    algorithm: MPC_ALGORITHM_NOMENCLATURE,
    comparisonTagline: ANLEGG_CONTROL_COMPARISON_TAGLINE,
    actuators: PLANT_CONTROL_ACTUATORS.map((a) => ({
      key: a.key,
      label: a.label,
      scope: a.scope,
    })),
    actuatorCount: PLANT_CONTROL_ACTUATORS.length,
    scopes: (Object.keys(profile.scopes) as HvacControlScopeId[]).map((id) => ({
      id,
      title: profile.scopes[id].title,
      description: profile.scopes[id].description,
      signalCount: profile.scopes[id].canonicalIds.length,
    })),
    thesisScopeNote:
      "MPC og sammenligninger dekker ventilasjon (AHU 360.102), fjernvarmeventiler TR002/TR003 og tilhørende energiproxy — ikke hele byggets lys, heiser og øvrige soner.",
  };
}

export function buildPlantControlScope(
  buildingSlug = BUILDING_CONTROL_PROFILE_360102.buildingSlug,
): PlantControlScopeSummary | null {
  const profile = resolveBuildingControlProfile(buildingSlug);
  if (!profile) return null;
  return scopeFromProfile(profile);
}
