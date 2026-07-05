import type { ControlImprovementPoint, MpcHourTableRow } from "./control-types";
import { CONTROL_DISPLAY } from "./control-display-labels";

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function formatOsloHourLabel(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatKr(value: number): string {
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 10 ? 2 : 1;
  return `${value.toLocaleString("nb-NO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} kr`;
}

const MIN_SAVINGS_KR = 0.05;

/** Topp timer der simulert MPC slår emulert baseline på kontrollerbar kost-proxy. */
export function buildMpcImprovementPoints(
  rows: readonly MpcHourTableRow[],
  limit = 3,
): ControlImprovementPoint[] {
  if (rows.length === 0) return [];

  const ranked = rows
    .map((row) => ({
      row,
      savingsKr: round2(row.emulatedCostKr - row.mpcCostKr),
    }))
    .filter((item) => item.savingsKr >= MIN_SAVINGS_KR)
    .toSorted((a, b) => b.savingsKr - a.savingsKr)
    .slice(0, limit);

  if (ranked.length === 0) {
    const worst = rows
      .map((row) => ({
        row,
        extraKr: round2(row.mpcCostKr - row.emulatedCostKr),
      }))
      .filter((item) => item.extraKr >= MIN_SAVINGS_KR)
      .toSorted((a, b) => b.extraKr - a.extraKr)[0];

    if (!worst) return [];

    return [
      {
        id: "mpc_cost_increase_hour",
        label: formatOsloHourLabel(worst.row.hour),
        detail: `Simulert forslag kostet ${formatKr(worst.extraKr)} mer enn ${CONTROL_DISPLAY.predicted.short.toLowerCase()} denne timen — komfort eller effektstop kan ha begrenset besparelsen.`,
        hourSpan: null,
        severity: "warning",
        sampleHours: 1,
      },
    ];
  }

  return ranked.map((item, index) => ({
    id: `mpc_top_savings_${index}`,
    label: formatOsloHourLabel(item.row.hour),
    detail: `${CONTROL_DISPLAY.simulatedControl.short} sparte ${formatKr(item.savingsKr)} sammenlignet med ${CONTROL_DISPLAY.predicted.short.toLowerCase()} denne timen.`,
    hourSpan: null,
    severity: index === 0 ? "opportunity" : "info",
    sampleHours: 1,
  }));
}
