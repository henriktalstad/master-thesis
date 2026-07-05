import "server-only";

import { buildMpcSignalComparison } from "./build-mpc-signal-comparison";
import { mpcStepComparisonNeedsRebuild } from "./mpc-signal-series-registry";
import { buildPriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import type { PriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import {
  buildCapacityTariffAnalysis,
  type CapacityTariffAnalysis,
} from "./build-capacity-tariff-analysis";
import { loadGridTariffMonthlyBundle } from "./load-grid-tariff-monthly";
import {
  buildMpcComfortSeries,
  buildMpcCostTimeline,
  buildMpcReplayEffectSummary,
  buildMpcReplayLoadProfile,
} from "./build-mpc-replay-profiles";
import { buildMpcHourTable } from "./build-mpc-hour-table";
import { normalizeReplaySummary } from "./build-control-strategy-comparison";
import { loadMpcEnergyReconcileForRun } from "./load-mpc-energy-reconcile";
import {
  mapMpcPipelineRunRecord,
  mpcPipelineRunScalarSelect,
  type MpcPipelineRunRow,
} from "./map-mpc-pipeline-run-record";
import type {
  MpcPipelineRunRecord,
  MpcSignalComparison,
  MpcHourTableRow,
  ControlLoadHourPoint,
} from "./control-types";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcEnergyReconcileBundle } from "./load-mpc-energy-reconcile";
import type {
  MpcComfortPoint,
  MpcCostTimelinePoint,
  MpcReplayEffectSummary,
} from "./build-mpc-replay-profiles";
import { prisma } from "@/lib/db";
import { loadReplayStepsWithFallback } from "./persist-mpc-pipeline-replay-steps";
import {
  loadChartBundleForRun,
  loadPolicyKpisForRun,
  loadPriceLoadShiftForRun,
} from "./persist-mpc-pipeline-relational-artifacts";
import { resolveUiMpcPipelineRunId } from "./resolve-ui-pipeline-run";
import type { MpcSimulationProgress } from "./mpc-simulation-progress";
import { summarizeMpcReplaySteps } from "./summarize-mpc-replay-steps";
import { buildReplaySummaryFromScalars } from "./build-mpc-pipeline-run-scalars";
import { countPipelineReplaySteps } from "./pipeline-run-completeness";
import { shouldUseReplayStepsForSummary } from "./resolve-replay-summary";
import {
  parseMpcPipelineUiArtifacts,
  uiArtifactsMatchRun,
} from "./persist-mpc-ui-artifacts";

export type LoadMpcEvalArtifactsOptions = {
  includeFullReplaySteps?: boolean;
  tailStepCount?: number;
  skipAnalysisArtifacts?: boolean;
  simulationProgress?: MpcSimulationProgress | null;
  pipelineRunId?: string | null;
};

export type MpcEvalChartBundle = {
  costTimeline: MpcCostTimelinePoint[];
  comfort: MpcComfortPoint[];
  loadProfile: ControlLoadHourPoint[];
  effectSummary: MpcReplayEffectSummary | null;
  hourTable: MpcHourTableRow[];
};

export type MpcEvalArtifacts = {
  run: MpcPipelineRunRecord;
  replaySteps: MpcReplayStep[];
  stepComparison: MpcSignalComparison | null;
  energyReconcile: MpcEnergyReconcileBundle | null;
  charts: MpcEvalChartBundle | null;
  priceLoadShift: PriceLoadShiftAnalysis | null;
  capacityTariff: CapacityTariffAnalysis | null;
  displayMeta: {
    incomplete: boolean;
    persistedStepCount: number;
    expectedStepCount: number;
    canonicalRunId: string | null;
  };
};

function buildCharts(
  run: MpcPipelineRunRecord,
  steps: readonly MpcReplayStep[],
): MpcEvalChartBundle | null {
  if (steps.length === 0 || !run.snapshot) return null;
  const replaySummary = run.snapshot.replaySummary;
  return {
    costTimeline: buildMpcCostTimeline(steps),
    comfort: buildMpcComfortSeries(steps),
    loadProfile: buildMpcReplayLoadProfile(steps),
    effectSummary: buildMpcReplayEffectSummary(
      replaySummary ? normalizeReplaySummary(replaySummary) : null,
      steps,
    ),
    hourTable: buildMpcHourTable(steps),
  };
}

export async function loadMpcEvalArtifacts(
  buildingId: string,
  options?: LoadMpcEvalArtifactsOptions,
): Promise<MpcEvalArtifacts | null> {
  const includeFull = options?.includeFullReplaySteps ?? false;
  const tailStepCount = options?.tailStepCount ?? 96;
  const skipAnalysis = options?.skipAnalysisArtifacts ?? false;

  const uiResolution =
    options?.pipelineRunId != null
      ? {
          runId: options.pipelineRunId,
          canonicalRunId: null as string | null,
          incomplete: false,
          persistedStepCount: 0,
          expectedStepCount: 0,
        }
      : await resolveUiMpcPipelineRunId(
          buildingId,
          options?.simulationProgress ?? null,
        );

  const runId = uiResolution.runId;
  if (!runId) return null;

  const [row, policyKpis, cachedCharts, cachedPriceLoad] = await Promise.all([
    prisma.sdAnleggMpcPipelineRun.findUnique({
      where: { id: runId },
      select: mpcPipelineRunScalarSelect,
    }),
    loadPolicyKpisForRun(runId),
    skipAnalysis ? Promise.resolve(null) : loadChartBundleForRun(runId),
    skipAnalysis ? Promise.resolve(null) : loadPriceLoadShiftForRun(runId),
  ]);

  if (!row?.calibration) return null;

  const replaySteps = await loadReplayStepsWithFallback({
    pipelineRunId: row.id,
    maxSteps: includeFull ? undefined : tailStepCount,
  });

  let stepComparison: MpcSignalComparison | null = null;
  if (replaySteps.length > 0) {
    stepComparison = buildMpcSignalComparison(replaySteps, { resolution: "step" });
    if (mpcStepComparisonNeedsRebuild(stepComparison)) {
      stepComparison = buildMpcSignalComparison(replaySteps, { resolution: "step" });
    }
  }

  const run = mapMpcPipelineRunRecord(row as MpcPipelineRunRow, replaySteps, {
    stepComparison,
    policySummaries: policyKpis,
  });

  if (replaySteps.length > 0) {
    const expectedSteps = uiResolution.expectedStepCount || row.stepCount;
    const liveSummary = summarizeMpcReplaySteps(replaySteps);
    if (
      liveSummary &&
      run.snapshot &&
      shouldUseReplayStepsForSummary(replaySteps.length, expectedSteps)
    ) {
      run.snapshot.replaySummary = buildReplaySummaryFromScalars({
        stepCount: replaySteps.length,
        trainStepCount: row.trainStepCount,
        holdoutStepCount: row.holdoutStepCount,
        summary: liveSummary,
        policySummaries: policyKpis,
      });
    }
  }

  const dbPersistedStepCount = await countPipelineReplaySteps(row.id);
  const displayMeta = {
    incomplete:
      uiResolution.incomplete ||
      (uiResolution.expectedStepCount > 0 &&
        dbPersistedStepCount > 0 &&
        dbPersistedStepCount < uiResolution.expectedStepCount),
    persistedStepCount: Math.max(
      dbPersistedStepCount,
      row.persistedStepCount ?? 0,
      includeFull ? replaySteps.length : 0,
    ),
    expectedStepCount: uiResolution.expectedStepCount || row.stepCount,
    canonicalRunId: uiResolution.canonicalRunId,
  };

  const parsedUiArtifacts = parseMpcPipelineUiArtifacts(row.uiArtifacts);

  const energyReconcile =
    skipAnalysis || row.stepCount <= 0
      ? null
      : await loadMpcEnergyReconcileForRun(row.id);

  const chartsFresh =
    !skipAnalysis &&
    cachedCharts != null &&
    row.chartsGeneratedAt != null &&
    cachedCharts.costTimeline.length > 0;

  const chartsFromUiArtifacts =
    !skipAnalysis &&
    !chartsFresh &&
    parsedUiArtifacts != null &&
    uiArtifactsMatchRun(parsedUiArtifacts, row.stepCount)
      ? parsedUiArtifacts.chartBundle
      : null;

  const charts =
    skipAnalysis
      ? null
      : chartsFresh && cachedCharts
        ? {
            ...cachedCharts,
            hourTable:
              cachedCharts.hourTable.length > 0
                ? cachedCharts.hourTable
                : replaySteps.length > 0
                  ? buildMpcHourTable(replaySteps)
                  : [],
          }
        : chartsFromUiArtifacts
          ? {
              ...chartsFromUiArtifacts,
              hourTable:
                chartsFromUiArtifacts.hourTable.length > 0
                  ? chartsFromUiArtifacts.hourTable
                  : replaySteps.length > 0
                    ? buildMpcHourTable(replaySteps)
                    : [],
            }
          : replaySteps.length > 0
            ? buildCharts(run, replaySteps)
            : null;

  const priceLoadFromArtifacts =
    parsedUiArtifacts?.version === 2 &&
    uiArtifactsMatchRun(parsedUiArtifacts, row.stepCount)
      ? parsedUiArtifacts.priceLoadShift
      : null;

  const priceLoadShift =
    skipAnalysis
      ? null
      : (cachedPriceLoad ??
        priceLoadFromArtifacts ??
        (includeFull && replaySteps.length > 0
          ? buildPriceLoadShiftAnalysis(replaySteps)
          : null));

  let capacityTariff: CapacityTariffAnalysis | null = null;
  if (!skipAnalysis && charts?.loadProfile.length) {
    const tariffBundle = await loadGridTariffMonthlyBundle({
      buildingId,
      since: row.evalStart,
      until: row.evalEnd,
    });
    capacityTariff = buildCapacityTariffAnalysis({
      loadProfile: charts.loadProfile,
      monthlyTariffs: tariffBundle.byMonth,
      bhccByMonth: tariffBundle.bhccByMonth,
      missingTariffMonths: tariffBundle.missingMonths,
      tariffSyncedOnMiss: tariffBundle.syncedOnMiss,
    });
  }

  return {
    run,
    replaySteps,
    stepComparison,
    energyReconcile,
    charts,
    priceLoadShift,
    capacityTariff,
    displayMeta,
  };
}

/** Siste N steg for live-merge (unngå å sende full eval til klient). */
export function tailReplaySteps(
  steps: readonly MpcReplayStep[],
  maxSteps = 96,
): MpcReplayStep[] {
  if (steps.length <= maxSteps) return [...steps];
  return steps.slice(-maxSteps);
}
