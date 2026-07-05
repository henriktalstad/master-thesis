"use client";

import dynamic from "next/dynamic";
import { useMemo, type ReactNode } from "react";
import type { StyringTabId } from "@/lib/sd-anlegg/control/control-styring-tabs";
import type { StyringAnalysisViewId } from "@/lib/sd-anlegg/control/control-styring-analysis-views";
import type { ControlWorkspaceData } from "@/lib/sd-anlegg/control/control-types";
import { buildControlLoopDiagram } from "@/lib/sd-anlegg/control/build-control-loop-model";
import { buildMpcSignalComparison } from "@/lib/sd-anlegg/control/build-mpc-signal-comparison";
import { mergeLiveMpcSignalComparison } from "@/lib/sd-anlegg/control/merge-live-mpc-signal-comparison";
import { NAERBYEN_OFFICE_OPERATING_PROFILE } from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import { isStyringLiveControlStale } from "@/lib/sd-anlegg/control/styring-live-stale";
import {
  mergeLiveValuesIntoPlantModel,
  resolveControlPlantLatestSampleAt,
} from "@/lib/sd-anlegg/control/merge-live-values-into-plant-model";
import {
  mpcComparisonResolutionFromStepMinutes,
  type ControlLookbackDays,
  type StyringSignalGrain,
} from "@/lib/sd-anlegg/control/resolve-control-lookback";
import {
  findFirstAvailableStyringTab,
  isStyringTabAvailable,
  resolveStyringTabAvailability,
} from "@/lib/sd-anlegg/control/resolve-styring-tab-availability";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { useIsClientMounted } from "@/hooks/use-is-client-mounted";
import { useSdAnleggPoints } from "@/queries/infraspawn";
import {
  STYRING_LIVE_POLL_FINE_MS,
  STYRING_LIVE_POLL_MS,
} from "@/lib/sd-anlegg/control/control-constants";
import { SdAnleggControlStatusBar } from "@/components/sd-anlegg/control/workspace/status-bar";
import { SdAnleggControlAutoTickHost } from "@/components/sd-anlegg/control/workspace/auto-tick-host";
import { SdAnleggControlTabEmptyState } from "@/components/sd-anlegg/control/shared/tab-empty-state";
import { SdAnleggControlAnalysisPanelSkeleton } from "@/components/sd-anlegg/control/analysis/analysis-panel-skeleton";
import { SdAnleggControlWorkspaceNav } from "@/components/sd-anlegg/control/workspace/workspace-nav";
import { SdAnleggControlWorkspaceRefreshHost } from "@/components/sd-anlegg/control/workspace/workspace-refresh-host";
import {
  SdAnleggStyringPollProvider,
  useStyringWorkspacePoll,
} from "@/components/sd-anlegg/control/workspace/styring-poll-provider";
import type { StyringLiveControlPoll } from "@/lib/sd-anlegg/control/load-styring-live-poll";
import { resolvePipelineStatus } from "@/lib/sd-anlegg/control/resolve-pipeline-status";
import { SdAnleggControlExaminerBanner } from "@/components/sd-anlegg/control/shared/examiner-banner";

const tabPanelFallback = (
  <div className="min-h-[280px] animate-pulse rounded-lg bg-muted/30" aria-hidden />
);

const SdAnleggControlOpsPanel = dynamic(
  () =>
    import("@/components/sd-anlegg/control/styring/ops-panel").then((m) => ({
      default: m.SdAnleggControlOpsPanel,
    })),
  { loading: () => tabPanelFallback },
);

const SdAnleggControlAnalysisPanelLoader = dynamic(
  () =>
    import("@/components/sd-anlegg/control/analysis/analysis-panel-loader").then(
      (m) => ({
        default: m.SdAnleggControlAnalysisPanelLoader,
      }),
    ),
  {
    loading: () => (
      <SdAnleggControlAnalysisPanelSkeleton activeView="oversikt" />
    ),
  },
);

const SdAnleggControlSetupPanel = dynamic(
  () =>
    import("@/components/sd-anlegg/control/setup/setup-panel").then((m) => ({
      default: m.SdAnleggControlSetupPanel,
    })),
  { loading: () => tabPanelFallback },
);

