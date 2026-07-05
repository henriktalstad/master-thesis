import { describe, expect, it } from "bun:test";
import { compareAttestToPractice } from "../compare-attest-practice";
import { NAERBYEN_ENERGY_ATTEST } from "../naerbyen-energy-attest";

describe("compareAttestToPractice", () => {
  it("sammenligner normert SIMIEN mot målt 3-års snitt", () => {
    const cmp = compareAttestToPractice(NAERBYEN_ENERGY_ATTEST);
    expect(cmp.normativeDeliveredDistrictHeatingKwh).toBe(40_751);
    expect(cmp.measuredThreeYearDistrictHeatingKwh).toBe(52_000);
    expect(cmp.mpcNetDemandKwhPerM2Year).toBeCloseTo(69.23, 1);
    expect(cmp.ventilationHeatShareOfDistrictHeat).toBeCloseTo(0.527, 2);
  });

  it("sammenligner replay-vindu mot attest-prior for FV-andel", () => {
    const cmp = compareAttestToPractice(NAERBYEN_ENERGY_ATTEST, {
      measuredElectricityKwh: 289.83,
      measuredDistrictHeatingKwh: 514,
      proxyElectricKwh: 44.15,
      proxyHeatKwh: 698.49,
    });
    expect(cmp.replay?.attestScaledVentilationHeatKwh).toBeCloseTo(270.9, 0);
    expect(cmp.replay?.proxyHeatShareOfMeasured).toBeCloseTo(1.36, 2);
    expect(cmp.replay?.proxyElectricShareOfMeasured).toBeCloseTo(0.15, 2);
    expect(cmp.fanElectricityShareOfDeliveredElectricity).toBeCloseTo(0.277, 2);
  });
});
