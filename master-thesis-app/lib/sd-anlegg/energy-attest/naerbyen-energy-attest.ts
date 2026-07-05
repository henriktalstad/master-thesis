import { deriveMpcScopePriorFromAttest } from "./mpc-scope-from-attest";
import type { BuildingEnergyAttest } from "./types";

/** Scoped proxy-URL (krever innlogging). */
export const NAERBYEN_ENERGY_ATTEST_DOCUMENT_URL =
  "https://app.scoped.no/api/proxy-document?url=https%3A%2F%2Fimages.codetools.design%2Fenergy-attestations%2Fcmcvkus1y006uji04b1cvwp3q%2Fcmntt42u6m8ck07lnp7za84xu%2Fattest-cmntt42u6m8ck07lnp7za84xu-2026-07-03.pdf&filename=Energiattest%20-%20Sorgenfriveien%2032B.pdf";

const NAERBYEN_ENERGY_ATTEST_BASE: Omit<BuildingEnergyAttest, "mpcScope"> = {
  buildingSlug: "sorgenfriveien-32ab",
  certificateNumber: "Energiattest-2026-279791",
  issuedAt: "2026-04-10",
  documentUrl: NAERBYEN_ENERGY_ATTEST_DOCUMENT_URL,
  address: "Sorgenfriveien 32B",
  postalPlace: "7031 Trondheim",
  heatedBraM2: 331,
  buildingYear: 2022,
  buildingCategory: "Kontorbygg",
  tekStandard: "Tek 17",
  calculationStandard: "NS 3031:2025",
  calculationSoftware: "SIMIEN 8.0.34.08",
  netEnergyDemandTotalKwhPerM2: 177.8,
  netEnergyDemand: [
    {
      id: "ventilation_heat",
      labelNo: "Ventilasjon",
      labelEn: "Ventilation heat",
      kwhPerM2PerYear: 51.86,
      inMpcScope: true,
    },
    {
      id: "space_cooling",
      labelNo: "Romkjøling",
      labelEn: "Space cooling",
      kwhPerM2PerYear: 35.95,
      inMpcScope: false,
    },
    {
      id: "space_heating",
      labelNo: "Romoppvarming",
      labelEn: "Space heating",
      kwhPerM2PerYear: 35.45,
      inMpcScope: false,
    },
    {
      id: "equipment",
      labelNo: "Utstyr",
      labelEn: "Equipment",
      kwhPerM2PerYear: 18.92,
      inMpcScope: false,
    },
    {
      id: "fans",
      labelNo: "Vifter",
      labelEn: "Fans",
      kwhPerM2PerYear: 15.23,
      inMpcScope: true,
    },
    {
      id: "lighting",
      labelNo: "Belysning",
      labelEn: "Lighting",
      kwhPerM2PerYear: 12.58,
      inMpcScope: false,
    },
    {
      id: "domestic_hot_water",
      labelNo: "Varmtvann",
      labelEn: "Domestic hot water",
      kwhPerM2PerYear: 5.02,
      inMpcScope: false,
    },
    {
      id: "ventilation_cooling",
      labelNo: "Ventilasjonskjøling",
      labelEn: "Ventilation cooling",
      kwhPerM2PerYear: 2.14,
      inMpcScope: true,
    },
    {
      id: "pumps",
      labelNo: "Pumper",
      labelEn: "Pumps",
      kwhPerM2PerYear: 0.66,
      inMpcScope: false,
    },
  ],
  delivered: [
    {
      id: "electricity",
      labelEn: "Delivered electricity",
      kwhPerYear: 18_187,
      kwhPerM2PerYear: 54.94,
    },
    {
      id: "districtHeating",
      labelEn: "Delivered district heating",
      kwhPerYear: 40_751,
      kwhPerM2PerYear: 123.12,
    },
    {
      id: "districtCooling",
      labelEn: "Delivered district cooling",
      kwhPerYear: 0,
      kwhPerM2PerYear: 0,
    },
  ],
  districtHeatEndUses: [
    { id: "spaceHeating", labelEn: "Space heating", kwhPerM2PerYear: 49.22 },
    {
      id: "ventilationHeat",
      labelEn: "Ventilation heat",
      kwhPerM2PerYear: 64.95,
    },
    { id: "domesticHotWater", labelEn: "Domestic hot water", kwhPerM2PerYear: 8.95 },
  ],
  heatingCarrierShares: [
    {
      id: "districtHeating",
      labelNo: "Fjernvarme",
      labelEn: "District heating",
      sharePct: 100,
    },
  ],
  measuredThreeYearAvg: {
    electricityKwh: 15_000,
    districtHeatingKwh: 52_000,
    totalKwh: 67_000,
  },
  technical: {
    label: { energyGrade: "C" },
    geometry: {
      heatedBraM2: 331,
      heatedVolumeM3: 1224.7,
      externalWallAreaM2: 165.1,
      windowAreaM2: 122.5,
      windowRatioPct: 37.01,
      leakageTestDate: "2026-03-17",
    },
    envelope: {
      uValueWallWPerM2K: 0.19,
      uValueWindowWPerM2K: 0.8,
      thermalBridgeWPerM2K: 0.07,
      normalizedHeatCapacityWhPerM2K: 36.8,
      solarFactor: 0.45,
      frameFactor: 0.2,
      airtightnessH1: 0.53,
    },
    ventilation: {
      heatRecoveryAnnualPct: 40,
      frostEfficiencyPct: 40,
      specificFanPowerKwPerM3s: 1.69,
      designAirflowM3PerM2H: 7.59,
    },
    systems: {
      heatingSource: "Sentral varmekilde — fjernvarme",
      coolingSource: "Lokal kjølemaskin",
      heatingSetpointC: 22,
      coolingSetpointC: 25,
      installedHeatingWPerM2: 95.59,
      installedCoolingWPerM2: 80.97,
      systemHeatingEfficiencyPct: 95,
      districtHeatingSystemEfficiencyPct: 95,
      annualCoolingCopPct: 100,
      specificPumpPowerKwPerLs: 0.6,
    },
    measures: [
      {
        id: "repair_ventilation_hru",
        labelNo: "Utbedre feil på gjenvinner ventilasjon",
        labelEn: "Repair ventilation heat recovery fault",
        summary:
          "Feil på gjenvinner gir vesentlig lavere varmegjenvinning enn forventet. SIMIEN bruker 40 % årlig gjenvinnergrad basert på SD-anlegg og innkjøpt energi.",
      },
    ],
  },
};

export const NAERBYEN_ENERGY_ATTEST: BuildingEnergyAttest = {
  ...NAERBYEN_ENERGY_ATTEST_BASE,
  mpcScope: deriveMpcScopePriorFromAttest(NAERBYEN_ENERGY_ATTEST_BASE),
};

/** Normert total luftmengde ved design (m³/s). */
export function designVentilationAirflowM3s(
  attest: Pick<BuildingEnergyAttest, "heatedBraM2" | "technical"> = NAERBYEN_ENERGY_ATTEST,
): number {
  const m3PerHour =
    attest.heatedBraM2 * attest.technical.ventilation.designAirflowM3PerM2H;
  return m3PerHour / 3600;
}

/** Normert vifteeffekt (kW) ved design luftmengde og SFP. */
export function designVentilationFanKw(
  attest: Pick<BuildingEnergyAttest, "heatedBraM2" | "technical"> = NAERBYEN_ENERGY_ATTEST,
): number {
  return (
    attest.technical.ventilation.specificFanPowerKwPerM3s *
    designVentilationAirflowM3s(attest)
  );
}
