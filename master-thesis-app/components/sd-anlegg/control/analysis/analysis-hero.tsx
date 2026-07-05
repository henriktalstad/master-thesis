"use client";

import {
  CONTROL_EFFECT_UI,
  CONTROL_SCOPE_SHARE_LABEL,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlKpiCard } from "@/components/sd-anlegg/control/shared/kpi-card";
import { formatProxyKr } from "@/components/sd-anlegg/control/format-proxy-kr";

function formatKr(value: number): string {
  return formatProxyKr(value);
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value} %`;
}

function formatSharePct(value: number): string {
  return `${value.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} %`;
}

type Props = {
  deltaVsObservedKr: number;
  deltaVsObservedPct: number;
  deltaVsEmulatedKr: number | null;
  deltaVsEmulatedPct: number | null;
  meaningfulDeltaPct: number | null;
  meaningfulDeltaSteps: number | null;
  stepCount: number;
  fallbackPct: number | null;
  ventilationElSharePct: number | null;
  ventilationHeatSharePct: number | null;
  ventilationHeatShareIsCircuit: boolean;
  kpiScopeNote?: string;
};

export function SdAnleggControlAnalysisHero({
  deltaVsObservedKr,
  deltaVsObservedPct,
  deltaVsEmulatedKr,
  deltaVsEmulatedPct,
  meaningfulDeltaPct,
  meaningfulDeltaSteps,
  stepCount,
  fallbackPct: _fallbackPct,
  ventilationElSharePct,
  ventilationHeatSharePct,
  ventilationHeatShareIsCircuit,
  kpiScopeNote,
}: Props) {
  const primaryKr = deltaVsObservedKr;
  const primaryPct = deltaVsObservedPct;
  const improved = primaryKr < 0;
  const savingsLabel = improved
    ? CONTROL_EFFECT_UI.heroSavingsLabelMpc
    : CONTROL_EFFECT_UI.heroExtraCostLabelMpc;

  const heatShareSub =
    ventilationHeatSharePct != null
      ? ventilationHeatShareIsCircuit
        ? `${formatSharePct(ventilationHeatSharePct)} TR003`
        : `${formatSharePct(ventilationHeatSharePct)} FV`
      : undefined;

  const savingsSub = `${formatPct(primaryPct)} ${CONTROL_EFFECT_UI.heroSavingsSub}`;

  const savingsDetails = [
    ...(deltaVsEmulatedPct != null && deltaVsEmulatedKr != null
      ? [
          `${formatPct(deltaVsEmulatedPct)} ${CONTROL_EFFECT_UI.heroSavingsDetailEmulated}`,
        ]
      : []),
    ...(kpiScopeNote ? [kpiScopeNote] : []),
  ];

  const changePct =
    meaningfulDeltaPct ??
    (meaningfulDeltaSteps != null && stepCount > 0
      ? (meaningfulDeltaSteps / stepCount) * 100
      : null);
  const changeSteps =
    meaningfulDeltaSteps ??
    (changePct != null && stepCount > 0
      ? Math.round((changePct / 100) * stepCount)
      : null);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SdAnleggControlKpiCard
        label={savingsLabel}
        value={formatKr(Math.abs(primaryKr))}
        sub={savingsSub}
        details={savingsDetails}
        claim="simulated"
        valueClassName={
          improved
            ? "text-emerald-600 dark:text-emerald-400"
            : primaryKr > 0
              ? "text-amber-700 dark:text-amber-300"
              : undefined
        }
      />
      <SdAnleggControlKpiCard
        label={CONTROL_EFFECT_UI.heroChangesLabel}
        value={changePct != null ? formatPct(Math.round(changePct * 10) / 10) : "—"}
        sub={
          changeSteps != null && stepCount > 0
            ? `${changeSteps.toLocaleString("nb-NO")} av ${stepCount.toLocaleString("nb-NO")} intervaller`
            : undefined
        }
        claim="simulated"
      />
      <SdAnleggControlKpiCard
        label={CONTROL_SCOPE_SHARE_LABEL}
        value={
          ventilationElSharePct != null
            ? `${formatSharePct(ventilationElSharePct)} el`
            : "—"
        }
        sub={heatShareSub}
        claim="observed"
      />
    </div>
  );
}
