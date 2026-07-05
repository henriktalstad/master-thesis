"use client";

import { useMemo } from "react";
import type { MpcPipelineRunRecord } from "@/lib/sd-anlegg/control/control-types";
import type { MpcEvalChartBundle } from "@/lib/sd-anlegg/control/load-mpc-eval-artifacts";
import {
  CONTROL_EFFECT_UI,
  controlComfortChartDescription,
  controlComfortChartTitle,
  controlScopeChartNote,
} from "@/lib/sd-anlegg/control/control-display-labels";
import {
  buildMpcComfortSeries,
  buildMpcCostTimeline,
  buildMpcReplayLoadProfile,
  findMpcPeakHour,
  resolveComfortBandFromSeries,
} from "@/lib/sd-anlegg/control/build-mpc-replay-profiles";
import {
  buildControlStrategyComparison,
} from "@/lib/sd-anlegg/control/build-control-strategy-comparison";
import { shouldUseReplayStepsForSummary } from "@/lib/sd-anlegg/control/resolve-replay-summary";
import type { MpcReplayResult, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { ReplaySignalSummary } from "@/lib/sd-anlegg/control/summarize-replay-signals";
import { SdAnleggControlLoadChart } from "@/components/sd-anlegg/control/charts/charts";
import {
  SdAnleggControlMpcComfortChart,
  SdAnleggControlMpcCostTimelineChart,
} from "@/components/sd-anlegg/control/charts/mpc-charts";
import { SdAnleggControlChartCard } from "@/components/sd-anlegg/control/shared/chart-card";
import { SdAnleggControlCollapsibleSection } from "@/components/sd-anlegg/control/shared/section";
import { SdAnleggControlStrategyComparison } from "@/components/sd-anlegg/control/analysis/strategy-comparison";
import { SdAnleggControlReplaySignalsPanel } from "@/components/sd-anlegg/control/analysis/replay-signals-panel";
import { SdAnleggControlEnergyLimitations } from "@/components/sd-anlegg/control/analysis/energy-limitations";
import type { ControlImprovementPoint } from "@/lib/sd-anlegg/control/control-types";
import { SdAnleggControlImprovementPoints } from "@/components/sd-anlegg/control/analysis/improvement-points";

type Props = {
  buildingSlug: string;
  run: MpcPipelineRunRecord;
  replay: MpcReplayResult["summary"];
  expectedStepCount: number;
  replaySteps: readonly MpcReplayStep[];
  replaySignalSummary: ReplaySignalSummary | null;
  mpcEvalCharts: MpcEvalChartBundle | null;
  proxyObservedCostKr?: number | null;
  measuredBuildingCostKr?: number | null;
  improvementPoints?: ControlImprovementPoint[];
};

export function SdAnleggControlAnalysisOverview({
  buildingSlug,
  run,
  replay,
  expectedStepCount,
  replaySteps,
  replaySignalSummary,
  mpcEvalCharts,
  proxyObservedCostKr = null,
  measuredBuildingCostKr = null,
  improvementPoints = [],
}: Props) {
  const hasFullEvalWindow =
    replaySteps.length > 0 &&
    shouldUseReplayStepsForSummary(replaySteps.length, expectedStepCount);

  const profiles = useMemo(
    () =>
      mpcEvalCharts && (replaySteps.length === 0 || hasFullEvalWindow)
        ? {
            costTimeline: mpcEvalCharts.costTimeline,
            comfort: mpcEvalCharts.comfort,
            loadProfile: mpcEvalCharts.loadProfile,
          }
        : replaySteps.length > 0
          ? {
              costTimeline: buildMpcCostTimeline(replaySteps),
              comfort: buildMpcComfortSeries(replaySteps),
              loadProfile: buildMpcReplayLoadProfile(replaySteps),
            }
          : {
              costTimeline: buildMpcCostTimeline(replaySteps),
              comfort: buildMpcComfortSeries(replaySteps),
              loadProfile: buildMpcReplayLoadProfile(replaySteps),
            },
    [hasFullEvalWindow, mpcEvalCharts, replaySteps],
  );

  const peakHour = useMemo(
    () => findMpcPeakHour(profiles.loadProfile),
    [profiles.loadProfile],
  );

  const strategyComparison = useMemo(
    () => buildControlStrategyComparison(replay),
    [replay],
  );

  const comfortBand = useMemo(
    () =>
      profiles.comfort.length > 0
        ? resolveComfortBandFromSeries(profiles.comfort)
        : (run.calibration?.solver.comfortBandC ?? { min: 18, max: 24 }),
    [profiles.comfort, run.calibration?.solver.comfortBandC],
  );

  const chartHourCount = profiles.costTimeline.length;
  const chartScopeNote = controlScopeChartNote(
    buildingSlug,
    chartHourCount > 0 ? chartHourCount : undefined,
  );

  const hasObservedLoad = profiles.loadProfile.some((p) => p.observedKw != null);
  const hasCharts =
    profiles.costTimeline.length > 0 ||
    profiles.loadProfile.length > 0 ||
    profiles.comfort.length > 0;

  return (
    <div className="space-y-4">
      {improvementPoints.length > 0 ? (
        <SdAnleggControlImprovementPoints points={improvementPoints} />
      ) : null}

      <SdAnleggControlStrategyComparison
        comparison={strategyComparison}
        buildingSlug={buildingSlug}
        proxyObservedCostKr={proxyObservedCostKr}
        measuredBuildingCostKr={measuredBuildingCostKr}
      />

      {hasCharts ? (
        <SdAnleggControlCollapsibleSection
          title={CONTROL_EFFECT_UI.chartsSectionTitle}
          description={
            chartScopeNote
              ? `${CONTROL_EFFECT_UI.chartsSectionDescription} · ${chartScopeNote}`
              : CONTROL_EFFECT_UI.chartsSectionDescription
          }
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {profiles.costTimeline.length > 0 ? (
                <SdAnleggControlChartCard
                  title={CONTROL_EFFECT_UI.chartCostTitle}
                  description={CONTROL_EFFECT_UI.chartCostDescription}
                >
                  <SdAnleggControlMpcCostTimelineChart
                    points={profiles.costTimeline}
                  />
                </SdAnleggControlChartCard>
              ) : null}
              {profiles.loadProfile.length > 0 ? (
                <SdAnleggControlChartCard
                  title={CONTROL_EFFECT_UI.chartLoadTitle}
                  description={
                    hasObservedLoad
                      ? CONTROL_EFFECT_UI.chartLoadDescriptionWithObserved
                      : CONTROL_EFFECT_UI.chartLoadDescriptionSimulated
                  }
                >
                  <SdAnleggControlLoadChart
                    loadProfile={profiles.loadProfile}
                    peakHour={peakHour}
                    showPrice
                    showObserved={hasObservedLoad}
                  />
                </SdAnleggControlChartCard>
              ) : null}
            </div>
            {profiles.comfort.length > 0 ? (
              <SdAnleggControlChartCard
                title={controlComfortChartTitle(buildingSlug)}
                description={controlComfortChartDescription(comfortBand)}
              >
                <SdAnleggControlMpcComfortChart
                  points={profiles.comfort}
                  comfortBand={comfortBand}
                  focus
                />
              </SdAnleggControlChartCard>
            ) : null}
          </div>
        </SdAnleggControlCollapsibleSection>
      ) : null}

      <SdAnleggControlCollapsibleSection
        title={CONTROL_EFFECT_UI.limitationsTitle}
        description={CONTROL_EFFECT_UI.limitationsDescription}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <SdAnleggControlEnergyLimitations />
          {replaySignalSummary ? (
            <SdAnleggControlReplaySignalsPanel
              summary={replaySignalSummary}
              embedded
            />
          ) : null}
        </div>
      </SdAnleggControlCollapsibleSection>
    </div>
  );
}
