import type { ControlStrategyComparison } from "./build-control-strategy-comparison";
import { buildControlStrategyComparison } from "./build-control-strategy-comparison";
import {
  buildMpcComfortSeries,
  buildMpcCostTimeline,
  buildMpcReplayEffectSummary,
  buildMpcReplayLoadProfile,
} from "./build-mpc-replay-profiles";
import { buildMpcHourTable } from "./build-mpc-hour-table";
import { buildPriceLoadShiftAnalysis, emptyPriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import type { PriceLoadShiftAnalysis } from "./build-price-load-shift-analysis";
import { buildMpcReplayVerification } from "./build-mpc-replay-verification";
import type { MpcReplayVerification } from "./build-mpc-replay-verification";
import type { MpcEvalChartBundle } from "./load-mpc-eval-artifacts";
import type { ReplaySignalSummary } from "./summarize-replay-signals";
import { summarizeReplaySignals, emptyReplaySignalSummary } from "./summarize-replay-signals";
import type {
  MpcPipelineResult,
  MpcReplayStep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import type { ResolvedMpcBuildingPreferences } from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";

type MpcPipelineUiArtifactsBase = {
  generatedAt: string;
  chartBundle: MpcEvalChartBundle;
  strategyComparison: ControlStrategyComparison;
  replaySignalSummary: ReplaySignalSummary;
};

export type MpcPipelineUiArtifactsV1 = MpcPipelineUiArtifactsBase & {
  version: 1;
};

export type MpcPipelineUiArtifactsV2 = MpcPipelineUiArtifactsBase & {
  version: 2;
  generatedFromStepCount: number;
  priceLoadShift: PriceLoadShiftAnalysis;
  verification: MpcReplayVerification;
};

export type MpcPipelineUiArtifacts =
  | MpcPipelineUiArtifactsV1
  | MpcPipelineUiArtifactsV2;

export function buildMpcPipelineUiArtifacts(input: {
  result: MpcPipelineResult;
  steps: readonly MpcReplayStep[];
}): MpcPipelineUiArtifactsV2 {
  const { result, steps } = input;
  const replaySummary = result.replay.summary;
  const priceLoadShift =
    buildPriceLoadShiftAnalysis(steps) ?? emptyPriceLoadShiftAnalysis();

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    generatedFromStepCount: steps.length,
    chartBundle: {
      costTimeline: buildMpcCostTimeline(steps),
      comfort: buildMpcComfortSeries(steps),
      loadProfile: buildMpcReplayLoadProfile(steps),
      effectSummary: buildMpcReplayEffectSummary(replaySummary, steps),
      hourTable: buildMpcHourTable(steps),
    },
    strategyComparison: buildControlStrategyComparison(replaySummary),
    replaySignalSummary:
      summarizeReplaySignals(steps) ?? emptyReplaySignalSummary(),
    priceLoadShift,
    verification: buildMpcReplayVerification({
      steps,
      evalStart: result.evalStart,
      evalEnd: result.evalEnd,
      priceLoadShift,
      replaySummary,
    }),
  };
}

export function parseMpcPipelineUiArtifacts(
  value: unknown,
): MpcPipelineUiArtifacts | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<MpcPipelineUiArtifactsV1>;
  if (
    (record.version !== 1 && record.version !== 2) ||
    !record.chartBundle ||
    !record.strategyComparison
  ) {
    return null;
  }
  return value as MpcPipelineUiArtifacts;
}

export function parsePriceLoadShiftSummary(
  value: unknown,
): PriceLoadShiftAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PriceLoadShiftAnalysis>;
  if (!record.bands || record.deltaE_hp_kwh == null) return null;
  return value as PriceLoadShiftAnalysis;
}

export function uiArtifactsMatchRun(
  artifacts: MpcPipelineUiArtifacts | null,
  stepCount: number,
): boolean {
  if (!artifacts) return false;
  if (artifacts.version === 2) {
    return artifacts.generatedFromStepCount === stepCount;
  }
  return stepCount > 0;
}

export type MpcPreferencesSnapshot = {
  version: 1;
  capturedAt: string;
  preferences: ResolvedMpcBuildingPreferences;
};

export function buildMpcPreferencesSnapshot(
  preferences: ResolvedMpcBuildingPreferences,
): MpcPreferencesSnapshot {
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    preferences,
  };
}
