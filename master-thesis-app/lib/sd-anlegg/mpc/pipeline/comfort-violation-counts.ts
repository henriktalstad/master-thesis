import { comfortViolation } from "@/lib/sd-anlegg/mpc/config/mpc-comfort";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";

export type ComfortViolationAggregate = {
  /** Measured extract temperature — observed proxy (legacy asymmetric KPI). */
  observedMeasuredProxy: number;
  /** Plant-predicted extract under each control track (harmonized comparison). */
  harmonizedObserved: number;
  harmonizedEmulated: number;
  harmonizedMpc: number;
  harmonizedDemand: number;
};

function stepBand(step: MpcReplayStep): { min: number; max: number } {
  return {
    min: step.comfortBandMinC ?? 18,
    max: step.comfortBandMaxC ?? 24,
  };
}

function isViolation(temp: number | null | undefined, band: { min: number; max: number }): boolean {
  if (temp == null || !Number.isFinite(temp)) return false;
  return comfortViolation(temp, band) > 0;
}

/** Aggregate comfort-proxy violations from replay steps. */
export function aggregateComfortViolationsFromSteps(
  steps: readonly MpcReplayStep[],
): ComfortViolationAggregate {
  let observedMeasuredProxy = 0;
  let harmonizedObserved = 0;
  let harmonizedEmulated = 0;
  let harmonizedMpc = 0;
  let harmonizedDemand = 0;

  for (const step of steps) {
    const band = stepBand(step);
    if (isViolation(step.extractTempMeasC, band)) {
      observedMeasuredProxy += 1;
    }
    if (step.comfortViolationEmulated || isViolation(step.extractTempPredEmulatedC, band)) {
      harmonizedEmulated += 1;
    }
    if (step.comfortViolation || isViolation(step.extractTempPredC, band)) {
      harmonizedMpc += 1;
    }
    if (step.comfortViolationDemand || isViolation(step.extractTempPredDemandC, band)) {
      harmonizedDemand += 1;
    }
    const observedPred =
      step.extractTempPredObservedC ??
      (step.uBmsMeas ? step.extractTempPredEmulatedC : null);
    if (isViolation(observedPred, band)) {
      harmonizedObserved += 1;
    }
  }

  return {
    observedMeasuredProxy,
    harmonizedObserved,
    harmonizedEmulated,
    harmonizedMpc,
    harmonizedDemand,
  };
}

export function applyComfortAggregatesToSummary<
  T extends {
    comfortViolationsBaseline: number;
    comfortViolationsEmulated: number;
    comfortViolationsMpc: number;
    comfortViolationsDemand: number;
    comfortViolationsObservedProxy?: number;
    comfortViolationsHarmonizedObserved?: number;
  },
>(summary: T, steps: readonly MpcReplayStep[]): T {
  const agg = aggregateComfortViolationsFromSteps(steps);
  summary.comfortViolationsBaseline = agg.observedMeasuredProxy;
  summary.comfortViolationsObservedProxy = agg.observedMeasuredProxy;
  summary.comfortViolationsHarmonizedObserved = agg.harmonizedObserved;
  summary.comfortViolationsEmulated = agg.harmonizedEmulated;
  summary.comfortViolationsMpc = agg.harmonizedMpc;
  summary.comfortViolationsDemand = agg.harmonizedDemand;
  return summary;
}
