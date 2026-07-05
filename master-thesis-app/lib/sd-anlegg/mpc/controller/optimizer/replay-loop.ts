import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
  resolvePowerFlowAnchor,
  stepEnergyCostKr,
  breakdownHeatingDemandKw,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import { summarizeHeatingDemandFromSteps } from "@/lib/sd-anlegg/control/summarize-heating-demand";
import type { MpcReplayLoopState } from "@/lib/sd-anlegg/control/mpc-simulation-checkpoint";
import { buildPolicySummaries } from "@/lib/sd-anlegg/mpc/pipeline/build-policy-summaries";
import { applyComfortAggregatesToSummary } from "@/lib/sd-anlegg/mpc/pipeline/comfort-violation-counts";
import {
  countMpcVsObservedDeltaSteps,
} from "@/lib/sd-anlegg/mpc/pipeline/count-meaningful-delta-steps";
import {
  zeroControlVector,
  deltaControlVectors,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/control-vector";
import { buildReplayStepRecord } from "@/lib/sd-anlegg/mpc/controller/optimizer/build-replay-step-record";
import {
  buildMpcSearchAnchorHorizon,
  solveMpcHorizon,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/solve-horizon";
import {
  buildChannelEnabledHorizon,
  type ResolvedMpcBuildingPreferences,
} from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import {
  assessMpcStepValidity,
  countOptimizableSteps,
  emptyFallbackByReason,
  recordFallbackReason,
} from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import { isDisturbedOperationStep } from "@/lib/sd-anlegg/mpc/config/constraints/normal-drift-step";
import {
  predictExtractTemperature,
  predictHeatRecoveryAfterTemp,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/fit-plant-model";
import {
  computeEmulatedControl,
  computeDemandControlFromTimestep,
} from "@/lib/sd-anlegg/mpc/controller/policies";
import {
  buildDailyPriceThresholdsFromSteps,
  buildPriceThresholdsFromSteps,
} from "@/lib/sd-anlegg/mpc/forecasts/price-thresholds";
import type {
  MpcCalibrationBundle,
  MpcControlVector,
  MpcPipelineResult,
  MpcReplayResult,
  MpcReplayStep,
  MpcSolverConfig,
  MpcTimestep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_STEP_MINUTES } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import {
  buildComfortBandHorizon,
  buildComfortLambdaHorizon,
  buildLambdaMoveHorizon,
  resolveComfortBandForStepWithOccupancy,
} from "@/lib/sd-anlegg/mpc/config/comfort-schedule";
import {
  alignEmulatedControlWithMeasured,
  applyOccupancyAnchorHorizon,
  applyOccupancyToControlAnchor,
  buildOccupancyHorizon,
  resolveOccupancyForStep,
  type OccupancyAnchorOptions,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import { solverConfigFromPreferences } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";

function marginalPrice(step: MpcTimestep): number | null {
  return step.effectiveMarginalKrPerKwh ?? step.spotKrPerKwh;
}

function heatingDemandKwhForControl(input: {
  u: MpcControlVector;
  step: MpcTimestep;
  power: MpcCalibrationBundle["power"];
  stepHours: number;
}): { batteryKwh: number; districtKwh: number } {
  const breakdown = breakdownHeatingDemandKw({
    u: input.u,
    outdoorTempC: input.step.outdoorTempC,
    buildingDistrictHeatingKwh: input.step.buildingDistrictHeatingKwh,
    params: input.power,
  });
  return {
    batteryKwh: breakdown.batteryKw * input.stepHours,
    districtKwh: breakdown.districtKw * input.stepHours,
  };
}

function initialExtractTemp(steps: readonly MpcTimestep[], index: number): number {
  for (let i = index; i >= 0; i--) {
    const value = steps[i]?.extractTempC;
    if (value != null) return value;
  }
  return 20;
}

function initialHeatRecoveryTemp(
  steps: readonly MpcTimestep[],
  index: number,
): number | null {
  for (let i = index; i >= 0; i--) {
    const value = steps[i]?.heatRecoveryAfterTempC;
    if (value != null) return value;
  }
  return null;
}

function predictExtractForControl(input: {
  u: MpcControlVector;
  tExtPrev: number;
  step: MpcTimestep;
  calibration: MpcCalibrationBundle;
}): number | null {
  return predictExtractTemperature({
    params: input.calibration.plant,
    tExtPrev: input.tExtPrev,
    u: input.u,
    step: input.step,
  });
}

function advanceHeatRecoveryState(input: {
  calibration: MpcCalibrationBundle;
  tExtPrev: number;
  tRecPrev: number | null;
  u: MpcControlVector;
  step: MpcTimestep;
  measuredC: number | null;
}): number | null {
  if (!input.calibration.plant.heatRecoveryState || input.tRecPrev == null) {
    return input.measuredC;
  }
  const predicted = predictHeatRecoveryAfterTemp({
    params: input.calibration.plant,
    tExtPrev: input.tExtPrev,
    tRecPrev: input.tRecPrev,
    u: input.u,
    step: input.step,
  });
  if (predicted == null) return input.measuredC;
  return predicted;
}

/** Historisk multi-policy replay — receding horizon MPC + demand-scoped parallelt. */
export function runHistoricalMpcReplay(input: {
  steps: readonly MpcTimestep[];
  calibration: MpcCalibrationBundle;
  replayStartIndex?: number;
  replayEndIndex?: number;
  initialTExt?: number;
  initialState?: MpcReplayLoopState;
  solverConfig?: MpcSolverConfig;
  buildingPreferences?: ResolvedMpcBuildingPreferences;
  onProgress?: (progress: {
    stepIndex: number;
    totalSteps: number;
    elapsedMs: number;
    fallbackSteps: number;
  }) => void;
}): MpcReplayResult {
  const { calibration, steps } = input;
  const prefs = input.buildingPreferences;
  const config =
    input.solverConfig ??
    (prefs
      ? solverConfigFromPreferences(prefs, calibration.solver)
      : calibration.solver);
  const startIdx = input.replayStartIndex ?? 0;
  const endIdx = input.replayEndIndex ?? steps.length;
  const totalSteps = endIdx - startIdx;
  const startedAt = Date.now();
  const priceThresholds = buildPriceThresholdsFromSteps(steps);
  const dailyPriceThresholds = buildDailyPriceThresholdsFromSteps(steps);

  const replaySteps: MpcReplayStep[] = [];
  const initialTExt = input.initialTExt ?? initialExtractTemp(steps, startIdx);
  const seeded = input.initialState;
  let tExtObserved = seeded?.tExtObserved ?? initialTExt;
  let tExtMpc = seeded?.tExtMpc ?? initialTExt;
  let tExtEmulated = seeded?.tExtEmulated ?? initialTExt;
  let tExtDemand = seeded?.tExtDemand ?? initialTExt;
  const initialTRec = initialHeatRecoveryTemp(steps, startIdx);
  let tRecMpc = seeded?.tRecMpc ?? initialTRec;
  let tRecEmulated = seeded?.tRecEmulated ?? initialTRec;

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
  let warmStartDelta: MpcControlVector[] | undefined = seeded?.warmStartDelta;
  let ctrlElBase = 0;
  let ctrlElEmulated = 0;
  let ctrlElMpc = 0;
  let ctrlElDemand = 0;
  let ctrlHeatBase = 0;
  let ctrlHeatEmulated = 0;
  let ctrlHeatMpc = 0;
  let ctrlHeatDemand = 0;

  const comfortSchedule = prefs?.comfortSchedule ?? null;
  const operatingProfile = prefs?.operatingProfile ?? null;
  const occupancyCalibration = calibration.occupancy ?? null;
  const setpointRampRate = config.bounds.maxDeltaPerStep.supplySetpointC;
  let prevAppliedBmsSim: MpcControlVector | null =
    seeded?.prevAppliedBmsSim ?? null;
  let prevAppliedMpc: MpcControlVector | null = seeded?.prevAppliedMpc ?? null;

  const occupancyAnchorOpts = (
    previousU: MpcControlVector | null,
  ): OccupancyAnchorOptions => ({
    previousU,
    setpointMaxDeltaPerStep: setpointRampRate,
  });

  for (let k = startIdx; k < endIdx; k++) {
    const step = steps[k]!;
    const occupancy =
      operatingProfile != null
        ? resolveOccupancyForStep(step, operatingProfile, occupancyCalibration)
        : { q: 1, source: "schedule" as const };
    const band = resolveComfortBandForStepWithOccupancy(
      step,
      comfortSchedule,
      config.comfortBandC,
      occupancy.q,
    );
    const uMeas = step.uMeas;
    const disturbed = isDisturbedOperationStep(step);
    const uBmsSimRaw = alignEmulatedControlWithMeasured(
      computeEmulatedControl(calibration, step, {
        tExtPrev: tExtEmulated,
        disturbed,
      }),
      uMeas,
    );
    const uBmsSim = applyOccupancyToControlAnchor(
      uBmsSimRaw,
      occupancy.q,
      occupancyAnchorOpts(prevAppliedBmsSim),
    );
    const tExtPrevMpc = tExtMpc;
    const tExtPrevEmulated = tExtEmulated;
    const tRecPrevMpc = tRecMpc;
    const tRecPrevEmulated = tRecEmulated;

    const validity = assessMpcStepValidity(step);
    const wouldNotDeploy = !validity.canOptimize;
    if (!step.uMeas) {
      skippedSteps += 1;
    }
    if (wouldNotDeploy) {
      fallbackSteps += 1;
      recordFallbackReason(fallbackByReason, validity.fallbackReason);
    }

    const policyCtx = {
      step,
      stepIndex: k,
      steps,
      calibration,
      tExtState: tExtMpc,
      uBmsSim,
      occupancyQ: occupancy.q,
      priceThresholds,
      dailyPriceThresholds,
      canOptimize: validity.canOptimize,
    };

    const demandResult = computeDemandControlFromTimestep(policyCtx);
    const uDemand = demandResult.u ?? uBmsSim;

    const horizonSlice = steps.slice(k, k + config.horizonSteps);
    const occupancyQHorizon =
      operatingProfile != null
        ? buildOccupancyHorizon(horizonSlice, operatingProfile, occupancyCalibration, {
            preferMeasured: false,
          })
        : undefined;

    const rawBmsHorizon = buildMpcSearchAnchorHorizon(
      steps,
      k,
      config.horizonSteps,
      calibration,
      undefined,
      tExtEmulated,
    );
    const occupancyQForAnchors =
      operatingProfile != null
        ? rawBmsHorizon.map((_, i) =>
            resolveOccupancyForStep(
              steps[k + i]!,
              operatingProfile,
              occupancyCalibration,
              { preferMeasured: i === 0 },
            ).q,
          )
        : rawBmsHorizon.map(() => 1);
    const uBmsHorizon = applyOccupancyAnchorHorizon(
      rawBmsHorizon,
      occupancyQForAnchors,
      occupancyAnchorOpts(prevAppliedBmsSim),
    );
    const channelEnabledHorizon = prefs
      ? buildChannelEnabledHorizon(
          prefs,
          steps,
          k,
          config.horizonSteps,
          uBmsSim,
          occupancyQHorizon,
        )
      : undefined;
    const comfortBandHorizon = comfortSchedule
      ? buildComfortBandHorizon(
          horizonSlice,
          comfortSchedule,
          config.comfortBandC,
          occupancyQHorizon,
        )
      : undefined;
    const comfortLambdaHorizon = comfortSchedule
      ? buildComfortLambdaHorizon(
          horizonSlice,
          comfortSchedule,
          config.lambdaComfort,
          occupancyQHorizon,
        )
      : undefined;
    const lambdaMoveHorizon = comfortSchedule
      ? buildLambdaMoveHorizon(horizonSlice, comfortSchedule)
      : undefined;

    const solution = solveMpcHorizon({
      startIndex: k,
      steps,
      uBmsSimHorizon: uBmsHorizon,
      tExtInitial: tExtMpc,
      tRecInitial: tRecPrevMpc,
      config,
      calibration,
      channelEnabledHorizon,
      comfortBandHorizon,
      comfortLambdaHorizon,
      lambdaMoveHorizon,
      warmStartDeltaHorizon: warmStartDelta,
      counterfactualOptimize: true,
    });

    const horizonLen = solution.deltaHorizon.length;
    warmStartDelta =
      horizonLen > 0
        ? [
            ...solution.deltaHorizon.slice(1),
            zeroControlVector(),
          ]
        : undefined;

    const uMpcRaw = solution.uHorizon[0] ?? uBmsSimRaw;
    const uMpc = applyOccupancyToControlAnchor(
      uMpcRaw,
      occupancy.q,
      occupancyAnchorOpts(prevAppliedMpc),
    );
    prevAppliedBmsSim = uBmsSim;
    prevAppliedMpc = uMpc;
    const deltaReference = uMeas ?? uBmsSim;
    const deltaU = deltaControlVectors(uMpc, deltaReference);
    if (validity.canOptimize) {
      optimizedSteps += 1;
    }

    let extractPredMpc: number | null = solution.predictedExtractC[0] ?? null;
    if (extractPredMpc == null) {
      extractPredMpc = predictExtractForControl({
        u: uMpc,
        tExtPrev: tExtPrevMpc,
        step,
        calibration,
      });
    }
    if (extractPredMpc != null) {
      tExtMpc = extractPredMpc;
    } else if (step.extractTempC != null) {
      tExtMpc = step.extractTempC;
    }

    if (step.extractTempC != null) {
      tExtObserved = step.extractTempC;
    }

    let extractPredObserved: number | null = null;
    if (uMeas) {
      extractPredObserved = predictExtractForControl({
        u: uMeas,
        tExtPrev: tExtObserved,
        step,
        calibration,
      });
      if (extractPredObserved != null) {
        tExtObserved = extractPredObserved;
      }
    } else if (step.extractTempC != null) {
      extractPredObserved = step.extractTempC;
    }

    const extractPredEmulated = predictExtractForControl({
      u: uBmsSim,
      tExtPrev: tExtPrevEmulated,
      step,
      calibration,
    });
    if (extractPredEmulated != null) {
      tExtEmulated = extractPredEmulated;
    } else if (step.extractTempC != null) {
      tExtEmulated = step.extractTempC;
    }

    const heatRecoveryPredMpc = advanceHeatRecoveryState({
      calibration,
      tExtPrev: tExtPrevMpc,
      tRecPrev: tRecPrevMpc,
      u: uMpc,
      step,
      measuredC: step.heatRecoveryAfterTempC ?? null,
    });
    if (heatRecoveryPredMpc != null) {
      tRecMpc = heatRecoveryPredMpc;
    }

    const heatRecoveryPredEmulated = advanceHeatRecoveryState({
      calibration,
      tExtPrev: tExtPrevEmulated,
      tRecPrev: tRecPrevEmulated,
      u: uBmsSim,
      step,
      measuredC: step.heatRecoveryAfterTempC ?? null,
    });
    if (heatRecoveryPredEmulated != null) {
      tRecEmulated = heatRecoveryPredEmulated;
    }

    const tExtPrevDemand = tExtDemand;
    const extractPredDemand = predictExtractForControl({
      u: uDemand,
      tExtPrev: tExtPrevDemand,
      step,
      calibration,
    });
    if (extractPredDemand != null) {
      tExtDemand = extractPredDemand;
    } else if (step.extractTempC != null) {
      tExtDemand = step.extractTempC;
    }

    const flowAnchor = resolvePowerFlowAnchor(uMeas, uBmsSim);

    const baselineElectricKw = uMeas
      ? estimateControllableElectricKw({
          u: uMeas,
          buildingElectricityKwh: step.buildingElectricityKwh,
          outdoorTempC: step.outdoorTempC,
          params: calibration.power,
          step,
          uReference: flowAnchor,
        })
      : 0;
    const emulatedElectricKw = estimateControllableElectricKw({
      u: uBmsSim,
      buildingElectricityKwh: step.buildingElectricityKwh,
      outdoorTempC: step.outdoorTempC,
      params: calibration.power,
      step,
      uReference: flowAnchor,
    });
    const emulatedHeatKw = estimateControllableHeatKw({
      u: uBmsSim,
      outdoorTempC: step.outdoorTempC,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      params: calibration.power,
      step,
      uReference: flowAnchor,
    });
    const mpcElectricKw = estimateControllableElectricKw({
      u: uMpc,
      buildingElectricityKwh: step.buildingElectricityKwh,
      outdoorTempC: step.outdoorTempC,
      params: calibration.power,
      step,
      uReference: flowAnchor,
    });
    const demandElectricKw = estimateControllableElectricKw({
      u: uDemand,
      buildingElectricityKwh: step.buildingElectricityKwh,
      outdoorTempC: step.outdoorTempC,
      params: calibration.power,
      step,
      uReference: flowAnchor,
    });
    const baselineHeatKw = uMeas
      ? estimateControllableHeatKw({
          u: uMeas,
          outdoorTempC: step.outdoorTempC,
          buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
          params: calibration.power,
          step,
          uReference: flowAnchor,
        })
      : 0;
    const mpcHeatKw = estimateControllableHeatKw({
      u: uMpc,
      outdoorTempC: step.outdoorTempC,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      params: calibration.power,
      step,
      uReference: flowAnchor,
    });
    const demandHeatKw = estimateControllableHeatKw({
      u: uDemand,
      outdoorTempC: step.outdoorTempC,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      params: calibration.power,
      step,
      uReference: flowAnchor,
    });
    peakBaseline = Math.max(peakBaseline, baselineElectricKw);
    peakEmulated = Math.max(peakEmulated, emulatedElectricKw);
    peakMpc = Math.max(peakMpc, mpcElectricKw);
    peakDemand = Math.max(peakDemand, demandElectricKw);

    const stepHours = MPC_STEP_MINUTES / 60;
    ctrlElBase += baselineElectricKw * stepHours;
    ctrlElEmulated += emulatedElectricKw * stepHours;
    ctrlElMpc += mpcElectricKw * stepHours;
    ctrlElDemand += demandElectricKw * stepHours;
    ctrlHeatBase += baselineHeatKw * stepHours;
    ctrlHeatEmulated += emulatedHeatKw * stepHours;
    ctrlHeatMpc += mpcHeatKw * stepHours;
    ctrlHeatDemand += demandHeatKw * stepHours;

    const heatDemandCommon = {
      step,
      power: calibration.power,
      stepHours,
    };
    const heatObserved = uMeas
      ? heatingDemandKwhForControl({ u: uMeas, ...heatDemandCommon })
      : { batteryKwh: 0, districtKwh: 0 };
    const heatEmulated = heatingDemandKwhForControl({
      u: uBmsSim,
      ...heatDemandCommon,
    });
    const heatMpc = heatingDemandKwhForControl({
      u: uMpc,
      ...heatDemandCommon,
    });
    const heatDemandTrack = heatingDemandKwhForControl({
      u: uDemand,
      ...heatDemandCommon,
    });

    const costBase = stepEnergyCostKr({
      electricKw: baselineElectricKw,
      heatKw: baselineHeatKw,
      stepMinutes: config.stepMinutes,
      marginalKrPerKwh: marginalPrice(step),
      heatKrPerKwh: step.heatKrPerKwh,
    });
    const costEmulated = stepEnergyCostKr({
      electricKw: emulatedElectricKw,
      heatKw: emulatedHeatKw,
      stepMinutes: config.stepMinutes,
      marginalKrPerKwh: marginalPrice(step),
      heatKrPerKwh: step.heatKrPerKwh,
    });
    const costMpc = stepEnergyCostKr({
      electricKw: mpcElectricKw,
      heatKw: mpcHeatKw,
      stepMinutes: config.stepMinutes,
      marginalKrPerKwh: marginalPrice(step),
      heatKrPerKwh: step.heatKrPerKwh,
    });
    const costDemand = stepEnergyCostKr({
      electricKw: demandElectricKw,
      heatKw: demandHeatKw,
      stepMinutes: config.stepMinutes,
      marginalKrPerKwh: marginalPrice(step),
      heatKrPerKwh: step.heatKrPerKwh,
    });
    totalCostBaseline += costBase;
    totalCostEmulated += costEmulated;
    totalCostMpc += costMpc;
    totalCostDemand += costDemand;

    replaySteps.push(
      buildReplayStepRecord({
        step,
        uMeas,
        uBmsSim,
        uMpc,
        uDemand,
        deltaU,
        extractPred: extractPredMpc,
        heatRecoveryPred: heatRecoveryPredMpc,
        extractPredEmulated,
        extractPredDemand,
        extractPredObserved,
        comfortBandC: band,
        occupancyQ: occupancy.q,
        occupancySource: occupancy.source,
        usedFallback: wouldNotDeploy,
        fallbackReason: validity.fallbackReason,
        powerCosts: {
          stepHours,
          baselineElectricKw,
          emulatedElectricKw,
          mpcElectricKw,
          demandElectricKw,
          baselineHeatKw,
          emulatedHeatKw,
          mpcHeatKw,
          demandHeatKw,
          costBaselineKr: costBase,
          costEmulatedKr: costEmulated,
          costMpcKr: costMpc,
          costDemandKr: costDemand,
          marginalKrPerKwh: marginalPrice(step),
          heatingBatteryKwhBaseline: heatObserved.batteryKwh,
          heatingDistrictKwhBaseline: heatObserved.districtKwh,
          heatingBatteryKwhEmulated: heatEmulated.batteryKwh,
          heatingDistrictKwhEmulated: heatEmulated.districtKwh,
          heatingBatteryKwhMpc: heatMpc.batteryKwh,
          heatingDistrictKwhMpc: heatMpc.districtKwh,
          heatingBatteryKwhDemand: heatDemandTrack.batteryKwh,
          heatingDistrictKwhDemand: heatDemandTrack.districtKwh,
        },
      }),
    );

    input.onProgress?.({
      stepIndex: k - startIdx,
      totalSteps,
      elapsedMs: Date.now() - startedAt,
      fallbackSteps,
    });
  }

  const deltaCost = totalCostMpc - totalCostBaseline;
  const deltaVsEmulated = totalCostMpc - totalCostEmulated;
  const deltaDemand = totalCostDemand - totalCostBaseline;
  const replaySlice = steps.slice(startIdx);
  const { optimizableSteps, optimizablePct } = countOptimizableSteps(replaySlice);
  const mpcVsObserved = countMpcVsObservedDeltaSteps(replaySteps);
  const stepCount = replaySteps.length;
  const heatingDemand = summarizeHeatingDemandFromSteps({
    steps: replaySteps,
    power: calibration.power,
  });

  const summary: MpcReplayResult["summary"] = {
    stepCount,
    fallbackSteps,
    optimizedSteps,
    optimizableSteps,
    optimizablePct: Math.round(optimizablePct * 1000) / 1000,
    fallbackPct:
      stepCount > 0
        ? Math.round((fallbackSteps / stepCount) * 1000) / 1000
        : 0,
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
    heatingActiveStepPct: heatingDemand.activeStepPct,
    measuredTr003HeatKwh: heatingDemand.tr003.groundTruthKwh,
  };

  applyComfortAggregatesToSummary(summary, replaySteps);
  summary.policySummaries = buildPolicySummaries(summary);

  return {
    steps: replaySteps,
    summary,
    endState: {
      tExtObserved,
      tExtMpc,
      tExtEmulated,
      tExtDemand,
      tRecMpc,
      tRecEmulated,
      warmStartDelta,
      prevAppliedBmsSim,
      prevAppliedMpc,
    },
  };
}

export function buildMpcPipelineResult(input: {
  evalStart: string;
  evalEnd: string;
  steps: readonly MpcTimestep[];
  calibration: MpcCalibrationBundle;
  emulatorValidation: MpcPipelineResult["emulatorValidation"];
  plantValidation: MpcPipelineResult["plantValidation"];
  replay: MpcReplayResult;
  preferencesSnapshot?: MpcPipelineResult["preferencesSnapshot"];
}): MpcPipelineResult {
  return {
    evalStart: input.evalStart,
    evalEnd: input.evalEnd,
    stepCount: input.steps.length,
    calibration: input.calibration,
    emulatorValidation: input.emulatorValidation,
    plantValidation: input.plantValidation,
    replay: input.replay,
    hourlyEnergy: [],
    preferencesSnapshot: input.preferencesSnapshot ?? null,
  };
}
