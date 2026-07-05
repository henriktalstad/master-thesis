import {
  anchorDateForOsloDeliveryDay,
  forwardOsloDeliveryDays,
  isOsloDayAheadPriceDayComplete,
} from "@/lib/energy-prices/oslo-day-price-coverage";
import {
  aggregateEnergyPrices,
  type EnhancedPricePoint,
} from "@/services/entsoe/aggregate-energy-prices";
import {
  AREA_CODE_MAP,
  getDayAheadPriceBundle,
} from "@/services/entsoe/get-day-ahead-prices";
import { resolveThesisAreaCode } from "@/lib/thesis/resolve-thesis-area-code";

export type SyncEnergyPricesResult = {
  success: boolean;
  savedPricesCount: number;
  durationMs: number;
  message: string;
  areaCode: string;
  daysSynced: string[];
  mode: "forward";
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bundleToEnhancedPoints(
  bundle: Awaited<ReturnType<typeof getDayAheadPriceBundle>>,
): EnhancedPricePoint[] {
  const out: EnhancedPricePoint[] = [];
  for (const q of bundle.quarterHourly) {
    out.push({ ...q, type: "QUARTER_HOURLY" });
  }
  for (const h of bundle.hourly) {
    out.push({ ...h, type: "HOURLY" });
  }
  if (bundle.daily) {
    out.push({ ...bundle.daily, type: "DAILY" });
  }
  return out;
}

async function fetchDayAheadBundleWithRetry(
  areaCode: string,
  forDate: Date,
  maxAttempts = 3,
): Promise<EnhancedPricePoint[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const bundle = await getDayAheadPriceBundle(areaCode, forDate, "A01");
      if (!bundle.quarterHourly.length && !bundle.hourly.length) {
        // Acknowledgement / not yet published — retry does not help.
        return [];
      }
      return bundleToEnhancedPoints(bundle);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts - 1) break;
      await sleep(500 * 2 ** attempt + Math.random() * 400);
    }
  }
  console.warn(
    "[sync-energy-prices] fetch failed:",
    lastError instanceof Error ? lastError.message : lastError,
  );
  return [];
}

async function isDayPriceComplete(
  areaCode: string,
  osloYmd: string,
): Promise<boolean> {
  return isOsloDayAheadPriceDayComplete(areaCode, osloYmd);
}

export async function syncEnergyPrices(): Promise<SyncEnergyPricesResult> {
  const startTime = Date.now();
  const areaCode = await resolveThesisAreaCode();

  if (!Object.values(AREA_CODE_MAP).includes(areaCode)) {
    return {
      success: false,
      savedPricesCount: 0,
      durationMs: Date.now() - startTime,
      message: `Ugyldig prisområde: ${areaCode}`,
      areaCode,
      daysSynced: [],
      mode: "forward",
    };
  }

  const forwardOsloDays = forwardOsloDeliveryDays();
  const allPrices: EnhancedPricePoint[] = [];
  const daysSynced: string[] = [];

  for (const osloYmd of forwardOsloDays) {
    if (await isDayPriceComplete(areaCode, osloYmd)) continue;

    const points = await fetchDayAheadBundleWithRetry(
      areaCode,
      anchorDateForOsloDeliveryDay(osloYmd),
    );
    if (!points.length) continue;

    allPrices.push(...points);
    daysSynced.push(osloYmd);
  }

  if (allPrices.length === 0) {
    return {
      success: true,
      savedPricesCount: 0,
      durationMs: Date.now() - startTime,
      message: `Fremover-dekning OK for ${areaCode} (historikk via NORD_POOL CSV)`,
      areaCode,
      daysSynced,
      mode: "forward",
    };
  }

  const savedPricesCount = await aggregateEnergyPrices(allPrices);

  return {
    success: true,
    savedPricesCount,
    durationMs: Date.now() - startTime,
    message: `Lagret ${savedPricesCount} ENTSO-E prispunkter for ${areaCode} (${daysSynced.join(", ")})`,
    areaCode,
    daysSynced,
    mode: "forward",
  };
}
