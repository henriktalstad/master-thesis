import { controlHourKeyFromIso } from "./control-time-buckets";
import type { ControlHourlyPrice } from "./control-types";

type BhccMarginalRow = {
  hour: Date;
  electricityVolumeKwh: number | null;
  electricitySpotCost: number;
  electricityGridEnergyCost: number;
  electricityConsumptionTaxCost: number;
  electricityPriceNokPerKwh: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

/** Marginal tillegg (nettleie energiledd + forbruksavgift) per kWh fra BHCC. */
export function deriveMarginalAddonKrPerKwh(
  rows: readonly BhccMarginalRow[],
): number {
  const addons: number[] = [];
  for (const row of rows) {
    const kwh = row.electricityVolumeKwh ?? 0;
    if (kwh <= 0.05) continue;
    const addon =
      (row.electricityGridEnergyCost +
        row.electricityConsumptionTaxCost) /
      kwh;
    if (Number.isFinite(addon) && addon >= 0 && addon < 5) {
      addons.push(addon);
    }
  }
  const med = median(addons);
  return med != null ? Math.round(med * 1000) / 1000 : 0.12;
}

type ControlPriceSeriesInput =
  | readonly ControlHourlyPrice[]
  | {
      prices?: readonly ControlHourlyPrice[];
    };

function isWrappedControlPrices(
  input: ControlPriceSeriesInput,
): input is { prices?: readonly ControlHourlyPrice[] } {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function resolveControlHourlyPriceSeries(
  input: ControlPriceSeriesInput,
): readonly ControlHourlyPrice[] {
  if (isWrappedControlPrices(input)) {
    return input.prices ?? [];
  }
  return input;
}

/** Priser for prognosevindu — day-ahead spot fra DB, ikke median-gjetting. */
export function buildControlForwardPrices(
  allPrices: ControlPriceSeriesInput,
  forecastHours: readonly { hour: string }[],
): ControlHourlyPrice[] {
  const series = resolveControlHourlyPriceSeries(allPrices);
  const byKey = new Map(
    series.map((p) => [controlHourKeyFromIso(p.hour), p]),
  );

  return forecastHours.map((row) => {
    const key = controlHourKeyFromIso(row.hour);
    const existing = byKey.get(key);
    if (existing) return existing;
    return {
      hour: row.hour,
      spotKrPerKwh: null,
      effectiveMarginalKrPerKwh: null,
      isDayAheadSpot: false,
    };
  });
}

export function hourUtcFromPriceRow(date: Date, hour: number): string {
  const utc = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
      0,
      0,
      0,
    ),
  );
  return utc.toISOString();
}

export function hourKeyToIsoUtc(hourKey: string): string {
  const [datePart, hourPart] = hourKey.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d, Number(hourPart), 0, 0, 0),
  ).toISOString();
}