type Props = {
  workspace: ControlWorkspaceData;
  buildingSlug: string;
  activeTab: StyringTabId;
  analysisView: StyringAnalysisViewId;
  grain?: StyringSignalGrain;
  examinerMode?: boolean;
};

function SdAnleggControlWorkspaceInner({
  workspace,
  buildingSlug,
  activeTab,
  analysisView,
  grain = "15",
  examinerMode = false,
  polledLivePoints,
  polledLiveControl,
}: Props & {
  polledLivePoints?: readonly InfraspawnPointListItem[];
  polledLiveControl?: StyringLiveControlPoll | null;
}) {
  const {
    plantModel,
    simulationError,
    sdSignalCoveragePct,
    loadedSdCanonicalIds,
    dataCoverage,
    lookbackDays,
    periodMode,
    periodLabel,
    mpcForwardPlan,
    mpcForwardPlans,
    mpcPipelineRun,
    mpcReplayStepsTail,
    mpcReplayRunDisplayMeta,
    mpcEvalCoverage,
    mpcReadiness,
    evalPeriod,
    backgroundEnsureScheduled,
    mpcBuildingPreferences,
    mpcPreferencesHasSavedOverrides,
    controlTickState,
    controlTickHistory,
    controlSignalSeries,
    mpcWorkspaceRevision,
    mpcSimulationProgress,
  } = workspace;

  const { simulationProgress: polledSimulationProgress, data: pollData } =
    useStyringWorkspacePoll();
  const liveSimulationProgress =
    polledSimulationProgress ?? mpcSimulationProgress;

  const replayDisplayForStatus = useMemo(() => {
    const polled = pollData?.pipelineReplayMeta;
    if (polled) {
      return {
        incomplete: polled.incomplete,
        persistedStepCount: polled.persistedStepCount,
        expectedStepCount: polled.expectedStepCount,
        canonicalRunId: mpcReplayRunDisplayMeta?.canonicalRunId ?? null,
      };
    }
    return mpcReplayRunDisplayMeta;
  }, [pollData?.pipelineReplayMeta, mpcReplayRunDisplayMeta]);

  const runArtifactsForStatus = useMemo(() => {
    const polled = pollData?.pipelineReplayMeta;
    if (polled) {
      return {
        persistStatus: polled.persistStatus,
        chartsGeneratedAt: polled.chartsGeneratedAt,
      };
    }
    if (mpcPipelineRun) {
      return {
        persistStatus: mpcPipelineRun.persistStatus ?? null,
        chartsGeneratedAt: mpcPipelineRun.chartsGeneratedAt ?? null,
      };
    }
    return null;
  }, [pollData?.pipelineReplayMeta, mpcPipelineRun]);

  const pipelineStatus = useMemo(
    () =>
      resolvePipelineStatus({
        mpcEvalCoverage,
        mpcReadiness,
        simulationProgress: liveSimulationProgress,
        hasMpcRun: mpcPipelineRun?.snapshot != null,
        backgroundEnsureScheduled,
        replayDisplay: replayDisplayForStatus,
        runArtifacts: runArtifactsForStatus,
      }),
    [
      mpcEvalCoverage,
      mpcReadiness,
      liveSimulationProgress,
      mpcPipelineRun?.snapshot,
      backgroundEnsureScheduled,
      replayDisplayForStatus,
      runArtifactsForStatus,
    ],
  );

  const hasMpcRun = mpcPipelineRun?.snapshot != null;
  const mounted = useIsClientMounted();
  const needsLivePlant =
    activeTab === "na" || activeTab === "analyse" || activeTab === "oppsett";
  const needsOpsDerived = activeTab === "na";

  const livePlantModel = useMemo(() => {
    if (!needsLivePlant) return plantModel;
    return mounted
      ? mergeLiveValuesIntoPlantModel(plantModel, polledLivePoints)
      : plantModel;
  }, [needsLivePlant, mounted, plantModel, polledLivePoints]);

  const liveSampledAt = useMemo(() => {
    if (!needsLivePlant) return null;
    return resolveControlPlantLatestSampleAt(livePlantModel);
  }, [needsLivePlant, livePlantModel]);

  const loopDisplay = useMemo(
    () => ({
      steps: needsOpsDerived ? controlSignalSeries.steps : [],
      source: controlSignalSeries.source,
      coverageHint: controlSignalSeries.coverageHint,
      stepMinutes: controlSignalSeries.stepMinutes,
      expectedStepCount: controlSignalSeries.expectedStepCount,
      coverageRatio: controlSignalSeries.coverageRatio,
      resolutionNote: controlSignalSeries.resolutionNote,
    }),
    [needsOpsDerived, controlSignalSeries],
  );

  const comparisonResolution = mpcComparisonResolutionFromStepMinutes(
    controlSignalSeries.stepMinutes,
  );

  const baseComparison = useMemo(() => {
    if (!needsOpsDerived) return null;
    const historicalSteps =
      loopDisplay.steps.length > 0 ? loopDisplay.steps : mpcReplayStepsTail;
    if (historicalSteps.length > 0) {
      return buildMpcSignalComparison(historicalSteps, {
        resolution: comparisonResolution,
        stepMinutes: controlSignalSeries.stepMinutes,
      });
    }
    if (mpcPipelineRun?.stepComparison) {
      return mpcPipelineRun.stepComparison;
    }
    return mpcPipelineRun?.signalComparison ?? null;
  }, [
    needsOpsDerived,
    loopDisplay.steps,
    mpcReplayStepsTail,
    mpcPipelineRun,
    comparisonResolution,
    controlSignalSeries.stepMinutes,
  ]);

  const { liveSnapshot, mergedComparison } = useMemo(() => {
    if (!needsOpsDerived || !baseComparison || !mounted) {
      return { liveSnapshot: null, mergedComparison: baseComparison };
    }

    const replayTail =
      polledLiveControl?.replayStepsTail.length
        ? mergeReplayTails(mpcReplayStepsTail, polledLiveControl.replayStepsTail)
        : mpcReplayStepsTail;

    const forwardPlanStep0 =
      polledLiveControl?.forwardPlanStep0 ??
      mpcForwardPlan?.planSteps[0] ??
      null;
    const activeCommand =
      polledLiveControl?.activeCommand ??
      controlTickState?.activeCommand ??
      null;

    const merged = mergeLiveMpcSignalComparison({
      comparison: baseComparison,
      livePoints: polledLivePoints,
      liveSampledAt,
      replaySteps: replayTail,
      liveControl: forwardPlanStep0
        ? {
            forwardPlanStep0,
            activeCommand,
            operatingProfile: NAERBYEN_OFFICE_OPERATING_PROFILE,
            occupancyCalibration: mpcPipelineRun?.calibration?.occupancy ?? null,
          }
        : undefined,
    });
    return {
      liveSnapshot: merged.liveSnapshot,
      mergedComparison: merged.comparison,
    };
  }, [
    needsOpsDerived,
    baseComparison,
    mounted,
    polledLivePoints,
    liveSampledAt,
    mpcReplayStepsTail,
    polledLiveControl,
    mpcForwardPlan,
    controlTickState?.activeCommand,
    mpcPipelineRun,
  ]);

  const planStale = useMemo(() => {
    if (!mounted || activeTab !== "na") return false;
    return isStyringLiveControlStale({
      lastControlTickAt:
        polledLiveControl?.lastControlTickAt ??
        controlTickState?.lastControlTickAt ??
        null,
      forwardPlanComputedAt:
        polledLiveControl?.forwardPlanComputedAt ??
        mpcForwardPlan?.computedAt ??
        null,
    });
  }, [
    activeTab,
    mounted,
    polledLiveControl,
    controlTickState?.lastControlTickAt,
    mpcForwardPlan?.computedAt,
  ]);

  const lookback = lookbackDays as ControlLookbackDays;

  const tabAvailability = useMemo(
    () =>
      resolveStyringTabAvailability({
        simulationError,
        mpcForwardPlan,
        mpcPipelineRun,
        mpcEvalCoverage,
        controlTickState,
      }),
    [
      simulationError,
      mpcForwardPlan,
      mpcPipelineRun,
      mpcEvalCoverage,
      controlTickState,
    ],
  );

  const fallbackTab = useMemo(
    () => findFirstAvailableStyringTab(tabAvailability),
    [tabAvailability],
  );

  const activeTabAvailable = isStyringTabAvailable(tabAvailability, activeTab);
  const activeTabMeta = tabAvailability.find((tab) => tab.id === activeTab);

  function renderTabGate(content: ReactNode) {
    if (!activeTabAvailable && activeTabMeta?.reason && activeTab !== "na") {
      return (
        <SdAnleggControlTabEmptyState
          buildingSlug={buildingSlug}
          periodMode={periodMode}
          lookbackDays={lookback}
          tabId={activeTab}
          tabLabel={activeTabMeta.label}
          reason={activeTabMeta.reason}
          fallbackTab={fallbackTab}
        />
      );
    }
    return content;
  }

  const simRunning = pipelineStatus.phase === "simulating" || pipelineStatus.phase === "simulation_stale";
  const showPipelineStatus =
    !examinerMode &&
    (activeTab === "analyse" ||
      activeTab === "oppsett" ||
      pipelineStatus.phase !== "ready" ||
      simRunning);

  const statusBarVariant: "full" | "compact" =
    hasMpcRun && activeTab === "analyse" ? "compact" : "full";

  return (
    <div className="space-y-5">
      {examinerMode ? <SdAnleggControlExaminerBanner /> : null}
      <SdAnleggControlWorkspaceRefreshHost
        buildingSlug={buildingSlug}
        activeTab={activeTab}
        initialContentRevision={mpcWorkspaceRevision}
        initialSimulationProgress={mpcSimulationProgress}
        examinerMode={examinerMode}
      />
      <SdAnleggControlAutoTickHost
        buildingSlug={buildingSlug}
        lastControlTickAt={
          polledLiveControl?.lastControlTickAt ??
          controlTickState?.lastControlTickAt ??
          null
        }
        forwardPlanComputedAt={
          polledLiveControl?.forwardPlanComputedAt ??
          mpcForwardPlan?.computedAt ??
          null
        }
        hasMpcRun={hasMpcRun}
        activeTab={activeTab}
        simulationRunning={simRunning}
        examinerMode={examinerMode}
      />
      {showPipelineStatus ? (
        <SdAnleggControlStatusBar
          buildingSlug={buildingSlug}
          activeTab={activeTab}
          dataCoverage={dataCoverage}
          mpcEvalCoverage={mpcEvalCoverage}
          mpcReadiness={mpcReadiness}
          mpcPipelineRun={mpcPipelineRun}
          evalPeriod={evalPeriod}
          pipelineStatus={pipelineStatus}
          variant={statusBarVariant}
          examinerMode={examinerMode}
          canonicalRunId={mpcReplayRunDisplayMeta?.canonicalRunId ?? null}
          activeRunId={mpcPipelineRun?.id ?? null}
        />
      ) : null}

      <SdAnleggControlWorkspaceNav
        buildingSlug={buildingSlug}
        activeTab={activeTab}
        periodMode={periodMode}
        lookbackDays={lookback}
        grain={grain}
        tabs={tabAvailability}
        examinerMode={examinerMode}
      />

      {activeTab === "na"
        ? renderTabGate(
            <SdAnleggControlOpsPanel
              buildingSlug={buildingSlug}
              periodMode={periodMode}
              periodLabel={periodLabel}
              lookbackDays={lookback}
              grain={grain}
              examinerMode={examinerMode}
              liveSnapshot={liveSnapshot}
              liveSampledAt={liveSampledAt}
              controlTickState={controlTickState}
              controlTickHistory={controlTickHistory}
              signalComparison={
                mergedComparison ?? baseComparison ?? mpcPipelineRun?.stepComparison ?? null
              }
              controlLoopSteps={loopDisplay.steps}
              controlLoopDisplaySource={loopDisplay.source}
              controlLoopCoverageHint={loopDisplay.coverageHint}
              controlLoopStepMinutes={loopDisplay.stepMinutes}
              controlLoopExpectedStepCount={loopDisplay.expectedStepCount}
              controlLoopCoverageRatio={loopDisplay.coverageRatio}
              controlLoopResolutionNote={loopDisplay.resolutionNote}
              mpcForwardPlan={mpcForwardPlan}
              mpcForwardPlans={mpcForwardPlans}
              replayStepCount={
                mpcPipelineRun?.snapshot?.replaySummary?.stepCount ??
                mpcReplayStepsTail.length
              }
              evalPeriod={evalPeriod}
              planStale={planStale}
            />,
          )
        : null}

      {activeTab === "analyse"
        ? renderTabGate(
            <SdAnleggControlAnalysisPanelLoader
              buildingSlug={buildingSlug}
              periodMode={periodMode}
              lookbackDays={lookback}
              grain={grain}
              activeView={analysisView}
              examinerMode={examinerMode}
              mpcPipelineRun={mpcPipelineRun}
              evalPeriod={evalPeriod}
              plantModel={livePlantModel}
              mpcEvalCoverage={mpcEvalCoverage}
              error={simulationError}
            />,
          )
        : null}

      {activeTab === "oppsett" && mpcBuildingPreferences
        ? renderTabGate(
            <SdAnleggControlSetupPanel
              buildingSlug={buildingSlug}
              lookbackDays={lookback}
              plantModel={livePlantModel}
              loopDiagram={buildControlLoopDiagram(livePlantModel)}
              sdSignalCoveragePct={sdSignalCoveragePct}
              loadedSdCanonicalIds={loadedSdCanonicalIds}
              mpcEvalCoverage={mpcEvalCoverage}
              mpcPipelineRun={mpcPipelineRun}
              usesMpcControl={hasMpcRun}
              liveSampledAt={liveSampledAt}
              mpcBuildingPreferences={mpcBuildingPreferences}
              mpcPreferencesHasSavedOverrides={mpcPreferencesHasSavedOverrides}
              canSimulate={mpcEvalCoverage?.canSimulate ?? false}
              examinerMode={examinerMode}
            />,
          )
        : null}
    </div>
  );
}

