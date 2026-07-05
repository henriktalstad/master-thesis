import "server-only";

import {
  isOsloDayAheadPriceDayComplete,
  loadHourlyPricesForOsloDays,
  osloDaysCoveringInstantRange,
  pricedControlHourKeysFromRows,
} from "@/lib/energy-prices/oslo-day-price-coverage";
import { addDaysToYmd, osloYmdFromDate } from "@/lib/utils";
import { controlHourKeyFromIso } from "./control-time-buckets";

export { isOsloDayAheadPriceDayComplete as isDayAheadPriceDayComplete };

export type ControlForecastCoverage = {
  areaCode: string | null;
  forwardHourKeys: string[];
  pricedForwardHours: number;
  missingForwardPriceHours: number;
  /** Mangler innen day-ahead-vindu (Oslo i dag + i morgen), ikke hele 48t-prognosen. */
  missingDayAheadForwardHours: number;
  needsEnergyPriceSync: boolean;
  todayComplete: boolean;
  tomorrowComplete: boolean;
};

export async function assessControlForecastCoverage(input: {
  areaCode: string | null;
  forwardHourKeys: readonly string[];
}): Promise<ControlForecastCoverage> {
  const areaCode = input.areaCode;
  if (!areaCode || areaCode === "ukjent") {
    return {
      areaCode,
      forwardHourKeys: [...input.forwardHourKeys],
      pricedForwardHours: 0,
      missingForwardPriceHours: input.forwardHourKeys.length,
      missingDayAheadForwardHours: input.forwardHourKeys.length,
      needsEnergyPriceSync: input.forwardHourKeys.length > 0,
      todayComplete: false,
      tomorrowComplete: false,
    };
  }

  const todayOslo = osloYmdFromDate(new Date());
  const tomorrowOslo = addDaysToYmd(todayOslo, 1);
  const [todayComplete, tomorrowComplete] = await Promise.all([
    isOsloDayAheadPriceDayComplete(areaCode, todayOslo),
    isOsloDayAheadPriceDayComplete(areaCode, tomorrowOslo),
  ]);

  const nowMs = Date.now();
  const futureKeys = input.forwardHourKeys.filter(
    (key) => new Date(key).getTime() > nowMs,
  );

  const osloDaysForPrices =
    futureKeys.length > 0
      ? osloDaysCoveringInstantRange(
          new Date(nowMs),
          new Date(
            Math.max(
              ...futureKeys.map((key) => new Date(key).getTime()),
            ),
          ),
        )
      : [];

  const spotRows =
    osloDaysForPrices.length > 0
      ? await loadHourlyPricesForOsloDays(areaCode, osloDaysForPrices)
      : [];

  const pricedKeys = pricedControlHourKeysFromRows(spotRows);

  const pricedForwardHours = futureKeys.filter((key) =>
    pricedKeys.has(controlHourKeyFromIso(key)),
  ).length;
  const missingForwardPriceHours = futureKeys.length - pricedForwardHours;

  const dayAheadOsloDays = new Set([todayOslo, tomorrowOslo]);
  const missingDayAheadForwardHours = futureKeys.filter((key) => {
    if (!dayAheadOsloDays.has(osloYmdFromDate(new Date(key)))) return false;
    return !pricedKeys.has(controlHourKeyFromIso(key));
  }).length;

  return {
    areaCode,
    forwardHourKeys: [...input.forwardHourKeys],
    pricedForwardHours,
    missingForwardPriceHours,
    missingDayAheadForwardHours,
    needsEnergyPriceSync:
      !todayComplete ||
      !tomorrowComplete ||
      missingDayAheadForwardHours > 0,
    todayComplete,
    tomorrowComplete,
  };
}
