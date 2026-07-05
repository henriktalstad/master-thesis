import { THESIS_CASE_BUILDING_SLUG } from "@/lib/config/thesis-case";
import { NAERBYEN_ENERGY_ATTEST } from "./naerbyen-energy-attest";
import type { BuildingEnergyAttest, EnergyAttestMpcScopePrior } from "./types";

const ATTESTS_BY_SLUG: Readonly<Record<string, BuildingEnergyAttest>> = {
  [NAERBYEN_ENERGY_ATTEST.buildingSlug]: NAERBYEN_ENERGY_ATTEST,
};

export function resolveEnergyAttestForBuilding(
  buildingSlug?: string | null,
): BuildingEnergyAttest | null {
  const slug = buildingSlug?.trim() || THESIS_CASE_BUILDING_SLUG;
  return ATTESTS_BY_SLUG[slug] ?? null;
}

export function resolveMpcScopePrior(
  buildingSlug?: string | null,
): EnergyAttestMpcScopePrior | null {
  return resolveEnergyAttestForBuilding(buildingSlug)?.mpcScope ?? null;
}
