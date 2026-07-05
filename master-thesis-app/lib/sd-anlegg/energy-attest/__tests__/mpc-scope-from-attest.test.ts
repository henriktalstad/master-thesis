import { describe, expect, it } from "bun:test";
import {
  clampShareToAttestPrior,
  deriveMpcScopePriorFromAttest,
} from "../mpc-scope-from-attest";
import { NAERBYEN_ENERGY_ATTEST, designVentilationFanKw } from "../naerbyen-energy-attest";
import { resolveEnergyAttestForBuilding, resolveMpcScopePrior } from "../resolve-energy-attest";

describe("deriveMpcScopePriorFromAttest", () => {
  it("utleder ventilasjons-FV-andel og vifteandel fra Nærbyen-attest", () => {
    const prior = deriveMpcScopePriorFromAttest(NAERBYEN_ENERGY_ATTEST);

    expect(prior.ventilationHeatShareOfDistrictHeat).toBeCloseTo(0.527, 2);
    expect(prior.fanElectricityShareOfDeliveredElectricity).toBeCloseTo(0.277, 2);
    expect(prior.mpcNetDemandShare).toBeCloseTo(0.39, 2);
    expect(prior.bhccVentilationHeatShareFallback).toBe(
      prior.ventilationHeatShareOfDistrictHeat,
    );
  });

  it("markerer ventilasjon, vifter og ventilasjonskjøling som mpc-scope", () => {
    const inScope = NAERBYEN_ENERGY_ATTEST.netEnergyDemand.filter((r) => r.inMpcScope);
    expect(inScope.map((r) => r.id)).toEqual([
      "ventilation_heat",
      "fans",
      "ventilation_cooling",
    ]);
    const mpcKwhPerM2 = inScope.reduce((s, r) => s + r.kwhPerM2PerYear, 0);
    expect(mpcKwhPerM2).toBeCloseTo(69.23, 1);
  });
});

describe("clampShareToAttestPrior", () => {
  it("begrenser datafit-andel til attest-prior", () => {
    expect(clampShareToAttestPrior(0.88, 0.527, 0.15)).toBeCloseTo(0.527, 3);
    expect(clampShareToAttestPrior(null, 0.277, 0.1)).toBeCloseTo(0.277, 3);
    expect(clampShareToAttestPrior(0.12, 0.277, 0.1)).toBeCloseTo(0.12, 3);
  });
});

describe("resolveEnergyAttestForBuilding", () => {
  it("løser Nærbyen-attest på thesis-slug", () => {
    const attest = resolveEnergyAttestForBuilding("sorgenfriveien-32ab");
    expect(attest?.certificateNumber).toBe("Energiattest-2026-279791");
    expect(attest?.heatedBraM2).toBe(331);
    expect(attest?.documentUrl).toContain("Energiattest%20-%20Sorgenfriveien%2032B.pdf");
  });

  it("returnerer mpcScope via resolveMpcScopePrior", () => {
    const prior = resolveMpcScopePrior("sorgenfriveien-32ab");
    expect(prior?.ventilationHeatShareOfDistrictHeat).toBeGreaterThan(0.5);
    expect(NAERBYEN_ENERGY_ATTEST.technical.label.energyGrade).toBe("C");
    expect(designVentilationFanKw()).toBeCloseTo(1.18, 1);
  });

  it("rapporterer 100 % fjernvarme for oppvarming og varmtvann", () => {
    expect(NAERBYEN_ENERGY_ATTEST.heatingCarrierShares).toEqual([
      {
        id: "districtHeating",
        labelNo: "Fjernvarme",
        labelEn: "District heating",
        sharePct: 100,
      },
    ]);
  });
});
