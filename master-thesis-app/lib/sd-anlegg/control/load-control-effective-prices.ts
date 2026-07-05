import "server-only";

import { prisma } from "@/lib/db";
import { controlHourKeyFromIso } from "./control-time-buckets";
import type { ControlHourlyPrice } from "./control-types";
import {
  deriveMarginalAddonKrPerKwh,
  hourKeyToIsoUtc,
  hourUtcFromPriceRow,
} from "./control-effective-price-utils";
import {
  gridMarginalAddonKrPerKwh,
  gridOreForHour,
  loadGridEnergyOreByHour,
  resolveGridTariffMarginalContext,
} from "./grid-tariff-marginal";

export {
  buildControlForwardPrices,
  deriveMarginalAddonKrPerKwh,
} from "./control-effective-price-utils";

export async function loadControlEffectivePrices(input: {
  buildingId: string;
  areaCode: string | null;
  since: Date;
  forwardUntil: Date;
}): Promise<{
  prices: ControlHourlyPrice[];
  dayAheadHourCount: number;
  marginalAddonKrPerKwh: number;
  forwardMarginalSource: "grid_tariff" | "bhcc_median";
}> {
  const nowMs = Date.now();

  const gridContext = await resolveGridTariffMarginalContext(input.buildingId);
  const gridByHour = gridContext
    ? await loadGridEnergyOreByHour({
        context: gridContext,
        since: input.since,
        until: input.forwardUntil,
      })
    : new Map<string, number>();
  const hasGridTariff = gridByHour.size > 0;

  const [spotRows, bhccRows] = await Promise.all([
    input.areaCode && input.areaCode !== "ukjent"
      ? prisma.hourlyEnergyPrices.findMany({
          where: {
            areaCode: input.areaCode,
            date: { gte: input.since, lte: input.forwardUntil },
          },
          orderBy: [{ date: "asc" }, { hour: "asc" }],
          select: { date: true, hour: true, price: true },
        })
      : Promise.resolve([]),
    prisma.buildingHourlyCostCache.findMany({
      where: {
        buildingId: input.buildingId,
        hour: { gte: input.since },
      },
      orderBy: { hour: "asc" },
      select: {
        hour: true,
        electricityVolumeKwh: true,
        electricitySpotCost: true,
        electricityGridEnergyCost: true,
        electricityConsumptionTaxCost: true,
        electricityPriceNokPerKwh: true,
      },
    }),
  ]);

  const marginalAddonKrPerKwh = deriveMarginalAddonKrPerKwh(bhccRows);

  const bhccByKey = new Map<
    string,
    {
      effectiveMarginalKrPerKwh: number | null;
      spotKrPerKwh: number | null;
    }
  >();

  for (const row of bhccRows) {
    const key = controlHourKeyFromIso(row.hour.toISOString());
    const kwh = row.electricityVolumeKwh ?? 0;
    const spotKrPerKwh =
      kwh > 0 ? row.electricitySpotCost / kwh : null;
    const effectiveMarginalKrPerKwh =
      row.electricityPriceNokPerKwh != null && row.electricityPriceNokPerKwh > 0
        ? row.electricityPriceNokPerKwh
        : spotKrPerKwh != null
          ? spotKrPerKwh + marginalAddonKrPerKwh
          : null;
    bhccByKey.set(key, { effectiveMarginalKrPerKwh, spotKrPerKwh });
  }

  const spotByKey = new Map<string, number>();
  for (const row of spotRows) {
    if (!row.date || row.hour == null || row.price == null) continue;
    const iso = hourUtcFromPriceRow(row.date, row.hour);
    spotByKey.set(controlHourKeyFromIso(iso), row.price);
  }

  const allKeys = new Set<string>([
    ...bhccByKey.keys(),
    ...spotByKey.keys(),
  ]);

  let dayAheadHourCount = 0;
  const prices: ControlHourlyPrice[] = [...allKeys]
    .toSorted()
    .map((key) => {
      const hourIso = hourKeyToIsoUtc(key);
      const hourMs = new Date(hourIso).getTime();
      const spotFromDb = spotByKey.get(key) ?? null;
      const bhcc = bhccByKey.get(key);

      const isFuture = hourMs > nowMs;
      const isDayAheadSpot = isFuture && spotFromDb != null;

      if (isDayAheadSpot) dayAheadHourCount += 1;

      let effectiveMarginalKrPerKwh: number | null = null;
      if (bhcc?.effectiveMarginalKrPerKwh != null && !isFuture) {
        effectiveMarginalKrPerKwh = bhcc.effectiveMarginalKrPerKwh;
      } else if (spotFromDb != null) {
        const hourDate = new Date(hourIso);
        const gridAddon = hasGridTariff
          ? gridMarginalAddonKrPerKwh(gridOreForHour(gridByHour, hourDate))
          : null;
        const addon = gridAddon ?? marginalAddonKrPerKwh;
        effectiveMarginalKrPerKwh = spotFromDb + addon;
      } else if (bhcc?.effectiveMarginalKrPerKwh != null) {
        effectiveMarginalKrPerKwh = bhcc.effectiveMarginalKrPerKwh;
      }

      return {
        hour: hourIso,
        spotKrPerKwh: spotFromDb ?? bhcc?.spotKrPerKwh ?? null,
        effectiveMarginalKrPerKwh,
        isDayAheadSpot,
      };
    });

  return {
    prices,
    dayAheadHourCount,
    marginalAddonKrPerKwh,
    forwardMarginalSource: hasGridTariff ? "grid_tariff" : "bhcc_median",
  };
}
