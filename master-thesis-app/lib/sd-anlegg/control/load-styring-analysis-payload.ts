import "server-only";

import { resolveInfraspawnBuildingForRead } from "@/lib/infraspawn/read-access";
import type { StyringAnalysisViewId } from "./control-styring-analysis-views";
import {
  loadMpcEvalArtifacts,
  type MpcEvalChartBundle,
} from "./load-mpc-eval-artifacts";
import { loadMpcSimulationProgress } from "./mpc-simulation-progress";
import { resolveUiMpcPipelineRunId } from "./resolve-ui-pipeline-run";
import { resolveStyringAnalysisLoadOptions } from "./resolve-styring-analysis-load-options";
import { summarizeReplaySignals, type ReplaySignalSummary } from "./summarize-replay-signals";
import type {
  MpcPipelineRunRecord,
  MpcSignalComparison,
} from "./control-types";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcEnergyReconcileBundle } from "./load-mpc-energy-reconcile";
import type { PriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import type { CapacityTariffAnalysis } from "./build-capacity-tariff-analysis";

export type StyringAnalysisPayload = {
  replaySteps: MpcReplayStep[];
  stepComparison: MpcSignalComparison | null;
  replaySignalSummary: ReplaySignalSummary | null;
  mpcEnergyReconcile: MpcEnergyReconcileBundle | null;
  mpcEvalCharts: MpcEvalChartBundle | null;
  mpcPriceLoadShift: PriceLoadShiftAnalysis | null;
  mpcCapacityTariff: CapacityTariffAnalysis | null;
  replayRunDisplayMeta: {
    incomplete: boolean;
    persistedStepCount: number;
    expectedStepCount: number;
    canonicalRunId: string | null;
  };
  mpcPipelineRun: MpcPipelineRunRecord;
};

export async function loadStyringAnalysisPayload(
  buildingSlug: string,
  view: StyringAnalysisViewId,
): Promise<StyringAnalysisPayload | null> {
  const access = await resolveInfraspawnBuildingForRead(buildingSlug);
  if (!access.ok) return null;

  const simulationProgress = await loadMpcSimulationProgress(access.building.id);
  const uiPipelineRun = await resolveUiMpcPipelineRunId(
    access.building.id,
    simulationProgress,
  );

  const artifacts = await loadMpcEvalArtifacts(access.building.id, {
    ...resolveStyringAnalysisLoadOptions(view),
    simulationProgress,
    pipelineRunId: uiPipelineRun.runId,
  });
  if (!artifacts) return null;

  const replaySignalSummary =
    artifacts.replaySteps.length > 0
      ? summarizeReplaySignals(artifacts.replaySteps)
      : null;

  return {
    replaySteps: artifacts.replaySteps,
    stepComparison: artifacts.stepComparison,
    replaySignalSummary,
    mpcEnergyReconcile: artifacts.energyReconcile,
    mpcEvalCharts: artifacts.charts,
    mpcPriceLoadShift: artifacts.priceLoadShift,
    mpcCapacityTariff: artifacts.capacityTariff,
    replayRunDisplayMeta: artifacts.displayMeta,
    mpcPipelineRun: artifacts.run,
  };
}
