"use client";

import type { ScopeBuildingEnergyCompare } from "@/lib/sd-anlegg/control/build-scope-building-energy-compare";
import { cn } from "@/lib/utils";

type Props = {
  compare: ScopeBuildingEnergyCompare | null | undefined;
  className?: string;
  showTechnicalNote?: boolean;
};

function formatKwh(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kWh`;
}

function formatKw(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kW`;
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} %`;
}

export function SdAnleggControlScopeVsBuildingPeak({
  compare,
  className,
  showTechnicalNote = false,
}: Props) {
  if (!compare?.rows.length) return null;

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border/60", className)}>
      <table className="w-full min-w-[560px] text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Energi</th>
            <th className="px-3 py-2 text-right font-medium">Ventilasjon</th>
            <th className="px-3 py-2 text-right font-medium">Hele bygget</th>
            <th className="px-3 py-2 text-right font-medium">Topp vent.</th>
            <th className="px-3 py-2 text-right font-medium">Topp bygg</th>
            <th className="px-3 py-2 text-right font-medium">Andel</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {compare.rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatKwh(row.scopeKwh)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatKwh(row.buildingKwh)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatKw(row.scopePeakKw)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatKw(row.buildingPeakKw)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatPct(row.sharePct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showTechnicalNote && compare.evalLabel ? (
        <p className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          Periode: {compare.evalLabel}
        </p>
      ) : null}
    </div>
  );
}
