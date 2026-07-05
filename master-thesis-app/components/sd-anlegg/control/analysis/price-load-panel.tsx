"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import {
  loadProfileMissingPeakFields,
  type CapacityTariffAnalysis,
} from "@/lib/sd-anlegg/control/build-capacity-tariff-analysis";
import { PRICE_BAND_ORDER, type PriceBand } from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import type { ScopeBuildingEnergyCompare } from "@/lib/sd-anlegg/control/build-scope-building-energy-compare";
import type { ControlLoadHourPoint } from "@/lib/sd-anlegg/control/control-types";
import {
  CONTROL_EFFECT_UI,
  CONTROL_PRICE_LOAD_UI,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlLoadChart } from "@/components/sd-anlegg/control/charts/charts";
import { SdAnleggControlPriceBandChart } from "@/components/sd-anlegg/control/charts/mpc-charts";
import { SdAnleggControlChartCard } from "@/components/sd-anlegg/control/shared/chart-card";
import { SdAnleggControlKpiCard } from "@/components/sd-anlegg/control/shared/kpi-card";
import { SdAnleggControlScopeVsBuildingPeak } from "@/components/sd-anlegg/control/analysis/scope-vs-building-peak";
import { SdAnleggControlCollapsibleSection } from "@/components/sd-anlegg/control/shared/section";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  analysis: PriceLoadShiftAnalysis;
  loadProfile: readonly ControlLoadHourPoint[];
  capacityTariff?: CapacityTariffAnalysis | null;
  scopeBuildingCompare?: ScopeBuildingEnergyCompare | null;
};

const BAND_LABELS: Record<PriceBand, string> = {
  high: "Høy pris",
  medium: "Middels pris",
  low: "Lav pris",
};

function formatKwh(value: number): string {
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} kWh`;
}

function formatKw(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kW`;
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} %`;
}

function formatKr(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr`;
}

function loadShiftSubText(deltaKwh: number, interpretation: string): string {
  const direction =
    Math.abs(deltaKwh) < 0.05
      ? "Lite endring"
      : deltaKwh > 0
        ? `${formatKwh(deltaKwh)} mindre i høypris`
        : `${formatKwh(Math.abs(deltaKwh))} mer i høypris`;
  const note = interpretation.trim();
  if (!note || note.toLowerCase().includes("db-bånd")) {
    return direction;
  }
  return `${direction} · ${note}`;
}

