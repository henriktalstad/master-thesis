import { countMpcVsObservedDeltaSteps } from "@/lib/sd-anlegg/mpc/pipeline/count-meaningful-delta-steps";
import {
  assessPlantPredictionBounded,
  type ComfortBandC,
  type PlantPredictionBoundedAssessment,
} from "@/lib/sd-anlegg/mpc/pipeline/assess-plant-prediction-error";
import {
  assessMpcStepValidity,
  countOptimizableSteps,
  emptyFallbackByReason,
  recordFallbackReason,
} from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import type { PriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import { buildPriceLoadShiftAnalysis } from "@/lib/sd-anlegg/control/build-price-load-shift-analysis";
import type { MpcReplayStep, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

export type MpcE2eHealth = "green" | "amber" | "red";

export type MpcE2eDiagnosis = {
  generatedAt: string;
  source: "db" | "dataset" | "replay_steps";
  evalStart: string | null;
  evalEnd: string | null;
  stepCount: number;
  uMeasCoveragePct: {
    supplySetpointC: number;
    supplyFanPct: number;
    heatingValvePct: number;
    exhaustFanPct: number;
    coolingValvePct: number;
    fullVector: number;
  };
  optimizablePct: number;
  fallbackPct: number;
  fallbackByReason: {
    missing_u_meas: number;
    simultaneous_heat_cool: number;
    alarm: number;
    pump_fault: number;
  };
  meaningfulDeltaPct: number;
  priceLoadShift: PriceLoadShiftAnalysis | null;
  replaySummary: Record<string, unknown> | null;
  plantPrediction: PlantPredictionBoundedAssessment | null;
  health: MpcE2eHealth;
  blockers: string[];
};

type UMeasChannel =
  | "supplySetpointC"
  | "supplyFanPct"
  | "heatingValvePct"
  | "exhaustFanPct"
  | "coolingValvePct";

function channelCoverage(
  steps: readonly MpcTimestep[],
  channel: UMeasChannel,
): number {
  if (steps.length === 0) return 0;
  const present = steps.filter((step) => step.uMeas?.[channel] != null).length;
  return Math.round((present / steps.length) * 1000) / 10;
}

export function analyzeMpcTimesteps(
  steps: readonly MpcTimestep[],
): Pick<
  MpcE2eDiagnosis,
  "stepCount" | "uMeasCoveragePct" | "optimizablePct" | "fallbackByReason"
> {
  const { optimizablePct } = countOptimizableSteps(steps);
  const fallbackByReason = emptyFallbackByReason();
  for (const step of steps) {
    const validity = assessMpcStepValidity(step);
    if (!validity.canOptimize) {
      recordFallbackReason(fallbackByReason, validity.fallbackReason);
    }
  }

  const fullVector = steps.filter((s) => s.uMeas != null).length;

  return {
    stepCount: steps.length,
    uMeasCoveragePct: {
      supplySetpointC: channelCoverage(steps, "supplySetpointC"),
      supplyFanPct: channelCoverage(steps, "supplyFanPct"),
      heatingValvePct: channelCoverage(steps, "heatingValvePct"),
      exhaustFanPct: channelCoverage(steps, "exhaustFanPct"),
      coolingValvePct: channelCoverage(steps, "coolingValvePct"),
      fullVector:
        steps.length > 0
          ? Math.round((fullVector / steps.length) * 1000) / 10
          : 0,
    },
    optimizablePct: Math.round(optimizablePct * 1000) / 10,
    fallbackByReason,
  };
}

export function analyzeMpcReplaySteps(
  replaySteps: readonly MpcReplayStep[],
): Pick<MpcE2eDiagnosis, "fallbackPct" | "meaningfulDeltaPct"> {
  if (replaySteps.length === 0) {
    return { fallbackPct: 0, meaningfulDeltaPct: 0 };
  }
  const fallbackSteps = replaySteps.filter((s) => s.usedFallback).length;
  const { deltaPct } = countMpcVsObservedDeltaSteps(replaySteps);
  return {
    fallbackPct: Math.round((fallbackSteps / replaySteps.length) * 1000) / 10,
    meaningfulDeltaPct: deltaPct,
  };
}

export function resolveMpcE2eHealth(input: {
  uMeasFullPct: number;
  optimizablePct: number;
  fallbackPct: number;
  meaningfulDeltaPct: number;
  highPriceShiftPct: number | null;
  plantPredictionBlocker?: string | null;
}): { health: MpcE2eHealth; blockers: string[] } {
  const blockers: string[] = [];

  if (input.plantPredictionBlocker) {
    blockers.push(input.plantPredictionBlocker);
  }

  if (input.uMeasFullPct < 90) {
    blockers.push(
      `uMeas-dekning ${input.uMeasFullPct} % — mål ≥ 90 % (backfill SD 15m)`,
    );
  }
  if (input.optimizablePct < 85) {
    blockers.push(
      `Optimiserbare steg ${input.optimizablePct} % — sjekk HC-stuck og alarm`,
    );
  }
  if (input.fallbackPct > 10) {
    blockers.push(`Fallback ${input.fallbackPct} % — MPC kjører ikke optimizer`);
  }
  if (input.meaningfulDeltaPct < 5 && input.fallbackPct <= 10) {
    blockers.push(
      `Kun ${input.meaningfulDeltaPct} % steg med δu — solver endrer lite`,
    );
  }
  if (
    input.meaningfulDeltaPct >= 20 &&
    input.highPriceShiftPct != null &&
    Math.abs(input.highPriceShiftPct) < 0.5
  ) {
    blockers.push(
      `δu ${input.meaningfulDeltaPct} % men minimal høypris-flytting (${input.highPriceShiftPct} %) — proxy kan være prisufølsom`,
    );
  }

  if (blockers.length === 0) return { health: "green", blockers: [] };
  if (
    input.uMeasFullPct < 70 ||
    input.fallbackPct > 25 ||
    input.optimizablePct < 60
  ) {
    return { health: "red", blockers };
  }
  return { health: "amber", blockers };
}

export function buildMpcE2eDiagnosis(input: {
  source: MpcE2eDiagnosis["source"];
  evalStart: string | null;
  evalEnd: string | null;
  timesteps: readonly MpcTimestep[];
  replaySteps?: readonly MpcReplayStep[];
  replaySummary?: Record<string, unknown> | null;
  plantRmseC?: number | null;
  comfortBandC?: ComfortBandC;
}): MpcE2eDiagnosis {
  const timestepAnalysis = analyzeMpcTimesteps(input.timesteps);
  const replayAnalysis = input.replaySteps
    ? analyzeMpcReplaySteps(input.replaySteps)
    : { fallbackPct: 0, meaningfulDeltaPct: 0 };
  const priceLoadShift = input.replaySteps
    ? buildPriceLoadShiftAnalysis(input.replaySteps)
    : null;

  const plantPrediction =
    input.comfortBandC != null
      ? assessPlantPredictionBounded({
          rmseC: input.plantRmseC,
          comfortBandC: input.comfortBandC,
        })
      : null;

  const { health, blockers } = resolveMpcE2eHealth({
    uMeasFullPct: timestepAnalysis.uMeasCoveragePct.fullVector,
    optimizablePct: timestepAnalysis.optimizablePct,
    fallbackPct: replayAnalysis.fallbackPct,
    meaningfulDeltaPct: replayAnalysis.meaningfulDeltaPct,
    highPriceShiftPct: priceLoadShift?.deltaE_hp_pct ?? null,
    plantPredictionBlocker: plantPrediction?.blockerMessage,
  });

  return {
    generatedAt: new Date().toISOString(),
    source: input.source,
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
    ...timestepAnalysis,
    ...replayAnalysis,
    priceLoadShift,
    replaySummary: input.replaySummary ?? null,
    plantPrediction,
    health,
    blockers,
  };
}
