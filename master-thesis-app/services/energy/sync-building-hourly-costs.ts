import { prisma } from "@/lib/db";
import { resolveBuildingSlug } from "@/lib/config/thesis-case";
import { Prisma } from "@/generated/client";
import { monthRangesBetween } from "@/lib/sd-anlegg/control/grid-tariff-monthly";
import { primaryEnergyTariffGroup } from "@/lib/sd-anlegg/control/grid-tariff-groups";
import { gridOreForHour as gridOreForHourOslo } from "@/lib/sd-anlegg/control/grid-tariff-marginal-utils";
import type { EnergyPriceSource } from "@/generated/client/enums";
import { utcDayMidnight } from "@/lib/energy-prices/day-utils";
import {
  getThesisEvalWindow,
} from "@/lib/config/thesis-eval";
import {
  recentOsloDayRefreshStart,
  resolveBhccSyncWindow,
} from "@/lib/energy/bhcc-sync-window";
import {
  getElectricityZoneForBuilding,
  toMinimalBuildingForZone,
} from "@/lib/utils";

export type SyncBuildingHourlyCostsResult = {
  success: boolean;
  buildingId: string;
  areaCode: string;
  hoursProcessed: number;
  hoursUpserted: number;
  startHour: string;
  endHour: string;
  message: string;
};

const CONSUMPTION_TAX_KR_PER_KWH = Number(
  process.env.ELECTRICITY_CONSUMPTION_TAX_KR ?? "0.2196",
);

export const BHCC_ROLLUP_SOURCE = "building_hourly_costs_sync";

type SpotPriceHour = {
  price: number;
  source: EnergyPriceSource | null;
};

async function resolveThesisBuilding(buildingSlug?: string) {
  const slug = resolveBuildingSlug(buildingSlug);
  return prisma.building.findFirst({
    where: { slug },
    select: {
      id: true,
      slug: true,
      municipalityNumber: true,
      region: true,
      postCode: true,
      municipalityName: true,
      selectedGridOperatorId: true,
      selectedGridOperator: {
        select: { id: true, counties: true },
      },
    },
  });
}

