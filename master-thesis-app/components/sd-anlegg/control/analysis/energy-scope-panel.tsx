"use client";

import type { MpcEnergyReconcileSummary } from "@/lib/sd-anlegg/control/build-mpc-energy-reconcile";
import type { ScopeBuildingEnergyCompare } from "@/lib/sd-anlegg/control/build-scope-building-energy-compare";
import type { Tr003GroundTruthSource } from "@/lib/sd-anlegg/envelope-model/power/energy-quantity";
import { CONTROL_SCOPE_SHARE_LABEL } from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlKpiCard } from "@/components/sd-anlegg/control/shared/kpi-card";
import { SdAnleggControlScopeVsBuildingPeak } from "@/components/sd-anlegg/control/analysis/scope-vs-building-peak";
import { formatProxyKr } from "@/components/sd-anlegg/control/format-proxy-kr";
import { cn } from "@/lib/utils";

type Props = {
  summary: MpcEnergyReconcileSummary;
  scopeBuildingCompare?: ScopeBuildingEnergyCompare | null;
  className?: string;
};

function formatKwh(v: number): string {
  if (v <= 0) return "—";
  return `${v.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kWh`;
}

function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} %`;
}

function formatHeatingTrack(input: {
  batteryKwh: number;
  districtKwh: number;
}): string {
  return `${formatKwh(input.batteryKwh)} batteri · ${formatKwh(input.districtKwh)} FV`;
}

function tr003SourceLabel(source: Tr003GroundTruthSource): string {
  switch (source) {
    case "tr003_energy_meter":
      return "Energimåler Δ";
    case "tr003_power_integral":
      return "Effekt ∫";
    case "bhcc":
      return "BHCC bygg";
    default:
      return "Ingen TR003";
  }
}

export function SdAnleggControlEnergyScopePanel({
  summary,
  scopeBuildingCompare = null,
  className,
}: Props) {
  const { measured, proxy, shares, heatingDemand } = summary;
  const { tr003 } = heatingDemand;
  const elShare = shares.proxyElectricShareOfMeasured;
  const heatShareIsCircuit = shares.proxyHeatShareOfCircuit != null;
  const heatShare =
    shares.proxyHeatShareOfCircuit ?? shares.proxyHeatShareOfMeasured;
  const mpcHeatDelta =
    heatingDemand.observed.totalKwh > 0
      ? Math.round(
          ((heatingDemand.mpc.totalKwh - heatingDemand.observed.totalKwh) /
            heatingDemand.observed.totalKwh) *
            1000,
        ) / 10
      : null;

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Tall gjelder styresignal (AHU + fjernvarmeventiler) — ikke hele bygget.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <SdAnleggControlKpiCard
          label="Målt bygg"
          value={formatProxyKr(measured.totalCostKr)}
          sub={`${formatKwh(measured.electricityKwh)} el · ${formatKwh(measured.districtHeatingKwh)} FV`}
          claim="observed"
        />
        <SdAnleggControlKpiCard
          label="Styresignal (estimat)"
          value={formatProxyKr(proxy.emulated.costKr)}
          sub={`${formatKwh(proxy.emulated.elKwh)} el · ${formatKwh(proxy.emulated.heatKwh)} FV`}
          claim="simulated"
        />
        <SdAnleggControlKpiCard
          label={CONTROL_SCOPE_SHARE_LABEL}
          value={`${formatPct(elShare)} el`}
          sub={
            heatShare != null
              ? heatShareIsCircuit
                ? `${formatPct(heatShare)} av TR003-krets (varme)`
                : `${formatPct(heatShare)} av målt fjernvarme`
              : "Andel av målt forbruk"
          }
          details={[
            "Stor forskjell mellom bygg og proxy er forventet — ikke en feil i målingene.",
          ]}
          claim="observed"
        />
      </div>

      <SdAnleggControlScopeVsBuildingPeak compare={scopeBuildingCompare} />

      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
        <div>
          <p className="text-xs font-medium text-foreground">Oppvarmingsbehov</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Varmebatteri og fjernvarmeventiler i perioden.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SdAnleggControlKpiCard
            label="TR003 effekt ∫"
            value={formatKwh(tr003.fromPowerIntegralKwh)}
            sub="∫ kW · dt over 15-min"
            claim="observed"
          />
          <SdAnleggControlKpiCard
            label="TR003 energimåler"
            value={formatKwh(tr003.fromEnergyMeterKwh)}
            sub="Δ kWh per time (OE001)"
            claim="observed"
          />
          <SdAnleggControlKpiCard
            label="TR003 referanse"
            value={formatKwh(tr003.groundTruthKwh)}
            sub={tr003SourceLabel(tr003.source)}
            claim="observed"
          />
          <SdAnleggControlKpiCard
            label="Simulert forslag"
            value={formatKwh(heatingDemand.mpc.totalKwh)}
            sub={
              mpcHeatDelta != null
                ? `${mpcHeatDelta > 0 ? "+" : ""}${mpcHeatDelta} % vs observert · ${formatHeatingTrack(heatingDemand.mpc)}`
                : formatHeatingTrack(heatingDemand.mpc)
            }
            claim="simulated"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SdAnleggControlKpiCard
            label="Observert behov"
            value={formatKwh(heatingDemand.observed.totalKwh)}
            sub={formatHeatingTrack(heatingDemand.observed)}
            claim="observed"
          />
          <p className="flex items-end text-[11px] text-muted-foreground">
            Oppvarming aktiv i {formatPct(heatingDemand.activeStepPct)} av
            intervallene.
          </p>
        </div>
      </div>
    </div>
  );
}
