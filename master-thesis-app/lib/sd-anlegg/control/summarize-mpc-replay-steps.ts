import type { MpcReplayResult, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { buildPolicySummaries } from "@/lib/sd-anlegg/mpc/pipeline/build-policy-summaries";
import { countMpcVsObservedDeltaSteps } from "@/lib/sd-anlegg/mpc/pipeline/count-meaningful-delta-steps";
import { applyComfortAggregatesToSummary } from "@/lib/sd-anlegg/mpc/pipeline/comfort-violation-counts";
import { isHeatingDemandActive } from "@/lib/sd-anlegg/envelope-model/power/build-proxies";
import { summarizeTr003MeasuredEnergy } from "@/lib/sd-anlegg/envelope-model/power/district-heat-ground-truth";
import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import type { MpcFallbackReason } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import {
  emptyFallbackByReason,
  inferFallbackReasonFromReplayStep,
  recordFallbackReason,
} from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";

function stepElectricKw(
  step: MpcReplayStep,
  track: "baseline" | "emulated" | "mpc" | "demand",
): number {
  const stepHours = MPC_STEP_MINUTES / 60;
  if (track === "baseline") {
    if (step.proxyElKwhBaseline != null) return step.proxyElKwhBaseline / stepHours;
    return step.uBmsMeas ? step.electricKw : 0;
  }
  if (track === "emulated") {
    if (step.proxyElKwhEmulated != null) return step.proxyElKwhEmulated / stepHours;
    return step.uBmsMeas ? step.electricKw : 0;
  }
  if (track === "mpc") {
    if (step.proxyElKwhMpc != null) return step.proxyElKwhMpc / stepHours;
    return step.electricKw;
  }
  if (step.proxyElKwhDemand != null) return step.proxyElKwhDemand / stepHours;
  return step.electricKw;
}

function stepHeatKw(
  step: MpcReplayStep,
  track: "baseline" | "emulated" | "mpc" | "demand",
): number {
  const stepHours = MPC_STEP_MINUTES / 60;
  let kw = 0;
  if (track === "baseline") {
    if (step.proxyHeatKwhBaseline != null) kw = step.proxyHeatKwhBaseline / stepHours;
    else if (step.uBmsMeas) kw = step.heatKw;
  } else if (track === "emulated") {
    if (step.proxyHeatKwhEmulated != null) kw = step.proxyHeatKwhEmulated / stepHours;
    else if (step.uBmsMeas) kw = step.heatKw;
  } else if (track === "mpc") {
    if (step.proxyHeatKwhMpc != null) kw = step.proxyHeatKwhMpc / stepHours;
    else kw = step.heatKw;
  } else if (step.proxyHeatKwhDemand != null) {
    kw = step.proxyHeatKwhDemand / stepHours;
  } else {
    kw = step.heatKw;
  }
  return Number.isFinite(kw) ? kw : 0;
}

/**
 * Aggreger replay-KPI fra lagrede 15-min steg (uten å kjøre optimizer på nytt).
 */
export function summarizeMpcReplaySteps(
  steps: readonly MpcReplayStep[],
): MpcReplayResult["summary"] | null {
  if (steps.length === 0) return null;

  let totalCostBaseline = 0;
  let totalCostEmulated = 0;
  let totalCostMpc = 0;
  let totalCostDemand = 0;
  let peakBaseline = 0;
  let peakEmulated = 0;
  let peakMpc = 0;
  let peakDemand = 0;
  let fallbackSteps = 0;
  let optimizedSteps = 0;
  let skippedSteps = 0;
  const fallbackByReason = emptyFallbackByReason();
  let ctrlElBase = 0;
  let ctrlElEmulated = 0;
  let ctrlElMpc = 0;
  let ctrlElDemand = 0;
  let ctrlHeatBase = 0;
  let ctrlHeatEmulated = 0;
  let ctrlHeatMpc = 0;
  let ctrlHeatDemand = 0;
  let heatingActiveSteps = 0;
  const stepHours = MPC_STEP_MINUTES / 60;

  for (const step of steps) {
    totalCostBaseline += step.costBaselineKr;
    totalCostEmulated += step.costEmulatedKr ?? step.costBaselineKr;
    totalCostMpc += step.costMpcKr;
    totalCostDemand += step.costDemandKr ?? step.costEmulatedKr ?? step.costBaselineKr;

    const baselineElKw = stepElectricKw(step, "baseline");
    const emulatedElKw = stepElectricKw(step, "emulated");
    const mpcElKw = stepElectricKw(step, "mpc");
    const demandElKw = stepElectricKw(step, "demand");
    const baselineHtKw = stepHeatKw(step, "baseline");
    const emulatedHtKw = stepHeatKw(step, "emulated");
    const mpcHtKw = stepHeatKw(step, "mpc");
    const demandHtKw = stepHeatKw(step, "demand");

    peakBaseline = Math.max(peakBaseline, baselineElKw);
    peakEmulated = Math.max(peakEmulated, emulatedElKw);
    peakMpc = Math.max(peakMpc, mpcElKw);
    peakDemand = Math.max(peakDemand, demandElKw);
    ctrlElBase += baselineElKw * stepHours;
    ctrlElEmulated += emulatedElKw * stepHours;
    ctrlElMpc += mpcElKw * stepHours;
    ctrlElDemand += demandElKw * stepHours;
    ctrlHeatBase += baselineHtKw * stepHours;
    ctrlHeatEmulated += emulatedHtKw * stepHours;
    ctrlHeatMpc += mpcHtKw * stepHours;
    ctrlHeatDemand += demandHtKw * stepHours;

    if (!step.uBmsMeas) {
      skippedSteps += 1;
    }
    if (step.usedFallback || !step.uBmsMeas) {
      fallbackSteps += 1;
      const reason: MpcFallbackReason = !step.uBmsMeas
        ? "missing_u_meas"
        : inferFallbackReasonFromReplayStep(step);
      recordFallbackReason(fallbackByReason, reason);
    } else {
      optimizedSteps += 1;
    }

    if (isHeatingDemandActive(step.uBmsMeas ?? step.uBmsSim)) {
      heatingActiveSteps += 1;
    }
  }

  const stepCount = steps.length;
  const deltaCost = totalCostMpc - totalCostBaseline;
  const deltaVsEmulated = totalCostMpc - totalCostEmulated;
  const deltaDemand = totalCostDemand - totalCostBaseline;
  const optimizableSteps = steps.filter((s) => s.uBmsMeas != null).length;
  const optimizablePct = stepCount > 0 ? optimizableSteps / stepCount : 0;
  const mpcVsObserved = countMpcVsObservedDeltaSteps(steps);
  const measuredTr003HeatKwh =
    Math.round(
      summarizeTr003MeasuredEnergy({ steps }).groundTruthKwh * 100,
    ) / 100;
  const heatingActiveStepPct =
    stepCount > 0
      ? Math.round((heatingActiveSteps / stepCount) * 1000) / 10
      : 0;

  const summary: MpcReplayResult["summary"] = {
    stepCount,
    fallbackSteps,
    optimizedSteps,
    optimizableSteps,
    optimizablePct: Math.round(optimizablePct * 1000) / 1000,
    fallbackPct: stepCount > 0 ? Math.round((fallbackSteps / stepCount) * 1000) / 1000 : 0,
    fallbackByReason,
    skippedSteps,
    comfortViolationsMpc: 0,
    comfortViolationsBaseline: 0,
    comfortViolationsEmulated: 0,
    comfortViolationsDemand: 0,
    totalCostBaselineKr: Math.round(totalCostBaseline * 100) / 100,
    totalCostEmulatedKr: Math.round(totalCostEmulated * 100) / 100,
    totalCostMpcKr: Math.round(totalCostMpc * 100) / 100,
    totalCostDemandKr: Math.round(totalCostDemand * 100) / 100,
    deltaCostDemandKr: Math.round(deltaDemand * 100) / 100,
    deltaCostDemandPct:
      totalCostBaseline > 0
        ? Math.round((deltaDemand / totalCostBaseline) * 1000) / 10
        : 0,
    deltaCostKr: Math.round(deltaCost * 100) / 100,
    deltaCostPct:
      totalCostBaseline > 0
        ? Math.round((deltaCost / totalCostBaseline) * 1000) / 10
        : 0,
    deltaCostVsEmulatedKr: Math.round(deltaVsEmulated * 100) / 100,
    deltaCostVsEmulatedPct:
      totalCostEmulated > 0
        ? Math.round((deltaVsEmulated / totalCostEmulated) * 1000) / 10
        : 0,
    peakElectricKwBaseline: Math.round(peakBaseline * 10) / 10,
    peakElectricKwEmulated: Math.round(peakEmulated * 10) / 10,
    peakElectricKwMpc: Math.round(peakMpc * 10) / 10,
    peakElectricKwDemand: Math.round(peakDemand * 10) / 10,
    controllableElectricKwhBaseline: Math.round(ctrlElBase * 100) / 100,
    controllableElectricKwhEmulated: Math.round(ctrlElEmulated * 100) / 100,
    controllableElectricKwhMpc: Math.round(ctrlElMpc * 100) / 100,
    controllableElectricKwhDemand: Math.round(ctrlElDemand * 100) / 100,
    controllableHeatKwhBaseline: Math.round(ctrlHeatBase * 100) / 100,
    controllableHeatKwhEmulated: Math.round(ctrlHeatEmulated * 100) / 100,
    controllableHeatKwhMpc: Math.round(ctrlHeatMpc * 100) / 100,
    controllableHeatKwhDemand: Math.round(ctrlHeatDemand * 100) / 100,
    meaningfulDeltaSteps: mpcVsObserved.deltaSteps,
    meaningfulDeltaPct: mpcVsObserved.deltaPct,
    mpcVsObservedDeltaSteps: mpcVsObserved.deltaSteps,
    mpcVsObservedDeltaPct: mpcVsObserved.deltaPct,
    mpcVsObservedEligibleSteps: mpcVsObserved.eligibleSteps,
    heatingActiveStepPct,
    measuredTr003HeatKwh,
  };

  applyComfortAggregatesToSummary(summary, steps);
  summary.policySummaries = buildPolicySummaries(summary);
  return summary;
}
