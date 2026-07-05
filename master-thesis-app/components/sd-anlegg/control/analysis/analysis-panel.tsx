"use client";

import { useMemo } from "react";
import type {
  MpcPipelineRunRecord,
  ThesisEvalPeriod,
} from "@/lib/sd-anlegg/control/control-types";
import type { MpcEnergyReconcileBundle } from "@/lib/sd-anlegg/control/load-mpc-energy-reconcile";
import type { MpcEvalChartBundle } from "@/lib/sd-anlegg/control/load-mpc-eval-artifacts";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import type { PriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import type { CapacityTariffAnalysis } from "@/lib/sd-anlegg/control/build-capacity-tariff-analysis";
import { buildScopeBuildingEnergyCompare } from "@/lib/sd-anlegg/control/build-scope-building-energy-compare";
import { normalizeReplaySummary } from "@/lib/sd-anlegg/control/build-control-strategy-comparison";
import { resolveReplaySummaryForUi, isPartialReplayForUi } from "@/lib/sd-anlegg/control/resolve-replay-summary";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcSignalComparison } from "@/lib/sd-anlegg/control/control-types";
import type { ReplaySignalSummary } from "@/lib/sd-anlegg/control/summarize-replay-signals";
import type {
  ControlLookbackDays,
  ControlPeriodMode,
  StyringSignalGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import type { ControlPlantModel, MpcEvalCoverageSummary } from "@/lib/sd-anlegg/control/control-types";
import { SdAnleggControlChartCard } from "@/components/sd-anlegg/control/shared/chart-card";
import { SdAnleggControlEnergyReconcilePanel } from "@/components/sd-anlegg/control/analysis/energy-reconcile-panel";
import { buildEffectFlowSnapshot } from "@/lib/sd-anlegg/control/build-effect-flow-snapshot";
import { buildMpcImprovementPoints } from "@/lib/sd-anlegg/control/build-mpc-improvement-points";
import { SdAnleggControlEffectCalculationFlow } from "@/components/sd-anlegg/control/analysis/effect-calculation-flow";
import { SdAnleggControlStyringContextStrip } from "@/components/sd-anlegg/control/styring/styring-context-strip";
import { SdAnleggControlReplayDiagnosisPanel } from "@/components/sd-anlegg/control/analysis/replay-diagnosis-panel";
import { SdAnleggControlMpcSignalComparison } from "@/components/sd-anlegg/control/styring/mpc-signal-comparison";
import { SdAnleggControlAnalysisHero } from "@/components/sd-anlegg/control/analysis/analysis-hero";
import { SdAnleggControlAnalysisNav } from "@/components/sd-anlegg/control/analysis/analysis-nav";
import { SdAnleggControlAnalysisOverview } from "@/components/sd-anlegg/control/analysis/analysis-overview";
import { SdAnleggControlAnalysisPanelSkeleton } from "@/components/sd-anlegg/control/analysis/analysis-panel-skeleton";
import { SdAnleggControlPriceLoadPanel } from "@/components/sd-anlegg/control/analysis/price-load-panel";
import { SdAnleggControlSignalCatalogPanel } from "@/components/sd-anlegg/control/setup/signal-catalog-panel";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { Card, CardContent } from "@/components/ui/card";
import { CONTROL_EFFECT_UI } from "@/lib/sd-anlegg/control/control-display-labels";

type Props = {
  buildingSlug: string;
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
  grain: StyringSignalGrain;
  activeView: StyringAnalysisViewId;
  mpcPipelineRun: MpcPipelineRunRecord | null;
  replaySteps?: readonly MpcReplayStep[];
  stepComparison?: MpcSignalComparison | null;
  replaySignalSummary?: ReplaySignalSummary | null;
  mpcEnergyReconcile?: MpcEnergyReconcileBundle | null;
  mpcEvalCharts?: MpcEvalChartBundle | null;
  mpcPriceLoadShift?: PriceLoadShiftAnalysis | null;
  mpcCapacityTariff?: CapacityTariffAnalysis | null;
  evalPeriod?: ThesisEvalPeriod | null;
  plantModel?: ControlPlantModel | null;
  mpcEvalCoverage?: MpcEvalCoverageSummary | null;
  error?: string | null;
  replayRunDisplayMeta?: {
    incomplete: boolean;
    persistedStepCount: number;
    expectedStepCount: number;
    canonicalRunId: string | null;
  } | null;
  examinerMode?: boolean;
  viewLoading?: boolean;
};

export function SdAnleggControlAnalysisPanel({
  buildingSlug,
  periodMode,
  lookbackDays,
  grain: _grain,
  activeView,
  mpcPipelineRun,
  replaySteps = [],
  stepComparison = null,
  replaySignalSummary = null,
  mpcEnergyReconcile = null,
  mpcEvalCharts = null,
  mpcPriceLoadShift = null,
  mpcCapacityTariff = null,
  evalPeriod = null,
  plantModel = null,
  mpcEvalCoverage = null,
  error,
  replayRunDisplayMeta = null,
  examinerMode = false,
  viewLoading = false,
}: Props) {
  const reconcileSummary = mpcEnergyReconcile?.summary;
  const scopeBuildingCompare = useMemo(
    () =>
      buildScopeBuildingEnergyCompare({
        reconcile: reconcileSummary ?? null,
        capacityTariff: mpcCapacityTariff,
        replaySteps,
      }),
    [reconcileSummary, mpcCapacityTariff, replaySteps],
  );

  const ventilationElSharePct =
    reconcileSummary?.shares.proxyElectricShareOfMeasured ?? null;
  const ventilationHeatShareIsCircuit =
    reconcileSummary?.shares.proxyHeatShareOfCircuit != null;
  const ventilationHeatSharePct =
    reconcileSummary?.shares.proxyHeatShareOfCircuit ??
    reconcileSummary?.shares.proxyHeatShareOfMeasured ??
    null;
  const proxyObservedCostKr = reconcileSummary?.proxy.observed.costKr ?? null;
  const measuredBuildingCostKr = reconcileSummary?.measured.totalCostKr ?? null;

  const expectedStepCount =
    replayRunDisplayMeta?.expectedStepCount ??
    mpcPipelineRun?.stepCount ??
    evalPeriod?.stepCount ??
    0;
  const loadedStepCount =
    replayRunDisplayMeta?.persistedStepCount ?? replaySteps.length;
  const partialReplay = isPartialReplayForUi(loadedStepCount, expectedStepCount);

  const replay = useMemo(() => {
    if (!mpcPipelineRun) return null;
    const replaySnapshot = mpcPipelineRun.snapshot.replaySummary;
    return (
      resolveReplaySummaryForUi(replaySnapshot, replaySteps, {
        expectedStepCount,
      }) ?? normalizeReplaySummary(replaySnapshot)
    );
  }, [mpcPipelineRun, replaySteps, expectedStepCount]);

  const effectFlow = useMemo(() => {
    if (!replay) return null;
    return buildEffectFlowSnapshot({
      replay,
      proxyObservedCostKr,
      measuredBuildingCostKr,
      ventilationElSharePct,
    });
  }, [replay, proxyObservedCostKr, measuredBuildingCostKr, ventilationElSharePct]);

  const improvementPoints = useMemo(
    () => buildMpcImprovementPoints(mpcEvalCharts?.hourTable ?? []),
    [mpcEvalCharts?.hourTable],
  );

  if (!mpcPipelineRun || !replay || !effectFlow) {
    return (
      <div className="space-y-5">
        <SdAnleggControlStyringContextStrip
          buildingSlug={buildingSlug}
          periodMode={periodMode}
          lookbackDays={lookbackDays}
          tab="analyse"
          analysisView={activeView}
          showResolution={false}
          evalPeriod={evalPeriod}
          examinerMode={examinerMode}
        />
        <Card className={SD_ANLEGG_CARD}>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {error ??
              (examinerMode
                ? CONTROL_EFFECT_UI.analysisNoThesisSimulation
                : CONTROL_EFFECT_UI.analysisNoSimulation)}
          </CardContent>
        </Card>
      </div>
    );
  }

  const comparison = stepComparison ?? mpcPipelineRun.stepComparison ?? mpcPipelineRun.signalComparison;
  const kpiScopeNote =
    partialReplay && loadedStepCount > 0 && expectedStepCount > 0
      ? CONTROL_EFFECT_UI.partialReplayKpiNote(loadedStepCount, expectedStepCount)
      : undefined;

  return (
    <div className="space-y-5">
      <SdAnleggControlStyringContextStrip
        buildingSlug={buildingSlug}
        periodMode={periodMode}
        lookbackDays={lookbackDays}
        tab="analyse"
        analysisView={activeView}
        showResolution={false}
        evalPeriod={evalPeriod}
        examinerMode={examinerMode}
        partialReplayLoaded={partialReplay ? loadedStepCount : null}
        partialReplayExpected={partialReplay ? expectedStepCount : null}
        runCreatedAt={mpcPipelineRun.createdAt}
      />

      <SdAnleggControlAnalysisHero
        deltaVsObservedKr={replay.deltaCostKr}
        deltaVsObservedPct={replay.deltaCostPct}
        deltaVsEmulatedKr={replay.deltaCostVsEmulatedKr ?? null}
        deltaVsEmulatedPct={replay.deltaCostVsEmulatedPct ?? null}
        meaningfulDeltaPct={
          replay.mpcVsObservedDeltaPct ?? replay.meaningfulDeltaPct ?? null
        }
        meaningfulDeltaSteps={
          replay.mpcVsObservedDeltaSteps ?? replay.meaningfulDeltaSteps ?? null
        }
        stepCount={replay.stepCount}
        fallbackPct={replay.fallbackPct ?? null}
        ventilationElSharePct={ventilationElSharePct}
        ventilationHeatSharePct={ventilationHeatSharePct}
        ventilationHeatShareIsCircuit={ventilationHeatShareIsCircuit}
        kpiScopeNote={kpiScopeNote}
      />

      <SdAnleggControlAnalysisNav
        buildingSlug={buildingSlug}
        periodMode={periodMode}
        lookbackDays={lookbackDays}
        activeView={activeView}
        examinerMode={examinerMode}
      />

      {activeView === "oversikt" ? (
        viewLoading ? (
          <SdAnleggControlAnalysisPanelSkeleton activeView="oversikt" sectionOnly />
        ) : (
          <>
            {replaySteps.length > 0 ? (
              <SdAnleggControlReplayDiagnosisPanel
                summary={replay}
                replaySteps={replaySteps}
              />
            ) : null}

            <SdAnleggControlAnalysisOverview
              buildingSlug={buildingSlug}
              run={mpcPipelineRun}
              replay={replay}
              expectedStepCount={expectedStepCount}
              replaySteps={replaySteps}
              replaySignalSummary={replaySignalSummary}
              mpcEvalCharts={mpcEvalCharts}
              proxyObservedCostKr={proxyObservedCostKr}
              measuredBuildingCostKr={measuredBuildingCostKr}
              improvementPoints={improvementPoints}
            />

            <SdAnleggControlEffectCalculationFlow
              snapshot={effectFlow}
              defaultOpen={false}
            />
          </>
        )
      ) : null}

      {activeView === "signaler" && plantModel ? (
        <SdAnleggControlSignalCatalogPanel
          plantModel={plantModel}
          evalCoverage={mpcEvalCoverage}
          defaultOpen
        />
      ) : null}

      {activeView === "pris" ? (
        viewLoading ? (
          <SdAnleggControlAnalysisPanelSkeleton activeView="pris" sectionOnly />
        ) : mpcPriceLoadShift ? (
          <SdAnleggControlPriceLoadPanel
            analysis={mpcPriceLoadShift}
            loadProfile={mpcEvalCharts?.loadProfile ?? []}
            capacityTariff={mpcCapacityTariff}
            scopeBuildingCompare={scopeBuildingCompare}
          />
        ) : (
          <Card className={SD_ANLEGG_CARD}>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {CONTROL_EFFECT_UI.analysisPriceEmpty}
            </CardContent>
          </Card>
        )
      ) : null}

      {activeView === "signaler" ? (
        viewLoading ? (
          <SdAnleggControlAnalysisPanelSkeleton activeView="signaler" sectionOnly />
        ) : comparison?.series.length ? (
          <SdAnleggControlMpcSignalComparison
            comparison={comparison}
            replayStepCount={mpcPipelineRun.snapshot.replaySummary?.stepCount}
          />
        ) : (
          <SdAnleggControlChartCard
            title="Signal-sammenligning"
            description="Målt · forventet · simulert"
            empty
            emptyMessage="Ingen signaldata for perioden"
          />
        )
      ) : null}

      {activeView === "energi" ? (
        viewLoading ? (
          <SdAnleggControlAnalysisPanelSkeleton activeView="energi" sectionOnly />
        ) : mpcEnergyReconcile ? (
          <SdAnleggControlEnergyReconcilePanel
            reconcile={mpcEnergyReconcile}
            scopeBuildingCompare={scopeBuildingCompare}
          />
        ) : (
          <Card className={SD_ANLEGG_CARD}>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {CONTROL_EFFECT_UI.analysisEnergyEmpty}
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
