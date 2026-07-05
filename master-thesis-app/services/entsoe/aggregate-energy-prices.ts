import { EnergyPriceSource } from "@/generated/client/enums";
import { filterPricesForSourceIngest } from "@/lib/energy-prices/filter-prices-by-source";
import type { QuarterHourlyPricePoint } from "@/lib/energy-prices/derive-energy-price-aggregates";
import { PricePoint } from "./get-day-ahead-prices";
import { ingestEnergyPrices } from "./ingest-energy-prices";

export type EnhancedPricePoint =
  | (QuarterHourlyPricePoint & { type: "QUARTER_HOURLY" })
  | (PricePoint & { type: "HOURLY" })
  | (PricePoint & { type: "DAILY" });

export type AggregateWritePolicy = "upsert" | "insertOnly";

interface EnergyPrice {
  date: string;
  price: number;
  areaCode: string;
  region: string;
  type: "QUARTER_HOURLY" | "HOURLY" | "DAILY";
  hour?: number;
  quarter?: number;
}

interface GroupedPrices {
  QUARTER_HOURLY: Array<QuarterHourlyPricePoint & { type: "QUARTER_HOURLY" }>;
  HOURLY: Array<PricePoint & { type: "HOURLY" }>;
  DAILY: Array<PricePoint & { type: "DAILY" }>;
}

export type AggregateEnergyPricesOptions = {
  writePolicy?: AggregateWritePolicy;
  source?: EnergyPriceSource;
};

export async function aggregateEnergyPrices(
  prices: EnhancedPricePoint[],
  options?: AggregateEnergyPricesOptions,
): Promise<number> {
  const writePolicy: AggregateWritePolicy = options?.writePolicy ?? "insertOnly";
  const source: EnergyPriceSource = options?.source ?? EnergyPriceSource.ENTSOE;

  const groupedPrices = prices.reduce<GroupedPrices>(
    (acc, price) => {
      if (price.type === "QUARTER_HOURLY") {
        acc.QUARTER_HOURLY.push(price);
      } else if (price.type === "HOURLY") {
        acc.HOURLY.push(price);
      } else {
        acc.DAILY.push(price);
      }
      return acc;
    },
    { QUARTER_HOURLY: [], HOURLY: [], DAILY: [] },
  );

  const transformedData: EnergyPrice[] = [
    ...groupedPrices.QUARTER_HOURLY.map(transformQuarterHourly),
    ...groupedPrices.HOURLY.map(transformHourlyOrDaily),
    ...groupedPrices.DAILY.map(transformHourlyOrDaily),
  ];

  console.log(
    `Transformert ${groupedPrices.QUARTER_HOURLY.length} 15-min, ${groupedPrices.HOURLY.length} time, ${groupedPrices.DAILY.length} dag`,
  );

  let toStore = transformedData;
  if (writePolicy === "insertOnly" && toStore.length > 0) {
    toStore = await filterPricesForSourceIngest(toStore, source);
  }

  if (toStore.length > 0) {
    await ingestEnergyPrices(toStore, { source });
  }

  return toStore.length;
}

function transformQuarterHourly(
  price: QuarterHourlyPricePoint & { type: "QUARTER_HOURLY" },
): EnergyPrice {
  return {
    date: price.date,
    price: price.price,
    areaCode: price.areaCode,
    region: price.area,
    type: "QUARTER_HOURLY",
    hour: price.hour,
    quarter: price.quarter,
  };
}

function transformHourlyOrDaily(
  price: (PricePoint & { type: "HOURLY" }) | (PricePoint & { type: "DAILY" }),
): EnergyPrice {
  return {
    date: price.date,
    price: price.price,
    areaCode: price.areaCode,
    region: price.area,
    type: price.type,
  };
}
