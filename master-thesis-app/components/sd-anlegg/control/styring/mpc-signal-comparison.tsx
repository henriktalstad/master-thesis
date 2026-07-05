"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MpcLiveStepSnapshot,
  MpcSignalComparison,
} from "@/lib/sd-anlegg/control/control-types";
import {
  CONTROL_SIGNAL_KPI,
  CONTROL_STYRING_OPS,
  CONTROL_ESTIMATED_HINT,
  controlCostSummaryPlain,
  controlTripleComparisonDescription,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { OPS_PRIMARY_COMPARISON_SERIES } from "@/lib/sd-anlegg/control/ops-signal-series-map";
import { formatMpcComparisonCoverage } from "@/lib/sd-anlegg/control/chart-utils";
import { SdAnleggControlMpcTripleChart } from "@/components/sd-anlegg/control/charts/mpc-triple-chart";
import { SdAnleggControlMpcStepTable } from "@/components/sd-anlegg/control/styring/mpc-step-table";
import { SdAnleggControlChartCard } from "@/components/sd-anlegg/control/shared/chart-card";
import { SdAnleggControlKpiCard } from "@/components/sd-anlegg/control/shared/kpi-card";
import { SdAnleggControlLiveStepStrip } from "@/components/sd-anlegg/control/styring/live-step-strip";
import { SdAnleggControlCollapsibleSection } from "@/components/sd-anlegg/control/shared/section";

type Props = {
  comparison: MpcSignalComparison;
  replayStepCount?: number;
  variant?: "analysis" | "ops";
  liveSnapshot?: MpcLiveStepSnapshot | null;
  hideLiveStrip?: boolean;
};

export function SdAnleggControlMpcSignalComparison({
  comparison,
  replayStepCount,
  variant = "analysis",
  liveSnapshot = null,
  hideLiveStrip = false,
}: Props) {
  const isOps = variant === "ops";
  const { series, defaultSeriesId, stepMinutes, totalDeltaCostKr, totalDeltaCostVsObservedKr } =
    comparison;
  const [activeId, setActiveId] = useState(defaultSeriesId ?? series[0]?.id ?? "");

  const { primarySeries, secondarySeries } = useMemo(() => {
    const primary = series.filter((item) =>
      OPS_PRIMARY_COMPARISON_SERIES.has(item.id),
    );
    if (primary.length === 0) {
      return { primarySeries: series.slice(0, 6), secondarySeries: series.slice(6) };
    }
    return {
      primarySeries: primary,
      secondarySeries: series.filter((item) => !OPS_PRIMARY_COMPARISON_SERIES.has(item.id)),
    };
  }, [series]);

  const useGroupedTabs = isOps || series.length > 6;
  const tabSeries = useGroupedTabs ? primarySeries : series;
  const activeInSecondary =
    useGroupedTabs && secondarySeries.some((item) => item.id === activeId);
  const activeSeries = useMemo(
    () => series.find((s) => s.id === activeId) ?? series[0],
    [series, activeId],
  );

  const referenceSummary = useMemo(() => {
    if (!activeSeries || activeSeries.chartVariant !== "observed_with_reference") {
      return null;
    }
    const deltas: number[] = [];
    let stepsWithDelta = 0;
    for (const point of activeSeries.points) {
      if (point.observed == null || point.reference == null) continue;
      const delta = Math.abs(point.observed - point.reference);
      deltas.push(delta);
      if (delta > 0.05) stepsWithDelta += 1;
    }
    const mean =
      deltas.length > 0
        ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100
        : null;
    return { mean, stepsWithDelta };
  }, [activeSeries]);

  if (!activeSeries || series.length === 0) {
    return (
      <SdAnleggControlChartCard
        title={isOps ? CONTROL_STYRING_OPS.cardTitle : "Pådrag og temperatur"}
        empty
        emptyMessage={
          isOps
            ? CONTROL_STYRING_OPS.emptyMessage
            : "Ikke nok data for denne visningen."
        }
      />
    );
  }

  const summary = activeSeries.summary;
  const chartVariant = activeSeries.chartVariant ?? "policy";
  const showPolicyKpis = chartVariant === "policy";

  const coverageLine = formatMpcComparisonCoverage(comparison, replayStepCount);
  const intervalLabel =
    stepMinutes >= 60
      ? `${summary.sampleHours} timer`
      : `${summary.sampleHours} intervaller`;

  const costSummary =
    showPolicyKpis && totalDeltaCostKr != null
      ? controlCostSummaryPlain(totalDeltaCostKr, totalDeltaCostVsObservedKr)
      : null;

  const showKpiRow = !isOps || !liveSnapshot;

  return (
    <SdAnleggControlChartCard
      title={isOps ? CONTROL_STYRING_OPS.cardTitle : "Pådrag og temperatur"}
      description={
        isOps
          ? CONTROL_STYRING_OPS.cardDescription
          : controlTripleComparisonDescription(coverageLine)
      }
      dataCoverage={isOps ? CONTROL_ESTIMATED_HINT : undefined}
    >
      <div className="space-y-4">
        {isOps && liveSnapshot && !hideLiveStrip ? (
          <SdAnleggControlLiveStepStrip
            snapshot={liveSnapshot}
            className="-mt-1 rounded-lg border border-border/70"
          />
        ) : null}

        {referenceSummary && !isOps ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Gjennomsnittlig avvik operatør vs beregnet SP:{" "}
            {referenceSummary.mean != null
              ? `${referenceSummary.mean} ${activeSeries.unit}`
              : "—"}
            {referenceSummary.stepsWithDelta > 0
              ? ` · ${referenceSummary.stepsWithDelta} intervaller med forskjell`
              : ""}
            .
          </p>
        ) : null}

        {showKpiRow ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {showPolicyKpis ? (
              <>
                <SdAnleggControlKpiCard
                  compact
                  label={CONTROL_SIGNAL_KPI.mpcVsBms}
                  claim="simulated"
                  value={
                    summary.meanAbsErrorMpcVsEmulated != null
                      ? `${summary.meanAbsErrorMpcVsEmulated} ${activeSeries.unit}`
                      : "—"
                  }
                  sub={
                    (summary.stepsWithMpcVsEmulatedDelta ?? 0) > 0
                      ? `${summary.stepsWithMpcVsEmulatedDelta} intervaller endret`
                      : "I tråd med estimert"
                  }
                />
                <SdAnleggControlKpiCard
                  compact
                  label={CONTROL_SIGNAL_KPI.observedVsMpc}
                  claim="simulated"
                  value={
                    summary.meanAbsErrorObservedVsMpc != null
                      ? `${summary.meanAbsErrorObservedVsMpc} ${activeSeries.unit}`
                      : "—"
                  }
                  sub="Måling vs simulert forslag"
                />
                <SdAnleggControlKpiCard
                  compact
                  label={CONTROL_SIGNAL_KPI.dataCoverage}
                  value={intervalLabel}
                  sub={
                    summary.hoursWithMpcDeviation > 0
                      ? `${summary.hoursWithMpcDeviation} med tydelig avvik`
                      : undefined
                  }
                />
              </>
            ) : (
              <>
                <SdAnleggControlKpiCard
                  compact
                  label={CONTROL_SIGNAL_KPI.operatorVsCalc}
                  claim="observed"
                  value={
                    referenceSummary?.mean != null
                      ? `${referenceSummary.mean} ${activeSeries.unit}`
                      : "—"
                  }
                  sub="Operatør vs beregnet SP"
                />
                <SdAnleggControlKpiCard
                  compact
                  label={CONTROL_SIGNAL_KPI.setpointSteps}
                  claim="observed"
                  value={
                    referenceSummary != null
                      ? String(referenceSummary.stepsWithDelta)
                      : "—"
                  }
                  sub="Over 0,05 °C avvik"
                />
                <SdAnleggControlKpiCard
                  compact
                  label={CONTROL_SIGNAL_KPI.dataCoverage}
                  value={intervalLabel}
                  sub={activeSeries.label}
                />
              </>
            )}
          </div>
        ) : null}

        {costSummary && !isOps ? (
          <p className="text-xs text-muted-foreground">{costSummary}</p>
        ) : null}

        <Tabs value={activeId} onValueChange={setActiveId}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
              {tabSeries.map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="h-8 rounded-lg border border-border/80 px-3 text-xs transition-transform duration-150 ease-out active:scale-[0.97] data-[state=active]:border-primary/40 data-[state=active]:bg-primary/5"
                >
                  {item.tabLabel}
                </TabsTrigger>
              ))}
              {activeInSecondary && activeSeries ? (
                <TabsTrigger value={activeSeries.id} className="sr-only">
                  {activeSeries.tabLabel}
                </TabsTrigger>
              ) : null}
            </TabsList>
            {useGroupedTabs && secondarySeries.length > 0 ? (
              <Select
                value={activeInSecondary ? activeId : ""}
                onValueChange={setActiveId}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Flere signaler" />
                </SelectTrigger>
                <SelectContent>
                  {secondarySeries.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">
                      {item.tabLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          {series.map((item) => (
            <TabsContent key={item.id} value={item.id} className="mt-0 space-y-4">
              <SdAnleggControlMpcTripleChart
                series={item}
                showContext={!isOps}
                stepMinutes={stepMinutes}
                plainLanguage={isOps}
              />
              <SdAnleggControlCollapsibleSection
                title={CONTROL_STYRING_OPS.tableTitle}
                description={CONTROL_STYRING_OPS.tableDescription(
                  item.tabLabel,
                  stepMinutes,
                )}
                badge={`${item.points.length}`}
                defaultOpen={false}
              >
                <SdAnleggControlMpcStepTable
                  series={item}
                  stepMinutes={stepMinutes}
                  plainLanguage={isOps}
                />
              </SdAnleggControlCollapsibleSection>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </SdAnleggControlChartCard>
  );
}