export function SdAnleggControlPriceLoadPanel({
  analysis,
  loadProfile,
  capacityTariff = null,
  scopeBuildingCompare = null,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const shiftPct = analysis.deltaE_hp_pct;
  const improved = shiftPct != null && shiftPct < 0;
  const hasObserved = loadProfile.some((p) => p.observedKw != null);
  const needsPeakRerun = loadProfileMissingPeakFields(loadProfile);

  const thirdKpi = capacityTariff?.evalPeakDeltaPct != null
    ? {
        label: CONTROL_PRICE_LOAD_UI.peakDeltaLabel,
        value: formatPct(capacityTariff.evalPeakDeltaPct),
        sub: `${formatKw(capacityTariff.evalPeakKw.mpc)} vs ${formatKw(capacityTariff.evalPeakKw.emulated)} forventet`,
        valueClassName:
          capacityTariff.evalPeakDeltaPct < 0
            ? "text-emerald-600 dark:text-emerald-400"
            : undefined,
      }
    : {
        label: CONTROL_PRICE_LOAD_UI.highPriceCostLabel,
        value: formatKr(analysis.highPriceCostDeltaKr),
        sub: `${formatKr(analysis.highPriceCostBaselineKr)} forventet → ${formatKr(analysis.highPriceCostMpcKr)} simulert`,
        valueClassName:
          analysis.highPriceCostDeltaKr > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : undefined,
      };

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {CONTROL_PRICE_LOAD_UI.intro}
      </p>

      {needsPeakRerun ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          {CONTROL_PRICE_LOAD_UI.peakRerunBanner}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <SdAnleggControlKpiCard
          label={CONTROL_PRICE_LOAD_UI.loadShiftLabel}
          value={formatPct(shiftPct)}
          sub={loadShiftSubText(analysis.deltaE_hp_kwh, analysis.interpretation)}
          claim="simulated"
          valueClassName={
            improved ? "text-emerald-600 dark:text-emerald-400" : undefined
          }
        />
        <SdAnleggControlKpiCard
          label={CONTROL_PRICE_LOAD_UI.highPriceHoursLabel}
          value={String(analysis.highPriceHours)}
          sub={CONTROL_PRICE_LOAD_UI.loadShiftSubHours}
          claim="simulated"
        />
        <SdAnleggControlKpiCard
          label={thirdKpi.label}
          value={thirdKpi.value}
          sub={thirdKpi.sub}
          claim="simulated"
          valueClassName={thirdKpi.valueClassName}
        />
      </div>

      <section
        aria-label={CONTROL_PRICE_LOAD_UI.energyByBandTitle}
        className={cn(SD_ANLEGG_CARD, "overflow-hidden")}
      >
        <div className="border-b border-border/60 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-foreground">
            {CONTROL_PRICE_LOAD_UI.energyByBandTitle}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {CONTROL_PRICE_LOAD_UI.energyByBandDescription}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Prisnivå</th>
                <th className="px-3 py-2.5 font-medium">Forventet</th>
                <th className="px-3 py-2.5 font-medium">Simulert</th>
                <th className="px-3 py-2.5 font-medium">Forskjell</th>
              </tr>
            </thead>
            <tbody>
              {PRICE_BAND_ORDER.map((band) => {
                const row = analysis.bands[band];
                return (
                  <tr
                    key={band}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {BAND_LABELS[band]}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {formatKwh(row.baselineKwh)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {formatKwh(row.mpcKwh)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {formatKwh(row.deltaKwh)}{" "}
                      <span className="text-muted-foreground">
                        ({formatPct(row.deltaPct)})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/60 px-4 py-4 sm:px-5">
          <SdAnleggControlPriceBandChart analysis={analysis} />
        </div>
      </section>

      {loadProfile.length > 0 ? (
        <SdAnleggControlChartCard
          title={CONTROL_EFFECT_UI.chartLoadTitle}
          description={
            hasObserved
              ? CONTROL_EFFECT_UI.chartLoadDescriptionWithObserved
              : CONTROL_EFFECT_UI.chartLoadDescriptionSimulated
          }
        >
          <SdAnleggControlLoadChart
            loadProfile={loadProfile}
            showPrice
            showObserved={hasObserved}
          />
        </SdAnleggControlChartCard>
      ) : null}

      {capacityTariff ? (
        <SdAnleggControlCollapsibleSection
          title={CONTROL_PRICE_LOAD_UI.capacityTariffTitle}
          description={CONTROL_PRICE_LOAD_UI.capacityTariffDescription}
          defaultOpen={false}
        >
          <div className="space-y-4">
            {capacityTariff.missingTariffMonths.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Mangler nettleie for{" "}
                {capacityTariff.missingTariffMonths.join(", ")}
                {capacityTariff.tariffSyncedOnMiss
                  ? " (synk forsøkt automatisk)"
                  : ""}
                . Velg nettoperatør og synk nettleie for bygget.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <SdAnleggControlKpiCard
                label="Effekttopp forventet"
                value={formatKw(capacityTariff.evalPeakKw.emulated)}
                sub="Maks kW per time"
                claim="simulated"
                compact
              />
              <SdAnleggControlKpiCard
                label="Effekttopp simulert"
                value={formatKw(capacityTariff.evalPeakKw.mpc)}
                sub={
                  capacityTariff.evalPeakDeltaKw != null
                    ? `${capacityTariff.evalPeakDeltaKw > 0 ? "+" : ""}${capacityTariff.evalPeakDeltaKw} kW vs forventet`
                    : undefined
                }
                claim="simulated"
                compact
                valueClassName={
                  capacityTariff.evalPeakDeltaKw != null &&
                  capacityTariff.evalPeakDeltaKw < 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : undefined
                }
              />
              <SdAnleggControlKpiCard
                label="Estimert effektkost"
                value={formatKr(capacityTariff.estimatedCapacityCostKr.deltaKr)}
                sub={`${formatKr(capacityTariff.estimatedCapacityCostKr.emulated)} → ${formatKr(capacityTariff.estimatedCapacityCostKr.mpc)}`}
                claim="simulated"
                compact
              />
            </div>
            {capacityTariff.monthlyRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full min-w-[480px] text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Måned</th>
                      <th className="px-3 py-2 text-right font-medium">Forventet</th>
                      <th className="px-3 py-2 text-right font-medium">Simulert</th>
                      <th className="px-3 py-2 text-right font-medium">kr/kW</th>
                      <th className="px-3 py-2 text-right font-medium">Forskjell</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {capacityTariff.monthlyRows.map((row) => (
                      <tr key={row.month}>
                        <td className="px-3 py-2 font-medium">{row.month}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatKw(row.emulatedPeakKw)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatKw(row.mpcPeakKw)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.capacityLinkKrPerKw ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatKr(row.capacityCostDeltaKr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </SdAnleggControlCollapsibleSection>
      ) : null}

      {scopeBuildingCompare ? (
        <SdAnleggControlCollapsibleSection
          title={CONTROL_PRICE_LOAD_UI.scopeCompareTitle}
          description={CONTROL_PRICE_LOAD_UI.scopeCompareDescription}
          defaultOpen={false}
        >
          <SdAnleggControlScopeVsBuildingPeak compare={scopeBuildingCompare} />
        </SdAnleggControlCollapsibleSection>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {detailsOpen ? "Skjul detaljer" : CONTROL_EFFECT_UI.methodologyTechnicalToggle}
          <ChevronDown
            className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")}
            aria-hidden
          />
        </button>
        {detailsOpen ? (
          <div className="mt-2 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>{CONTROL_PRICE_LOAD_UI.fagfolkDetails}</p>
            <p>{CONTROL_PRICE_LOAD_UI.scopeCompareTechnical}</p>
            {scopeBuildingCompare?.evalLabel ? (
              <p>Periode: {scopeBuildingCompare.evalLabel}</p>
            ) : null}
            {capacityTariff && capacityTariff.monthlyRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Måned</th>
                      <th className="px-3 py-2 text-right font-medium">Målt topp</th>
                      <th className="px-3 py-2 text-right font-medium">BHCC el topp</th>
                      <th className="px-3 py-2 text-right font-medium">BHCC FV topp</th>
                      <th className="px-3 py-2 text-right font-medium">BHCC el</th>
                      <th className="px-3 py-2 text-right font-medium">BHCC FV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {capacityTariff.monthlyRows.map((row) => (
                      <tr key={`detail-${row.month}`}>
                        <td className="px-3 py-2 font-medium">{row.month}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatKw(row.observedPeakKw)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatKw(row.bhccPeakElectricKw)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatKw(row.bhccPeakDistrictHeatingKw)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.bhccElectricityKwh != null
                            ? formatKwh(row.bhccElectricityKwh)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.bhccDistrictHeatingKwh != null
                            ? formatKwh(row.bhccDistrictHeatingKwh)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