function SdAnleggControlWorkspaceClient({
  clientLiveEnabled,
  ...props
}: Props & { clientLiveEnabled: boolean }) {
  const { liveControl: polledLiveControl } = useStyringWorkspacePoll();
  const livePollInterval =
    clientLiveEnabled && props.activeTab === "na"
      ? props.workspace.controlSignalSeries.stepMinutes === 1 ||
        props.workspace.controlSignalSeries.stepMinutes === 5
        ? STYRING_LIVE_POLL_FINE_MS
        : STYRING_LIVE_POLL_MS
      : false;

  const { data: polledLivePoints } = useSdAnleggPoints(props.buildingSlug, {
    refetchInterval: livePollInterval,
    staleTime:
      livePollInterval === false ? undefined : Math.min(livePollInterval, 5_000),
  });

  return (
    <SdAnleggControlWorkspaceInner
      {...props}
      polledLivePoints={clientLiveEnabled ? polledLivePoints : undefined}
      polledLiveControl={clientLiveEnabled ? polledLiveControl : null}
    />
  );
}

function mergeReplayTails(
  base: readonly MpcReplayStep[],
  polled: readonly MpcReplayStep[],
): MpcReplayStep[] {
  const byTime = new Map<string, MpcReplayStep>();
  for (const step of base) byTime.set(step.t, step);
  for (const step of polled) byTime.set(step.t, step);
  return [...byTime.values()].sort(
    (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime(),
  );
}

export function SdAnleggControlWorkspace(props: Props) {
  const mounted = useIsClientMounted();

  return (
    <SdAnleggStyringPollProvider
      buildingSlug={props.buildingSlug}
      activeTab={props.activeTab}
      grain={
        props.workspace.controlSignalSeries.stepMinutes === 1
          ? "1"
          : props.workspace.controlSignalSeries.stepMinutes === 5
            ? "5"
            : "15"
      }
      enabled={mounted}
      initialSimulationProgress={props.workspace.mpcSimulationProgress}
    >
      {mounted ? (
        <SdAnleggControlWorkspaceClient {...props} clientLiveEnabled />
      ) : (
        <SdAnleggControlWorkspaceInner {...props} />
      )}
    </SdAnleggStyringPollProvider>
  );
}
