import "server-only";

import { prisma } from "@/lib/db";
import { syncBuildingGridTariffs } from "@/services/grid-tariffs/sync-building-grid-tariffs";
import { osloYearMonthFromIso } from "./control-time-buckets";
import {
  buildMonthlyGridTariffIndex,
  monthRangesBetween,
  monthsInRangeOslo,
  type GridTariffRow,
  type MonthlyGridTariff,
} from "./grid-tariff-monthly";
import {
  resolveGridTariffMarginalContext,
  type GridTariffMarginalContext,
} from "./grid-tariff-marginal";
import { parseGridTariffGroups } from "./grid-tariff-groups";

export type { MonthlyGridTariff, GridTariffRow } from "./grid-tariff-monthly";
export {
  monthRangesBetween,
  monthsInRangeOslo,
  buildMonthlyGridTariffIndex,
} from "./grid-tariff-monthly";

export type MonthlyBhccEnergy = {
  month: string;
  electricityKwh: number;
  districtHeatingKwh: number;
  totalCostKr: number;
  /** Maks timevolum el i måneden — kWh/time ≈ kW (byggnivå). */
  peakElectricKw: number;
  peakDistrictHeatingKw: number;
};

export type GridTariffMonthlyBundle = {
  context: GridTariffMarginalContext | null;
  byMonth: Map<string, MonthlyGridTariff>;
  missingMonths: string[];
  syncedOnMiss: boolean;
  bhccByMonth: Map<string, MonthlyBhccEnergy>;
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

async function fetchGridTariffRows(input: {
  context: GridTariffMarginalContext;
  since: Date;
  until: Date;
}): Promise<GridTariffRow[]> {
  return prisma.gridTariff.findMany({
    where: {
      gridOperatorId: input.context.operatorId,
      county: input.context.county,
      tariffGroup: { in: parseGridTariffGroups() },
      OR: monthRangesBetween(input.since, input.until),
    },
    select: {
      timestamp: true,
      energyLink: true,
      capacityLink: true,
      fixedLink: true,
    },
  });
}

export async function loadBhccMonthlyEnergy(input: {
  buildingId: string;
  since: Date;
  until: Date;
}): Promise<Map<string, MonthlyBhccEnergy>> {
  const rows = await prisma.buildingHourlyCostCache.findMany({
    where: {
      buildingId: input.buildingId,
      hour: { gte: input.since, lt: input.until },
    },
    select: {
      hour: true,
      electricityVolumeKwh: true,
      districtHeatingVolumeKwh: true,
      electricityTotalCost: true,
      districtHeatingTotalCost: true,
    },
  });

  const acc = new Map<
    string,
    {
      electricityKwh: number;
      districtHeatingKwh: number;
      totalCostKr: number;
      peakElectricKw: number;
      peakDistrictHeatingKw: number;
    }
  >();

  for (const row of rows) {
    const month = osloYearMonthFromIso(row.hour.toISOString());
    const bucket = acc.get(month) ?? {
      electricityKwh: 0,
      districtHeatingKwh: 0,
      totalCostKr: 0,
      peakElectricKw: 0,
      peakDistrictHeatingKw: 0,
    };
    const elKwh = row.electricityVolumeKwh ?? 0;
    const dhKwh = row.districtHeatingVolumeKwh ?? 0;
    bucket.electricityKwh += elKwh;
    bucket.districtHeatingKwh += dhKwh;
    bucket.totalCostKr +=
      (row.electricityTotalCost ?? 0) + (row.districtHeatingTotalCost ?? 0);
    if (elKwh > bucket.peakElectricKw) bucket.peakElectricKw = elKwh;
    if (dhKwh > bucket.peakDistrictHeatingKw) bucket.peakDistrictHeatingKw = dhKwh;
    acc.set(month, bucket);
  }

  return new Map(
    [...acc.entries()].map(([month, v]) => [
      month,
      {
        month,
        electricityKwh: round2(v.electricityKwh),
        districtHeatingKwh: round2(v.districtHeatingKwh),
        totalCostKr: round2(v.totalCostKr),
        peakElectricKw: round1(v.peakElectricKw),
        peakDistrictHeatingKw: round1(v.peakDistrictHeatingKw),
      },
    ]),
  );
}

/** Hent NVE-nettleie per måned; synkroniser ved manglende måneder. */
export async function loadGridTariffMonthlyBundle(input: {
  buildingId: string;
  since: Date;
  until: Date;
  syncOnMiss?: boolean;
}): Promise<GridTariffMonthlyBundle> {
  const syncOnMiss = input.syncOnMiss ?? true;
  const expectedMonths = monthsInRangeOslo(input.since, input.until);
  const context = await resolveGridTariffMarginalContext(input.buildingId);

  const bhccByMonth = await loadBhccMonthlyEnergy({
    buildingId: input.buildingId,
    since: input.since,
    until: input.until,
  });

  if (!context) {
    return {
      context: null,
      byMonth: new Map(),
      missingMonths: expectedMonths,
      syncedOnMiss: false,
      bhccByMonth,
    };
  }

  let rows = await fetchGridTariffRows({
    context,
    since: input.since,
    until: input.until,
  });
  let { byMonth, missingMonths } = buildMonthlyGridTariffIndex(
    rows,
    expectedMonths,
  );

  let syncedOnMiss = false;
  if (syncOnMiss && missingMonths.length > 0) {
    await syncBuildingGridTariffs();
    syncedOnMiss = true;
    rows = await fetchGridTariffRows({
      context,
      since: input.since,
      until: input.until,
    });
    ({ byMonth, missingMonths } = buildMonthlyGridTariffIndex(
      rows,
      expectedMonths,
    ));
  }

  return {
    context,
    byMonth,
    missingMonths,
    syncedOnMiss,
    bhccByMonth,
  };
}
