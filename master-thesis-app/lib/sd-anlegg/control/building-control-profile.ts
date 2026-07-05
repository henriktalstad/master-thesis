import {
  MPC_CONTROL_CANONICALS,
  MPC_DISTURBANCE_CANONICALS,
  MPC_EVAL_DISTRICT_CANONICALS,
  MPC_PLANT_OBSERVATION_CANONICALS,
  MPC_U_MEAS_CANONICALS,
} from "@/lib/sd-anlegg/control/control-signal-registry-360102";

export type HvacControlScopeId =
  | "physical_control"
  | "simulation"
  | "district_heating"
  | "energy_cost";

export type BuildingControlProfile = {
  unitKey: string;
  buildingSlug: string;
  /** Bygg-/anleggsnavn i brukerflaten (f.eks. Nærbyen). */
  siteLabel: string;
  ahuLabel: string;
  /** Kort omfang for hero/undertekst. */
  simulationScopeShort: string;
  /** Lengre omfang for scope-banner og forklaringer. */
  simulationScopeLong: string;
  ventilationUnitSlug?: string;
  heatingUnitSlug?: string;
  scopes: Record<
    HvacControlScopeId,
    {
      title: string;
      description: string;
      canonicalIds: readonly string[];
    }
  >;
};

export const BUILDING_CONTROL_PROFILE_360102: BuildingControlProfile = {
  unitKey: "360.102",
  buildingSlug: "sorgenfriveien-32ab",
  siteLabel: "Nærbyen",
  ahuLabel: "AHU 360.102",
  simulationScopeShort: "ventilasjon, fjernvarmeventiler og energi",
  simulationScopeLong:
    "ventilasjon (AHU 360.102), fjernvarmeventiler TR002/TR003, planttilstand og byggenergi",
  ventilationUnitSlug: "360102",
  heatingUnitSlug: "3200013",
  scopes: {
    physical_control: {
      title: "Fysisk styring",
      description:
        "Målt BMS-pådrag (u_k) per 15 min — settpunkt, vifter, varme- og kjølebatteri.",
      canonicalIds: MPC_U_MEAS_CANONICALS,
    },
    simulation: {
      title: "Simulering og MPC",
      description:
        "Kontroll, plantmålinger og forstyrrelser i eval-replay og MPC.",
      canonicalIds: [
        ...MPC_CONTROL_CANONICALS,
        ...MPC_PLANT_OBSERVATION_CANONICALS,
        ...MPC_DISTURBANCE_CANONICALS,
      ],
    },
    district_heating: {
      title: "Fjernvarme TR002/TR003",
      description:
        "Ventilpådrag i u_k (7 kanaler totalt) + tur-temp som plantmåling. Pumper følger ventil.",
      canonicalIds: MPC_EVAL_DISTRICT_CANONICALS,
    },
    energy_cost: {
      title: "Energi og kostnad",
      description:
        "Byggnivå el/fjernvarme (P_k, BHCC) + spotpris; AHU-andel estimert via proxy.",
      canonicalIds: [
        "building.electricity",
        "building.district_heating",
        "energy.spot_price",
        "energy.marginal_price",
      ],
    },
  },
};

export function resolveBuildingControlProfile(
  buildingSlug: string,
): BuildingControlProfile | null {
  if (buildingSlug === BUILDING_CONTROL_PROFILE_360102.buildingSlug) {
    return BUILDING_CONTROL_PROFILE_360102;
  }
  return null;
}