async function listMeteringPointIds(buildingId: string): Promise<string[]> {
  const rows = await prisma.meteringPoint.findMany({
    where: {
      isActive: true,
      includeInTotal: true,
      OR: [
        { buildingId },
        { buildingLinks: { some: { buildingId } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function aggregateElectricityHours(
  meteringPointIds: string[],
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  if (!meteringPointIds.length) return new Map();

  const rows = await prisma.$queryRaw<Array<{ hour: Date; kwh: number }>>`
    SELECT date_trunc('hour', "utcTime") AS hour,
           SUM("volume_kwh")::float AS kwh
    FROM observations
    WHERE "meteringPointId" IN (${Prisma.join(meteringPointIds)})
      AND "utcTime" >= ${start}
      AND "utcTime" < ${end}
      AND "reviewedAt" IS NULL
    GROUP BY 1
    ORDER BY 1
  `;

  return new Map(
    rows.map((r) => [r.hour.toISOString(), Number(r.kwh) || 0]),
  );
}

async function aggregateDistrictHeatingHours(
  meteringPointIds: string[],
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  if (!meteringPointIds.length) return new Map();

  const rows = await prisma.$queryRaw<Array<{ hour: Date; kwh: number }>>`
    SELECT date_trunc('hour', "utcTime") AS hour,
           SUM(COALESCE("energyKwh", 0))::float AS kwh
    FROM district_heating_measurements
    WHERE "meteringPointId" IN (${Prisma.join(meteringPointIds)})
      AND "utcTime" >= ${start}
      AND "utcTime" < ${end}
    GROUP BY 1
    ORDER BY 1
  `;

  return new Map(
    rows.map((r) => [r.hour.toISOString(), Number(r.kwh) || 0]),
  );
}

async function loadSpotPrices(
  areaCode: string,
  start: Date,
  end: Date,
): Promise<Map<string, SpotPriceHour>> {
  const rows = await prisma.hourlyEnergyPrices.findMany({
    where: {
      areaCode,
      date: { gte: utcDayMidnight(start), lte: end },
    },
    select: { date: true, hour: true, price: true, source: true },
  });

  const out = new Map<string, SpotPriceHour>();
  for (const row of rows) {
    if (!row.date || row.hour == null || row.price == null) continue;
    const hour = new Date(
      Date.UTC(
        row.date.getUTCFullYear(),
        row.date.getUTCMonth(),
        row.date.getUTCDate(),
        row.hour,
        0,
        0,
        0,
      ),
    );
    out.set(hour.toISOString(), {
      price: row.price,
      source: row.source,
    });
  }
  return out;
}

async function loadGridEnergyOrePerKwh(
  operatorId: string,
  county: string,
  tariffGroup: number,
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  const tariffs = await prisma.gridTariff.findMany({
    where: {
      gridOperatorId: operatorId,
      county,
      tariffGroup,
      OR: monthRangesBetween(start, end),
    },
    select: { timestamp: true, energyLink: true },
  });

  return new Map(
    tariffs
      .filter((t) => t.energyLink != null)
      .map((t) => [t.timestamp.toISOString(), t.energyLink!]),
  );
}

function gridOreForHour(
  gridByTimestamp: Map<string, number>,
  hour: Date,
): number {
  return gridOreForHourOslo(gridByTimestamp, hour) ?? 0;
}

function resolveSyncWindow(input?: {
  start?: Date;
  endExclusive?: Date;
  throughYesterdayOslo?: boolean;
}): { start: Date; endExclusive: Date; throughOsloYmd: string } {
  const evalWin = getThesisEvalWindow();
  const base = resolveBhccSyncWindow({
    start: input?.start ?? evalWin.start ?? undefined,
    endExclusive: input?.endExclusive ?? evalWin.end ?? undefined,
    throughYesterdayOslo: input?.throughYesterdayOslo,
  });

  if (evalWin.end && !input?.endExclusive) {
    return {
      ...base,
      endExclusive: new Date(evalWin.end),
    };
  }
  return base;
}

export async function syncBuildingHourlyCosts(input?: {
  start?: Date;
  end?: Date;
  throughYesterdayOslo?: boolean;
  /** fill_gaps: hopp over timer med volum (backfill). refresh_recent: re-skriv siste døgn (cron). */
  mode?: "fill_gaps" | "refresh_recent";
  buildingSlug?: string;
}): Promise<SyncBuildingHourlyCostsResult> {
  const building = await resolveThesisBuilding(input?.buildingSlug);
  if (!building) {
    return {
      success: false,
      buildingId: "",
      areaCode: "",
      hoursProcessed: 0,
      hoursUpserted: 0,
      startHour: "",
      endHour: "",
      message: `Fant ikke bygg «${resolveBuildingSlug(input?.buildingSlug)}» i DB`,
    };
  }

  const { zone: areaCode } = getElectricityZoneForBuilding(
    toMinimalBuildingForZone(building),
  );
  const effectiveArea = areaCode === "ukjent" ? "NO3" : areaCode;
  const { start, endExclusive, throughOsloYmd } = resolveSyncWindow({
    start: input?.start,
    endExclusive: input?.end,
    throughYesterdayOslo: input?.throughYesterdayOslo,
  });
  const refreshFrom =
    input?.mode === "refresh_recent"
      ? recentOsloDayRefreshStart(throughOsloYmd)
      : null;
  const mpIds = await listMeteringPointIds(building.id);

  const [elByHour, dhByHour, spotByHour] = await Promise.all([
    aggregateElectricityHours(mpIds, start, endExclusive),
    aggregateDistrictHeatingHours(mpIds, start, endExclusive),
    loadSpotPrices(effectiveArea, start, endExclusive),
  ]);

  const operatorId = building.selectedGridOperatorId;
  const county = building.selectedGridOperator?.counties?.[0] ?? "Trøndelag";
  const tariffGroup = primaryEnergyTariffGroup();
  const gridByHour =
    operatorId != null
      ? await loadGridEnergyOrePerKwh(operatorId, county, tariffGroup, start, endExclusive)
      : new Map<string, number>();

  const hourKeys = new Set<string>([...elByHour.keys(), ...dhByHour.keys()]);

  let hoursUpserted = 0;
  for (const key of [...hourKeys].sort()) {
    const hour = new Date(key);
    const electricityKwh = elByHour.get(key) ?? 0;
    const districtHeatingKwh = dhByHour.get(key) ?? 0;

    if (electricityKwh <= 0 && districtHeatingKwh <= 0) continue;

    if (refreshFrom && hour < refreshFrom) {
      continue;
    }

    if (input?.mode !== "refresh_recent") {
      const existing = await prisma.buildingHourlyCostCache.findUnique({
        where: { buildingId_hour: { buildingId: building.id, hour } },
        select: { electricityVolumeKwh: true },
      });
      if (
        existing?.electricityVolumeKwh != null &&
        existing.electricityVolumeKwh > 0
      ) {
        continue;
      }
    }

    const spotHour = spotByHour.get(key);
    const spotKrPerKwh = spotHour?.price ?? 0;
    const spotPriceSource = spotHour?.source ?? null;
    const electricitySpotCost = electricityKwh * spotKrPerKwh;
    const gridOre = gridOreForHour(gridByHour, hour);
    const electricityGridEnergyCost = (electricityKwh * gridOre) / 100;
    const electricityConsumptionTaxCost =
      electricityKwh * CONSUMPTION_TAX_KR_PER_KWH;
    const electricityTotalCost =
      electricitySpotCost +
      electricityGridEnergyCost +
      electricityConsumptionTaxCost;

    await prisma.buildingHourlyCostCache.upsert({
      where: { buildingId_hour: { buildingId: building.id, hour } },
      create: {
        buildingId: building.id,
        hour,
        electricityVolumeKwh: electricityKwh || null,
        electricitySpotCost,
        electricityGridEnergyCost,
        electricityConsumptionTaxCost,
        electricityFixedAllocKr: 0,
        electricityTotalCost,
        electricityPriceNokPerKwh:
          electricityKwh > 0 ? electricityTotalCost / electricityKwh : null,
        districtHeatingVolumeKwh: districtHeatingKwh || null,
        districtHeatingTotalCost: 0,
        spotPriceSource,
        rollupSource: BHCC_ROLLUP_SOURCE,
      },
      update: {
        electricityVolumeKwh: electricityKwh || null,
        electricitySpotCost,
        electricityGridEnergyCost,
        electricityConsumptionTaxCost,
        electricityTotalCost,
        electricityPriceNokPerKwh:
          electricityKwh > 0 ? electricityTotalCost / electricityKwh : null,
        districtHeatingVolumeKwh: districtHeatingKwh || null,
        spotPriceSource,
        rollupSource: BHCC_ROLLUP_SOURCE,
        calculatedAt: new Date(),
      },
    });
    hoursUpserted += 1;
  }

  return {
    success: true,
    buildingId: building.id,
    areaCode: effectiveArea,
    hoursProcessed: hourKeys.size,
    hoursUpserted,
    startHour: start.toISOString(),
    endHour: endExclusive.toISOString(),
    message: `Oppdaterte ${hoursUpserted} timer i buildingHourlyCostCache (t.o.m. ${throughOsloYmd} Oslo)`,
  };
}
