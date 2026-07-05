import { prisma } from "@/lib/db";
import {
  countOsloDayHourlyPrices,
  forwardOsloDeliveryDays,
  loadHourlyPricesForOsloDays,
  pricedControlHourKeysFromRows,
} from "@/lib/energy-prices/oslo-day-price-coverage";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import { getUtcSlotsForOsloDay, osloYmdFromDate } from "@/lib/utils";
import { resolveThesisAreaCode } from "@/lib/thesis/resolve-thesis-area-code";

async function main() {
  const areaCode = await resolveThesisAreaCode();
  const now = new Date();
  const todayOslo = osloYmdFromDate(now);
  const tomorrowOslo = forwardOsloDeliveryDays(now)[2]!;

  console.log("=== Validering UTC ↔ Oslo for spotpriser ===");
  console.log("areaCode:", areaCode, "now:", now.toISOString());
  console.log("Oslo i dag:", todayOslo, "| i morgen:", tomorrowOslo);

  for (const osloYmd of [todayOslo, tomorrowOslo]) {
    const dayCoverage = await countOsloDayHourlyPrices(areaCode, osloYmd);
    const slots = getUtcSlotsForOsloDay(osloYmd);
    console.log(`\nOslo-dag ${osloYmd}:`, dayCoverage);
    console.log(
      "  UTC-slots:",
      `${slots[0]?.date}T${String(slots[0]?.hour).padStart(2, "0")}`,
      "→",
      `${slots.at(-1)?.date}T${String(slots.at(-1)?.hour).padStart(2, "0")}`,
      `(${slots.length} timer)`,
    );
  }

  const horizonHours = 48;
  const forecastKeys = Array.from({ length: horizonHours }, (_, i) => {
    const t = now.getTime() + (i + 1) * 3_600_000;
    return new Date(t).toISOString();
  });

  const osloDays = [todayOslo, tomorrowOslo, forwardOsloDeliveryDays(now)[0]!];
  const rows = await loadHourlyPricesForOsloDays(areaCode, osloDays);
  const keys = pricedControlHourKeysFromRows(rows);
  const futureKeys = forecastKeys.filter((k) => new Date(k).getTime() > now.getTime());
  const matched = futureKeys.filter((k) =>
    keys.has(controlHourKeyFromIso(k)),
  ).length;

  console.log("\n=== Fremover-dekning (Oslo-basert) ===");
  console.log({
    pricedForwardHours: matched,
    missingForwardPriceHours: futureKeys.length - matched,
    todayComplete: (await countOsloDayHourlyPrices(areaCode, todayOslo)).complete,
    tomorrowComplete: (await countOsloDayHourlyPrices(areaCode, tomorrowOslo))
      .complete,
    dbRowsLoaded: rows.length,
    pricedKeys: keys.size,
    futureForecastHours: futureKeys.length,
  });

  await prisma.$disconnect();
}

main();
