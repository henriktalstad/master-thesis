export const ELECTRICITY_CONSUMPTION_TAX_KR = Number(
  process.env.ELECTRICITY_CONSUMPTION_TAX_KR ?? "0.2196",
);

import { osloHourFromDate, osloYmdFromDate } from "@/lib/utils";

function osloYearMonthFromDate(date: Date): string {
  return osloYmdFromDate(date).slice(0, 7);
}

/** Slår opp energiledd (øre/kWh) for en UTC-time — direkte treff eller samme Oslo-time i måneden. */
export function gridOreForHour(
  gridByTimestamp: ReadonlyMap<string, number>,
  hour: Date,
): number | null {
  const direct = gridByTimestamp.get(hour.toISOString());
  if (direct != null) return direct;

  const targetYm = osloYearMonthFromDate(hour);
  const targetOsloHour = osloHourFromDate(hour);
  for (const [ts, ore] of gridByTimestamp) {
    const d = new Date(ts);
    if (
      osloYearMonthFromDate(d) === targetYm &&
      osloHourFromDate(d) === targetOsloHour
    ) {
      return ore;
    }
  }
  return null;
}

/** Nettleie energiledd + forbruksavgift per kWh (kr). */
export function gridMarginalAddonKrPerKwh(
  energyLinkOre: number | null,
): number | null {
  if (energyLinkOre == null || !Number.isFinite(energyLinkOre)) return null;
  return (
    Math.round((energyLinkOre / 100 + ELECTRICITY_CONSUMPTION_TAX_KR) * 1000) /
    1000
  );
}
