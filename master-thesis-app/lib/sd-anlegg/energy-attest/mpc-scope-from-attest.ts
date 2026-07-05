import type {
  BuildingEnergyAttest,
  EnergyAttestMpcScopePrior,
} from "./types";

export type EnergyAttestScopeInput = Pick<
  BuildingEnergyAttest,
  | "netEnergyDemand"
  | "netEnergyDemandTotalKwhPerM2"
  | "delivered"
  | "districtHeatEndUses"
>;

function roundShare(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Utleder MPC scope-prior fra NS 3031 energiattest. */
export function deriveMpcScopePriorFromAttest(
  attest: EnergyAttestScopeInput,
): EnergyAttestMpcScopePrior {
  const dhEndUse = attest.districtHeatEndUses;
  const dhDeliveredPerM2 = dhEndUse.reduce((s, r) => s + r.kwhPerM2PerYear, 0);
  const ventHeatPerM2 =
    dhEndUse.find((r) => r.id === "ventilationHeat")?.kwhPerM2PerYear ?? 0;

  const elDeliveredPerM2 =
    attest.delivered.find((r) => r.id === "electricity")?.kwhPerM2PerYear ?? 0;
  const fanNetPerM2 =
    attest.netEnergyDemand.find((r) => r.id === "fans")?.kwhPerM2PerYear ?? 0;

  const mpcNetPerM2 = attest.netEnergyDemand
    .filter((r) => r.inMpcScope)
    .reduce((s, r) => s + r.kwhPerM2PerYear, 0);

  const ventilationHeatShareOfDistrictHeat =
    dhDeliveredPerM2 > 0 ? ventHeatPerM2 / dhDeliveredPerM2 : 0.53;

  return {
    ventilationHeatShareOfDistrictHeat: roundShare(
      ventilationHeatShareOfDistrictHeat,
    ),
    fanElectricityShareOfDeliveredElectricity: roundShare(
      elDeliveredPerM2 > 0 ? fanNetPerM2 / elDeliveredPerM2 : 0.28,
    ),
    mpcNetDemandShare: roundShare(
      attest.netEnergyDemandTotalKwhPerM2 > 0
        ? mpcNetPerM2 / attest.netEnergyDemandTotalKwhPerM2
        : 0.39,
    ),
    bhccVentilationHeatShareFallback: roundShare(
      ventilationHeatShareOfDistrictHeat,
    ),
  };
}

export function clampShareToAttestPrior(
  fittedShare: number | null,
  attestPrior: number,
  fallback: number,
): number {
  const base =
    fittedShare != null && Number.isFinite(fittedShare) && fittedShare > 0
      ? fittedShare
      : attestPrior > 0
        ? attestPrior
        : fallback;
  if (attestPrior <= 0) return base;
  return Math.min(base, attestPrior);
}
