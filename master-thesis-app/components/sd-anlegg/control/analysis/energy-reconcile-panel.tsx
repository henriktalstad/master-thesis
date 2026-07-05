"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MpcEnergyReconcileBundle } from "@/lib/sd-anlegg/control/load-mpc-energy-reconcile";
import type { ScopeBuildingEnergyCompare } from "@/lib/sd-anlegg/control/build-scope-building-energy-compare";
import {
  CONTROL_DISPLAY,
  controlCostDeltaVsEmulatedLabel,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlChartCard } from "@/components/sd-anlegg/control/shared/chart-card";
import { SdAnleggControlClaimBadge } from "@/components/sd-anlegg/control/shared/claim-badge";
import { SdAnleggControlEnergyReconcileChart } from "@/components/sd-anlegg/control/charts/energy-reconcile-chart";
import { SdAnleggControlEnergyScopePanel } from "@/components/sd-anlegg/control/analysis/energy-scope-panel";
import { formatProxyKr } from "@/components/sd-anlegg/control/format-proxy-kr";
import { cn } from "@/lib/utils";

type Props = {
  reconcile: MpcEnergyReconcileBundle;
  scopeBuildingCompare?: ScopeBuildingEnergyCompare | null;
};

function formatKwh(v: number): string {
  return `${v.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kWh`;
}

function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} %`;
}

const ROWS = [
  {
    key: "measured",
    label: "Målt bygg",
    sub: "Hele bygget",
    claim: "observed" as const,
    pick: (r: MpcEnergyReconcileBundle) => ({
      el: r.summary.measured.electricityKwh,
      heat: r.summary.measured.districtHeatingKwh,
      cost: r.summary.measured.totalCostKr,
    }),
  },
  {
    key: "observed",
    label: "Observert (proxy)",
    sub: "Målt pådrag × pris",
    claim: "observed" as const,
    pick: (r: MpcEnergyReconcileBundle) => ({
      el: r.summary.proxy.observed.elKwh,
      heat: r.summary.proxy.observed.heatKwh,
      cost: r.summary.proxy.observed.costKr,
    }),
  },
  {
    key: "emulated",
    label: CONTROL_DISPLAY.predicted.short,
    sub: "Dagens forventning",
    claim: "estimated" as const,
    pick: (r: MpcEnergyReconcileBundle) => ({
      el: r.summary.proxy.emulated.elKwh,
      heat: r.summary.proxy.emulated.heatKwh,
      cost: r.summary.proxy.emulated.costKr,
    }),
  },
  {
    key: "mpc",
    label: CONTROL_DISPLAY.simulatedControl.short,
    sub: "Simulert forslag",
    claim: "simulated" as const,
    pick: (r: MpcEnergyReconcileBundle) => ({
      el: r.summary.proxy.mpc.elKwh,
      heat: r.summary.proxy.mpc.heatKwh,
      cost: r.summary.proxy.mpc.costKr,
    }),
  },
] as const;

const DISTRICT_CIRCUIT_LABEL: Record<"tr002" | "tr003", string> = {
  tr002: "TR002 (bolig)",
  tr003: "TR003 (næring)",
};

export function SdAnleggControlEnergyReconcilePanel({
  reconcile,
  scopeBuildingCompare = null,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { summary } = reconcile;
  const { deltaMpcVsEmulated, circuitMeter, districtDeltaT } = summary;

  return (
    <div className="space-y-5">
      <SdAnleggControlEnergyScopePanel
        summary={summary}
        scopeBuildingCompare={scopeBuildingCompare}
      />

      <SdAnleggControlChartCard
        title="Sammenligning"
        description={`${summary.evalStart.slice(0, 10)} – ${summary.evalEnd.slice(0, 10)} · ${summary.hoursAligned} timer med data`}
      >
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Spor</th>
                  <th className="px-3 py-2 text-right font-medium">El</th>
                  <th className="px-3 py-2 text-right font-medium">Varme</th>
                  <th className="px-3 py-2 text-right font-medium">Est. kost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ROWS.map((row) => {
                  const data = row.pick(reconcile);
                  return (
                    <tr
                      key={row.key}
                      className={row.key === "measured" ? "bg-muted/10" : undefined}
                    >
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2 font-medium">
                          {row.label}
                          <SdAnleggControlClaimBadge kind={row.claim} />
                        </span>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {row.sub}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {data.el != null ? formatKwh(data.el) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {data.heat != null ? formatKwh(data.heat) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {data.cost != null ? formatProxyKr(data.cost) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            {controlCostDeltaVsEmulatedLabel()}:{" "}
            {deltaMpcVsEmulated.costKr > 0 ? "+" : ""}
            {formatProxyKr(deltaMpcVsEmulated.costKr)} ·{" "}
            {deltaMpcVsEmulated.costPct > 0 ? "+" : ""}
            {deltaMpcVsEmulated.costPct} % på proxy-estimatet.
          </p>

          {reconcile.hours.length > 0 ? (
            <SdAnleggControlEnergyReconcileChart hours={reconcile.hours} />
          ) : null}

          <div>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {detailsOpen ? "Skjul detaljer" : "Vis detaljer for fagfolk"}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  detailsOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {detailsOpen ? (
              <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Graf: søyler = hele bygget (BHCC). Linjer = proxy-estimat
                  (typisk lavere skala).
                  {reconcile.persisted ? "" : " Tall beregnet fra simulering og målt bygg."}
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Kjøling modelleres via el-pådrag (vifte + kjølebatteri).</li>
                  <li>
                    Varme kalibreres mot TR003 når tilgjengelig; BHCC er byggreferanse.
                  </li>
                  {circuitMeter ? (
                    <li>
                      TR003-krets{" "}
                      {formatKwh(
                        circuitMeter.tr003PowerKwh || circuitMeter.tr003EnergyKwh,
                      )}{" "}
                      vs BHCC {formatKwh(circuitMeter.bhccDistrictHeatingKwh)}
                      {circuitMeter.gapPct != null
                        ? ` (gap ${formatPct(circuitMeter.gapPct)})`
                        : ""}
                      .
                    </li>
                  ) : null}
                </ul>

                {districtDeltaT.some(
                  (c) => c.bmsAvgDeltaTC != null || c.meterAvgDeltaTC != null,
                ) ? (
                  <div className="overflow-x-auto rounded-lg border border-border/70">
                    <table className="w-full min-w-[400px] text-xs">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Krets</th>
                          <th className="px-3 py-2 text-right font-medium">ΔT BMS</th>
                          <th className="px-3 py-2 text-right font-medium">ΔT måler</th>
                          <th className="px-3 py-2 text-right font-medium">Gap</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {districtDeltaT.map((c) => (
                          <tr key={c.circuit}>
                            <td className="px-3 py-2">{DISTRICT_CIRCUIT_LABEL[c.circuit]}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {c.bmsAvgDeltaTC != null ? `${c.bmsAvgDeltaTC} °C` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {c.meterAvgDeltaTC != null ? `${c.meterAvgDeltaTC} °C` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {c.gapC != null
                                ? `${c.gapC > 0 ? "+" : ""}${c.gapC} °C`
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
      </SdAnleggControlChartCard>
    </div>
  );
}
