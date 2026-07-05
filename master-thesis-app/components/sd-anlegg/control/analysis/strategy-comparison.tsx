"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { ControlStrategyComparison } from "@/lib/sd-anlegg/control/build-control-strategy-comparison";
import {
  CONTROL_COMFORT_EXTRACT,
  CONTROL_EFFECT_UI,
  controlStrategyComparisonScopeNote,
  controlStrategyComparisonScopeDetail,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlClaimBadge } from "@/components/sd-anlegg/control/shared/claim-badge";
import type { ControlClaimKind } from "@/lib/sd-anlegg/control/control-claim-kinds";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  comparison: ControlStrategyComparison;
  className?: string;
  buildingSlug?: string;
  proxyObservedCostKr?: number | null;
  measuredBuildingCostKr?: number | null;
};

const CLAIM_BY_ROW: Record<
  ControlStrategyComparison["rows"][number]["id"],
  ControlClaimKind
> = {
  observed: "observed",
  predicted: "emulated",
  demand: "simulated",
  simulated: "simulated",
};

function formatKr(value: number): string {
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kr`;
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value} %`;
}

function formatOptional(value: number | null, suffix = ""): string {
  if (value == null) return "—";
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 0 })}${suffix}`;
}

export function SdAnleggControlStrategyComparison({
  comparison,
  className,
  buildingSlug,
  proxyObservedCostKr = null,
  measuredBuildingCostKr = null,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scopeNote = controlStrategyComparisonScopeNote(buildingSlug);
  const scopeDetail = controlStrategyComparisonScopeDetail(
    proxyObservedCostKr,
    measuredBuildingCostKr,
    comparison.stepCount,
  );
  const observedHeat =
    comparison.rows.find((r) => r.id === "observed")?.controllableHeatKwh ?? null;
  const demandRow = comparison.rows.find((r) => r.id === "demand");
  const demandScopeWarning =
    demandRow &&
    observedHeat != null &&
    demandRow.controllableHeatKwh != null &&
    demandRow.controllableHeatKwh < observedHeat * 0.5;

  return (
    <section
      aria-label="Sammenligning av strategier"
      className={cn(SD_ANLEGG_CARD, "overflow-hidden", className)}
    >
      <div className="border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {CONTROL_EFFECT_UI.strategyTableTitle}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {scopeNote}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium sm:px-5">
                {CONTROL_EFFECT_UI.strategyColumn}
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                {CONTROL_EFFECT_UI.costColumn}
              </th>
              <th
                className="px-3 py-2.5 text-right font-medium"
                title={CONTROL_EFFECT_UI.deltaColumnHint}
              >
                {CONTROL_EFFECT_UI.deltaColumn}
              </th>
              <th
                className="px-3 py-2.5 text-right font-medium sm:pr-5"
                title={CONTROL_EFFECT_UI.comfortColumnHint}
              >
                {CONTROL_EFFECT_UI.comfortColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => {
              const isMpc = row.id === "simulated";
              const improvedVsEmulated =
                isMpc &&
                row.deltaCostVsEmulatedPct != null &&
                row.deltaCostVsEmulatedPct < 0;
              const improvedVsObserved =
                !isMpc && row.deltaCostVsObservedPct < 0;
              const improved = improvedVsEmulated || improvedVsObserved;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/40 last:border-0",
                    isMpc && "bg-primary/4 dark:bg-primary/8",
                  )}
                >
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground">
                        {row.label}
                      </span>
                      <SdAnleggControlClaimBadge kind={CLAIM_BY_ROW[row.id]} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">
                    {formatKr(row.totalCostKr)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.id === "observed" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={
                            improved
                              ? "font-semibold text-emerald-600 dark:text-emerald-400"
                              : row.deltaCostVsObservedPct > 0
                                ? "text-amber-800 dark:text-amber-200"
                                : undefined
                          }
                        >
                          {formatPct(row.deltaCostVsObservedPct)}
                        </span>
                        {isMpc &&
                        row.deltaCostVsEmulatedPct != null &&
                        Math.abs(
                          row.deltaCostVsEmulatedPct -
                            row.deltaCostVsObservedPct,
                        ) > 0.05 ? (
                          <span className="text-[10px] text-muted-foreground">
                            {formatPct(row.deltaCostVsEmulatedPct)} vs forventet
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums sm:pr-5">
                    {formatOptional(
                      row.comfortViolations,
                      CONTROL_COMFORT_EXTRACT.violationsSuffix,
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border/40 px-4 py-2.5 sm:px-5">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {CONTROL_EFFECT_UI.deltaColumnHint} {CONTROL_COMFORT_EXTRACT.columnHint}
        </p>
      </div>

      {demandScopeWarning ? (
        <div className="flex items-start gap-2 border-t border-amber-500/25 bg-amber-500/8 px-4 py-2.5 text-[11px] leading-relaxed text-amber-950 dark:text-amber-100 sm:px-5">
          <AlertTriangle
            className="mt-0.5 size-3.5 shrink-0 opacity-80"
            aria-hidden
          />
          <p>
            Prisregler-rad bruker smalere varmemodell — ikke sammenlign varme
            direkte med de andre.
          </p>
        </div>
      ) : null}

      <div className="border-t border-border/50">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className={cn(
            "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[11px] text-muted-foreground transition-colors duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/25 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground sm:px-5",
            SD_ANLEGG_BTN_PRESS,
          )}
        >
          <span>
            {detailsOpen
              ? "Skjul detaljer for fagfolk"
              : "Vis detaljer for fagfolk"}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out",
              detailsOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {detailsOpen ? (
          <div className="space-y-4 border-t border-border/40 px-4 pb-4 pt-3 sm:px-5">
            {scopeDetail ? (
              <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {scopeDetail}
              </p>
            ) : null}

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-foreground">
                Energi og effekt
              </p>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full min-w-[320px] text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Strategi</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Topp effekt
                      </th>
                      <th className="px-3 py-2 text-right font-medium">El</th>
                      <th className="px-3 py-2 text-right font-medium">Varme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border/40 last:border-0 tabular-nums"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {row.label}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.peakElectricKw.toFixed(1)} kW
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatOptional(row.controllableElectricKwh, " kWh")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatOptional(row.controllableHeatKwh, " kWh")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-foreground">
                Strategier
              </p>
              <dl className="space-y-2.5">
                {comparison.rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-0.5 sm:grid-cols-[4.5rem_1fr]"
                  >
                    <dt className="text-[11px] font-medium text-foreground">
                      {row.label}
                    </dt>
                    <dd className="text-[11px] leading-relaxed text-muted-foreground">
                      {row.description}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-[10px] leading-relaxed text-muted-foreground/90">
                {CONTROL_COMFORT_EXTRACT.modelNote}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
