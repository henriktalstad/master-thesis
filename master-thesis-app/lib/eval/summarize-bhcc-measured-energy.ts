import { deriveMarginalAddonKrPerKwh } from "@/lib/sd-anlegg/control/control-effective-price-utils";

export type BhccMeasuredRow = {
  hour: Date;
  electricityVolumeKwh: number | null;
  electricityTotalCost: number | null;
  electricitySpotCost: number | null;
  electricityGridEnergyCost: number | null;
  electricityConsumptionTaxCost: number | null;
  electricityPriceNokPerKwh: number | null;
  districtHeatingVolumeKwh: number | null;
  districtHeatingTotalCost: number | null;
  spotPriceSource: "NORD_POOL" | "ENTSOE" | null;
};

export type EnergyGroundTruthMeasuredSummary = {
  measured: {
    electricityKwh: number;
    districtHeatingKwh: number;
    electricityCostKr: number;
    districtHeatingCostKr: number;
    totalCostKr: number;
    hourCount: number;
    hoursWithElectricity: number;
    hoursWithDistrictHeating: number;
  };
  prices: {
    spotHoursEntsoe: number;
    spotHoursNordPool: number;
    spotHoursUnknown: number;
    marginalAddonKrPerKwh: number;
    hoursWithMarginalPrice: number;
  };
  hourlyCoveragePct: number;
  expectedHours: number;
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function summarizeBhccMeasuredEnergy(input: {
  rows: readonly BhccMeasuredRow[];
  evalStart: Date;
  evalEnd: Date;
}): EnergyGroundTruthMeasuredSummary {
  const startMs = input.evalStart.getTime();
  const endMs = input.evalEnd.getTime();

  let electricityKwh = 0;
  let districtHeatingKwh = 0;
  let electricityCostKr = 0;
  let districtHeatingCostKr = 0;
  let hoursWithElectricity = 0;
  let hoursWithDistrictHeating = 0;
  let spotHoursEntsoe = 0;
  let spotHoursNordPool = 0;
  let spotHoursUnknown = 0;
  let hoursWithMarginalPrice = 0;
  let hourCount = 0;

  for (const row of input.rows) {
    const hourMs = row.hour.getTime();
    if (hourMs < startMs || hourMs >= endMs) continue;
    hourCount += 1;

    const el = row.electricityVolumeKwh ?? 0;
    const dh = row.districtHeatingVolumeKwh ?? 0;
    electricityKwh += el;
    districtHeatingKwh += dh;
    electricityCostKr += row.electricityTotalCost ?? 0;
    districtHeatingCostKr += row.districtHeatingTotalCost ?? 0;

    if (el > 0) hoursWithElectricity += 1;
    if (dh > 0) hoursWithDistrictHeating += 1;

    if (row.spotPriceSource === "ENTSOE") spotHoursEntsoe += 1;
    else if (row.spotPriceSource === "NORD_POOL") spotHoursNordPool += 1;
    else spotHoursUnknown += 1;

    if (
      row.electricityPriceNokPerKwh != null &&
      row.electricityPriceNokPerKwh > 0
    ) {
      hoursWithMarginalPrice += 1;
    }
  }

  const expectedHours = Math.max(
    0,
    Math.round((endMs - startMs) / 3_600_000),
  );
  const hourlyCoveragePct =
    expectedHours > 0
      ? Math.round((hourCount / expectedHours) * 1000) / 10
      : 0;

  const marginalAddonKrPerKwh = deriveMarginalAddonKrPerKwh(
    input.rows.map((row) => ({
      hour: row.hour,
      electricityVolumeKwh: row.electricityVolumeKwh,
      electricitySpotCost: row.electricitySpotCost ?? 0,
      electricityGridEnergyCost: row.electricityGridEnergyCost ?? 0,
      electricityConsumptionTaxCost: row.electricityConsumptionTaxCost ?? 0,
      electricityPriceNokPerKwh: row.electricityPriceNokPerKwh,
    })),
  );

  return {
    measured: {
      electricityKwh: round1(electricityKwh),
      districtHeatingKwh: round1(districtHeatingKwh),
      electricityCostKr: round2(electricityCostKr),
      districtHeatingCostKr: round2(districtHeatingCostKr),
      totalCostKr: round2(electricityCostKr + districtHeatingCostKr),
      hourCount,
      hoursWithElectricity,
      hoursWithDistrictHeating,
    },
    prices: {
      spotHoursEntsoe,
      spotHoursNordPool,
      spotHoursUnknown,
      marginalAddonKrPerKwh,
      hoursWithMarginalPrice,
    },
    hourlyCoveragePct,
    expectedHours,
  };
}
