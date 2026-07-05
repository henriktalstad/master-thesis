import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { EnergyPriceSource } from "@/generated/client/enums";
import { aggregateHourlyToDaily } from "@/lib/energy-prices/derive-energy-price-aggregates";
import { utcDayMidnight } from "@/lib/energy-prices/day-utils";
import {
  filterRowsToEvalWindow,
  parseNordPoolCsv,
} from "@/lib/energy-prices/parse-nord-pool-csv";
import { getThesisEvalWindow } from "@/lib/config/thesis-eval";
import { resolveThesisAreaCode } from "@/lib/thesis/resolve-thesis-area-code";
import { aggregateEnergyPrices } from "@/services/entsoe/aggregate-energy-prices";
import type { PricePoint } from "@/services/entsoe/get-day-ahead-prices";

export type ImportNordPoolCsvResult = {
  success: boolean;
  areaCode: string;
  csvPath: string;
  rowsParsed: number;
  rowsImported: number;
  dailyRows: number;
  skippedRows: number;
  priceUnit: string;
  evalWindowApplied: boolean;
  message: string;
};

export async function importNordPoolCsv(input?: {
  csvPath?: string;
  areaCode?: string;
  clipToEvalWindow?: boolean;
}): Promise<ImportNordPoolCsvResult> {
  const csvPath = resolve(
    input?.csvPath?.trim() ||
      process.env.SPOTPRICES_CSV_PATH?.trim() ||
      "",
  );

  if (!csvPath) {
    return {
      success: false,
      areaCode: "",
      csvPath: "",
      rowsParsed: 0,
      rowsImported: 0,
      dailyRows: 0,
      skippedRows: 0,
      priceUnit: "",
      evalWindowApplied: false,
      message: "SPOTPRICES_CSV_PATH mangler",
    };
  }

  const areaCode = input?.areaCode ?? (await resolveThesisAreaCode());
  const csvText = await readFile(csvPath, "utf8");
  const parsed = parseNordPoolCsv(csvText, areaCode);

  const clip = input?.clipToEvalWindow !== false;
  const { start, end } = getThesisEvalWindow();
  const rows =
    clip && (start || end)
      ? filterRowsToEvalWindow(parsed.rows, start, end)
      : parsed.rows;

  const hourlyPoints = rows.map(
    (r) =>
      ({
        date: r.date,
        price: r.price,
        area: r.areaCode,
        areaCode: r.areaCode,
        type: "HOURLY" as const,
      }) satisfies PricePoint & { type: "HOURLY" },
  );

  const dailyByOsloDay = new Map<string, PricePoint & { type: "DAILY" }>();
  const byDay = new Map<string, PricePoint[]>();
  for (const row of rows) {
    const list = byDay.get(row.osloYmd) ?? [];
    list.push(row);
    byDay.set(row.osloYmd, list);
  }
  for (const [osloYmd, dayRows] of byDay) {
    const dayUtc = utcDayMidnight(new Date(`${osloYmd}T00:00:00.000Z`));
    const daily = aggregateHourlyToDaily(dayRows, dayUtc);
    if (daily) {
      dailyByOsloDay.set(osloYmd, { ...daily, type: "DAILY" });
    }
  }

  const allPoints = [
    ...hourlyPoints,
    ...dailyByOsloDay.values(),
  ] as Array<
    | (PricePoint & { type: "HOURLY" })
    | (PricePoint & { type: "DAILY" })
  >;

  if (allPoints.length === 0) {
    return {
      success: false,
      areaCode,
      csvPath,
      rowsParsed: parsed.rows.length,
      rowsImported: 0,
      dailyRows: 0,
      skippedRows: parsed.skippedRows,
      priceUnit: parsed.priceUnit,
      evalWindowApplied: clip && Boolean(start || end),
      message: "Ingen rader etter filtrering — sjekk THESIS_EVAL_* og CSV-format",
    };
  }

  const saved = await aggregateEnergyPrices(allPoints, {
    writePolicy: "upsert",
    source: EnergyPriceSource.NORD_POOL,
  });

  return {
    success: true,
    areaCode,
    csvPath,
    rowsParsed: parsed.rows.length,
    rowsImported: saved,
    dailyRows: dailyByOsloDay.size,
    skippedRows: parsed.skippedRows,
    priceUnit: parsed.priceUnit,
    evalWindowApplied: clip && Boolean(start || end),
    message: `Importerte ${saved} prispunkter (NORD_POOL) for ${areaCode}`,
  };
}
