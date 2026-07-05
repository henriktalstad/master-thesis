import "server-only";

import { cache } from "react";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import { listInfraspawnPointMetaForBuilding } from "@/lib/infraspawn/read-points";
import { buildControlPlantModel } from "./build-control-plant-model";
import {
  parseControlPeriodMode,
  resolveControlLookbackDays,
  resolveControlLookbackHours,
  resolveControlLoopStepLimit,
  type StyringSignalGrain,
} from "./resolve-control-lookback";
import { resolveControlWorkspacePeriod } from "./resolve-control-workspace-period";
import { loadControlSignalSeriesForWorkspace } from "./load-control-signal-series";
import {
  loadMpcEvalArtifacts,
  tailReplaySteps,
} from "./load-mpc-eval-artifacts";
import {
  buildMpcHourTable,
  buildMpcHourTableFromComparison,
} from "./build-mpc-hour-table";
import {
  loadLiveMpcStateRow,
  resolveForwardPlansFromLiveRow,
  resolveMpcForwardPlanFromLiveRow,
} from "./load-live-mpc-state-row";
import {
  loadControlTickWorkspace,
} from "./live";
import { toMpcEvalCoverageSummary } from "./mpc-eval-coverage-summary";
import { summarizeReplaySignals } from "./summarize-replay-signals";
import type {
  ControlDataCoverage,
  ControlWorkspaceData,
  ThesisEvalPeriod,
} from "./control-types";
import { resolveThesisEvalPeriod } from "./resolve-thesis-eval-period";
import { getCachedMpcEvalCoverageForPage } from "@/services/mpc/get-cached-mpc-eval-coverage";
import { analyzeMpcEvalCoverage } from "@/services/mpc/analyze-eval-coverage";
import { loadMpcResolveContext } from "@/services/mpc/load-mpc-resolve-context";
import { resolveMpcBuildingSource } from "@/services/mpc/resolve-mpc-context";
import { scheduleThesisMpcBackgroundEnsure } from "@/services/mpc/ensure-thesis-mpc-data";
import { scheduleIncrementalMpcReplayCatchUpWhenBehind } from "@/services/mpc/run-incremental-mpc-replay";
import { resolvePipelineStatus } from "./resolve-pipeline-status";
import { loadMpcWorkspaceRevision } from "./load-mpc-workspace-revision";
import { loadMpcSimulationProgress } from "./mpc-simulation-progress";
import { resolveUiMpcPipelineRunId } from "./resolve-ui-pipeline-run";
import type { MpcSimulationReadiness } from "@/services/mpc/assess-mpc-simulation-readiness";
import { assessFromCoverageReport } from "@/services/mpc/assess-mpc-simulation-readiness";
import { loadMpcBuildingPreferencesOverrides } from "@/services/mpc/mpc-building-preferences-store";
import { loadBuildingComfortTargets } from "@/services/mpc/load-building-comfort-band";
import { resolveGenericMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";

function buildDataCoverage(input: {
  lookbackHours: number;
  mpcEvalCoverage: ReturnType<typeof toMpcEvalCoverageSummary> | null;
  energyHours: number;
  replaySignalSummary: ReturnType<typeof summarizeReplaySignals>;
}): ControlDataCoverage {
  const lookbackDays = resolveControlLookbackDays(input.lookbackHours);
  const cov = input.mpcEvalCoverage;
  const ff = input.replaySignalSummary?.feedforward;

  let sdCoverageNote: string | null = null;
  if (cov?.needsBackfill) {
    sdCoverageNote = cov.evalBeyondInfluxLookback
      ? `Eval eldre enn Influx (${cov.influxLookbackHours} t) — eldre SD må finnes i Postgres`
      : "SD-dekning under terskel — sync/Influx oppdaterer automatisk";
  } else if (cov?.evalBeyondInfluxLookback) {
    sdCoverageNote = `Influx dekker siste ${cov.influxLookbackHours} t; eldre eval fra Postgres`;
  } else if (cov && !cov.canSimulate && cov.blockReason) {
    sdCoverageNote = cov.blockReason;
  }

  return {
    lookbackHours: input.lookbackHours,
    lookbackDays,
    energyHours: input.energyHours,
    sdSignalHours: cov?.stepCount ?? 0,
    weatherHours: ff?.stepsWithOutdoorTemp ?? 0,
    priceHours: ff?.stepsWithPrice ?? 0,
    sdSignalCoveragePct: cov ? Math.round(cov.uMeasPct * 100) : 0,
    sdCoverageNote,
  };
}

async function loadHourlyEnergy(
  buildingId: string,
  since: Date,
): Promise<
  Array<{
    hour: string;
    electricityKwh: number;
    totalCostKr: number;
  }>
> {
  const rows = await prisma.buildingHourlyCostCache.findMany({
    where: { buildingId, hour: { gte: since } },
    orderBy: { hour: "asc" },
    select: {
      hour: true,
      electricityVolumeKwh: true,
      electricityTotalCost: true,
      districtHeatingTotalCost: true,
    },
  });

  return rows.map((row) => ({
    hour: row.hour.toISOString(),
    electricityKwh: row.electricityVolumeKwh ?? 0,
    totalCostKr:
      (row.electricityTotalCost ?? 0) + (row.districtHeatingTotalCost ?? 0),
  }));
}

function buildEvalPeriod(
  mpcPipelineRun: ControlWorkspaceData["mpcPipelineRun"],
  coverage: ControlWorkspaceData["mpcEvalCoverage"],
  replayPersistedStepCount?: number | null,
): ThesisEvalPeriod | null {
  return resolveThesisEvalPeriod({
    mpcPipelineRun,
    coverage,
    replayPersistedStepCount,
  });
}

function buildSimulationError(
  readiness: MpcSimulationReadiness | null,
  hasMpcRun: boolean,
  displayMeta: {
    incomplete: boolean;
    persistedStepCount: number;
    expectedStepCount: number;
  } | null,
): string | null {
  if (displayMeta?.incomplete) {
    return null;
  }
  if (hasMpcRun) return null;
  if (!readiness) {
    return "Laster eval-dekning — vent på SD-sync.";
  }
  if (readiness.canSimulate) {
    return "Data OK — MPC replay kjøres ved neste sync eller «Kjør simulering».";
  }
  return readiness.blockers[0] ?? "Utilstrekkelig SD-dekning for MPC.";
}

/**
 * Read-only styring-workspace fra DB.
 * Simulering: cron eller manuell ensure.
 */
export type ControlWorkspaceLoadMode = "styring" | "analyse" | "oppsett";

export const loadSdAnleggControlWorkspaceData = cache(
  async (
    buildingSlug: string,
    lookbackDaysParam?: string | string[],
    options?: {
      forceRefresh?: boolean;
      includeFullReplaySteps?: boolean;
      mode?: ControlWorkspaceLoadMode;
      grain?: StyringSignalGrain;
      examinerMode?: boolean;
      periodModeParam?: string | string[];
    },
  ): Promise<ControlWorkspaceData | null> => {
    const mode = options?.mode ?? "styring";
    const grain = options?.grain ?? "15";
    const periodMode = parseControlPeriodMode(
      lookbackDaysParam,
      options?.periodModeParam,
    );
    const lookbackHours = resolveControlLookbackHours(lookbackDaysParam);
    const lookbackDays = resolveControlLookbackDays(lookbackHours);

    const access = await resolveInfraspawnBuildingForRead(buildingSlug);
    if (!access.ok) return null;

    const mpcSimulationProgress = await loadMpcSimulationProgress(
      access.building.id,
    );

    const liveMpcStateRow = await loadLiveMpcStateRow(access.building.id);

    const uiPipelineRun = await resolveUiMpcPipelineRunId(
      access.building.id,
      mpcSimulationProgress,
      { forceCanonical: options?.examinerMode === true },
    );

    if (options?.forceRefresh) {
      revalidateTag(`mpc-coverage:${buildingSlug}`, { expire: 0 });
    }

    const mpcSourcePromise = resolveMpcBuildingSource({ buildingSlug });
    const pointsPromise = listInfraspawnPointMetaForBuilding(
      access.integration.id,
      access.building.id,
    );

    const coverageLoader = options?.forceRefresh
      ? () => analyzeMpcEvalCoverage({ buildingSlug })
      : () => getCachedMpcEvalCoverageForPage(buildingSlug);

    const [coverageReport, mpcEvalArtifacts, workspaceRevision, mpcSource, points] =
      await Promise.all([
        coverageLoader(),
        loadMpcEvalArtifacts(access.building.id, {
          includeFullReplaySteps:
            mode === "analyse" || (options?.includeFullReplaySteps ?? false),
          tailStepCount: resolveControlLoopStepLimit(lookbackHours),
          skipAnalysisArtifacts: mode === "styring",
          simulationProgress: mpcSimulationProgress,
          pipelineRunId: uiPipelineRun.runId,
        }),
        loadMpcWorkspaceRevision(access.building.id, {
          simulationProgress: mpcSimulationProgress,
          uiPipelineRun,
          liveMpcStateRow,
        }),
        mpcSourcePromise,
        pointsPromise,
      ]);
    const mpcPipelineRun = mpcEvalArtifacts?.run ?? null;
    const mpcReplayRunDisplayMeta = mpcEvalArtifacts?.displayMeta ?? null;
    const replayStepsFull = mpcEvalArtifacts?.replaySteps ?? [];
    const mpcEvalCoverage = coverageReport
      ? toMpcEvalCoverageSummary(coverageReport)
      : null;
    const evalPeriod = buildEvalPeriod(
      mpcPipelineRun,
      mpcEvalCoverage,
      mpcReplayRunDisplayMeta?.persistedStepCount ?? null,
    );
    const workspacePeriod = resolveControlWorkspacePeriod({
      periodMode,
      lookbackDaysParam,
      evalPeriod,
    });
    const loopStepLimit =
      workspacePeriod.mode === "eval" && evalPeriod?.stepCount
        ? evalPeriod.stepCount
        : resolveControlLoopStepLimit(workspacePeriod.lookbackHours);
    const replayStepsTail = tailReplaySteps(replayStepsFull, loopStepLimit);
    const mpcEnergyReconcile = mpcEvalArtifacts?.energyReconcile ?? null;
    const mpcEvalCharts = mpcEvalArtifacts?.charts ?? null;
    const mpcPriceLoadShift = mpcEvalArtifacts?.priceLoadShift ?? null;
    const mpcCapacityTariff = mpcEvalArtifacts?.capacityTariff ?? null;

    const mpcForwardPlan = resolveMpcForwardPlanFromLiveRow(liveMpcStateRow);
    const mpcForwardPlans = resolveForwardPlansFromLiveRow(liveMpcStateRow);

    const [building, mpcResolveContext, hourlyEnergy, controlSignalSeries, controlTickBundle] =
      await Promise.all([
      prisma.building.findUnique({
        where: { id: access.building.id },
        select: { id: true, name: true },
      }),
      mode === "styring" && mpcPipelineRun?.snapshot
        ? Promise.resolve(undefined)
        : mpcSource
          ? loadMpcResolveContext({
              buildingId: access.building.id,
              buildingSlug,
              sourceId: mpcSource.sourceId,
            })
          : Promise.resolve(undefined),
      mode === "styring" ? Promise.resolve([]) : loadHourlyEnergy(access.building.id, workspacePeriod.since),
      loadControlSignalSeriesForWorkspace({
        buildingId: access.building.id,
        buildingSlug,
        pipelineRunId: mpcPipelineRun?.id ?? null,
        lookbackHours: workspacePeriod.lookbackHours,
        grain,
        sourceId: mpcSource?.sourceId ?? null,
        periodMode: workspacePeriod.mode,
        rangeSince: workspacePeriod.since,
        rangeUntil: workspacePeriod.until,
        expectedStepCount:
          workspacePeriod.mode === "eval" ? evalPeriod?.stepCount : undefined,
      }),
      loadControlTickWorkspace(access.building.id, 24, {
        liveMpcStateRow,
      }),
    ]);

    if (!building) return null;

    const mpcReadiness = coverageReport
      ? assessFromCoverageReport(coverageReport)
      : null;

    const backgroundEnsureScheduled = scheduleThesisMpcBackgroundEnsure({
      buildingSlug,
      coverage: coverageReport,
      hasMpcPipelineRun: mpcPipelineRun?.snapshot != null,
      simulationProgress: mpcSimulationProgress,
    });

    scheduleIncrementalMpcReplayCatchUpWhenBehind({
      buildingSlug,
      replayBehindEval: evalPeriod?.replayBehindEval ?? false,
      simulationProgress: mpcSimulationProgress,
    });

    const hasMpcRun = mpcPipelineRun?.snapshot != null;

    const pipelineStatus = resolvePipelineStatus({
      mpcEvalCoverage,
      mpcReadiness,
      simulationProgress: mpcSimulationProgress,
      hasMpcRun,
      backgroundEnsureScheduled,
      replayDisplay: mpcReplayRunDisplayMeta,
      runArtifacts: mpcPipelineRun
        ? {
            persistStatus: mpcPipelineRun.persistStatus ?? null,
            chartsGeneratedAt: mpcPipelineRun.chartsGeneratedAt ?? null,
          }
        : null,
    });

    const mpcHourTable =
      mpcEvalCharts?.hourTable ??
      (replayStepsFull.length > 0
        ? buildMpcHourTable(replayStepsFull)
        : buildMpcHourTableFromComparison(
            mpcPipelineRun?.signalComparison ?? null,
          ));

    const replaySignalSummary =
      mode === "analyse" || replayStepsFull.length > 0
        ? summarizeReplaySignals(replayStepsFull)
        : null;
    const liveLoopSignalSummary =
      mode === "analyse" ? summarizeReplaySignals(controlSignalSeries.steps) : null;

    const dataCoverage = buildDataCoverage({
      lookbackHours: workspacePeriod.lookbackHours,
      mpcEvalCoverage,
      energyHours: hourlyEnergy.length,
      replaySignalSummary,
    });

    const plantModel = buildControlPlantModel({
      buildingId: building.id,
      buildingName: building.name,
      points,
      resolveContext: mpcResolveContext,
      dataQuality: {
        energyHourCount: hourlyEnergy.length,
        weatherHourCount: replaySignalSummary?.feedforward.stepsWithOutdoorTemp ?? 0,
        priceHourCount: replaySignalSummary?.feedforward.stepsWithPrice ?? 0,
        historyDays: lookbackDays,
        warnings: hasMpcRun
          ? []
          : mpcEvalCoverage?.blockReason
            ? [mpcEvalCoverage.blockReason]
            : ["Ingen MPC replay i DB — kjøres når dekning er OK"],
      },
    });

    const [savedPrefsOverrides, comfortTargets] =
      mode === "oppsett"
        ? await Promise.all([
            loadMpcBuildingPreferencesOverrides(buildingSlug, access.building.id),
            loadBuildingComfortTargets(access.building.id),
          ])
        : [null, null];

    const mpcBuildingPreferences =
      mode === "oppsett"
        ? resolveGenericMpcBuildingPreferences({
            buildingSlug,
            plantModel,
            replaySteps: replayStepsFull,
            overrides: savedPrefsOverrides,
            comfortTargets,
          })
        : null;

    return {
      plantModel,
      simulationError: buildSimulationError(
        mpcReadiness,
        hasMpcRun,
        mpcReplayRunDisplayMeta,
      ),
      sdSignalCoveragePct: mpcEvalCoverage
        ? Math.round(mpcEvalCoverage.uMeasPct * 100)
        : 0,
      loadedSdCanonicalIds: mpcEvalCoverage
        ? mpcEvalCoverage.signals.map((s) => s.canonicalId)
        : [],
      dataCoverage,
      lookbackDays,
      periodMode: workspacePeriod.mode,
      periodLabel: workspacePeriod.label,
      mpcPipelineSnapshot: mpcPipelineRun?.snapshot ?? null,
      mpcPipelineRun,
      mpcForwardPlan,
      mpcForwardPlans,
      mpcHourTable,
      mpcReplayStepsTail: replayStepsTail,
      mpcReplayStepsFull: mode === "analyse" ? replayStepsFull : [],
      mpcReplayRunDisplayMeta,
      mpcEvalCoverage,
      mpcReadiness,
      evalPeriod,
      backgroundEnsureScheduled,
      pipelineStatus,
      mpcBuildingPreferences,
      mpcPreferencesHasSavedOverrides: savedPrefsOverrides != null,
      controlTickState: controlTickBundle.tickState,
      controlTickHistory: controlTickBundle.history,
      controlLoopSteps: controlSignalSeries.steps,
      controlSignalSeries,
      replaySignalSummary,
      liveLoopSignalSummary,
      mpcEnergyReconcile,
      mpcEvalCharts,
      mpcPriceLoadShift,
      mpcCapacityTariff,
      mpcWorkspaceRevision: workspaceRevision.contentRevision,
      mpcSimulationProgress,
    };
  },
);
