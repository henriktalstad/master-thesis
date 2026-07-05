import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { summarizeSupplySetpointTracking, type SupplyTrackingSummary } from "./summarize-supply-tracking";

export type ReplaySignalSummary = {
  stepCount: number;
  feedforward: {
    stepsWithOutdoorTemp: number;
    stepsWithOutdoorTempBms: number;
    stepsWithPrice: number;
    outdoorTempMeanC: number | null;
    outdoorTempBmsMeanC: number | null;
    priceMeanKrPerKwh: number | null;
  };
  feedback: {
    stepsWithUMeas: number;
    stepsWithExtractMeas: number;
    uMeasCoveragePct: number;
    extractMeasMeanC: number | null;
  };
  supplyTracking: SupplyTrackingSummary;
  latestStep: ReplaySignalSample | null;
  midStep: ReplaySignalSample | null;
};

export type ReplaySignalSample = {
  t: string;
  outdoorTempC: number | null;
  outdoorTempBmsC: number | null;
  marginalKrPerKwh: number | null;
  extractTempMeasC: number | null;
  extractTempPredC: number | null;
  supplySetpointC: number | null;
  supplyTempMeasC: number | null;
  usedFallback: boolean;
  hasUMeas: boolean;
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function summarizeReplaySignals(
  steps: readonly MpcReplayStep[],
): ReplaySignalSummary | null {
  if (steps.length === 0) return null;

  const outdoorTemps: number[] = [];
  const outdoorBmsTemps: number[] = [];
  const prices: number[] = [];
  const extractMeas: number[] = [];
  let stepsWithOutdoorTemp = 0;
  let stepsWithOutdoorTempBms = 0;
  let stepsWithPrice = 0;
  let stepsWithUMeas = 0;
  let stepsWithExtractMeas = 0;

  for (const step of steps) {
    if (step.outdoorTempC != null) {
      stepsWithOutdoorTemp += 1;
      outdoorTemps.push(step.outdoorTempC);
    }
    if (step.outdoorTempBmsC != null) {
      stepsWithOutdoorTempBms += 1;
      outdoorBmsTemps.push(step.outdoorTempBmsC);
    }
    if (step.marginalKrPerKwh != null) {
      stepsWithPrice += 1;
      prices.push(step.marginalKrPerKwh);
    }
    if (step.uBmsMeas) stepsWithUMeas += 1;
    if (step.extractTempMeasC != null) {
      stepsWithExtractMeas += 1;
      extractMeas.push(step.extractTempMeasC);
    }
  }

  const roundTemp = (value: number | null | undefined): number | null => {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.round(value * 10) / 10;
  };

  const roundPrice = (value: number | null | undefined): number | null => {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.round(value * 1000) / 1000;
  };

  const toSample = (step: MpcReplayStep): ReplaySignalSample => ({
    t: step.t,
    outdoorTempC: roundTemp(step.outdoorTempC),
    outdoorTempBmsC: roundTemp(step.outdoorTempBmsC),
    marginalKrPerKwh: roundPrice(step.marginalKrPerKwh),
    extractTempMeasC: roundTemp(step.extractTempMeasC),
    extractTempPredC: roundTemp(step.extractTempPredC),
    supplySetpointC: roundTemp(step.uBmsMeas?.supplySetpointC),
    supplyTempMeasC: roundTemp(step.supplyTempMeasC),
    usedFallback: step.usedFallback,
    hasUMeas: step.uBmsMeas != null,
  });

  const midIndex = Math.floor(steps.length / 2);
  const supplyTracking = summarizeSupplySetpointTracking(steps);

  return {
    stepCount: steps.length,
    feedforward: {
      stepsWithOutdoorTemp,
      stepsWithOutdoorTempBms,
      stepsWithPrice,
      outdoorTempMeanC: mean(outdoorTemps),
      outdoorTempBmsMeanC: mean(outdoorBmsTemps),
      priceMeanKrPerKwh: mean(prices),
    },
    feedback: {
      stepsWithUMeas,
      stepsWithExtractMeas,
      uMeasCoveragePct:
        Math.round((stepsWithUMeas / steps.length) * 1000) / 10,
      extractMeasMeanC: mean(extractMeas),
    },
    supplyTracking,
    latestStep: toSample(steps[steps.length - 1]!),
    midStep: toSample(steps[midIndex]!),
  };
}

export function emptyReplaySignalSummary(): ReplaySignalSummary {
  return {
    stepCount: 0,
    feedforward: {
      stepsWithOutdoorTemp: 0,
      stepsWithOutdoorTempBms: 0,
      stepsWithPrice: 0,
      outdoorTempMeanC: null,
      outdoorTempBmsMeanC: null,
      priceMeanKrPerKwh: null,
    },
    feedback: {
      stepsWithUMeas: 0,
      stepsWithExtractMeas: 0,
      uMeasCoveragePct: 0,
      extractMeasMeanC: null,
    },
    supplyTracking: {
      comparedSteps: 0,
      maeSetpointTrackingC: null,
      latestDeltaC: null,
    },
    latestStep: null,
    midStep: null,
  };
}
