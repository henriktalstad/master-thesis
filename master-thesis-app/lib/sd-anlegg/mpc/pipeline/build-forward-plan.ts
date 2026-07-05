import {
  estimateControllableElectricKw,
  estimateControllableHeatKw,
  stepEnergyCostKr,
} from "@/lib/sd-anlegg/mpc/controller/envelope-model/build-power-proxies";
import { emulateBaselineControl } from "@/lib/sd-anlegg/mpc/controller/envelope-model/fit-baseline-emulator";
import {
  assessMpcStepValidity,
  emptyFallbackByReason,
  recordFallbackReason,
} from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import {
  buildMpcSearchAnchorHorizon,
  solveMpcHorizon,
} from "@/lib/sd-anlegg/mpc/controller/optimizer/solve-horizon";
import type {
  MpcCalibrationBundle,
  MpcControlVector,
  MpcTimestep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import {
  mpcChannelEnabledForStep,
  type ResolvedMpcBuildingPreferences,
} from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import {
  buildComfortBandHorizon,
  buildComfortLambdaHorizon,
  buildLambdaMoveHorizon,
} from "@/lib/sd-anlegg/mpc/config/comfort-schedule";
import {
  applyOccupancyAnchorHorizon,
  applyOccupancyToControlAnchor,
  buildOccupancyHorizon,
  isOccupiedQ,
  resolveOccupancyForStep,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import { preferencesToSolverBounds } from "@/lib/sd-anlegg/mpc/config/resolve-preferences";
import {
  buildMpcTimeGrid,
  MPC_STEP_MINUTES,
  mpcStepKeyFromMs,
  parseMpcStepKey,
} from "@/lib/sd-anlegg/mpc/shared/time-grid";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import {
  estimateCoolingActive,
  estimateHeatingActive,
} from "@/lib/sd-anlegg/control/control-sd-calibration";
import type {
  ControlHourlyPrice,
  ControlHourlyWeather,
  MpcForwardPlan,
  MpcForwardPlanStep,
} from "@/lib/sd-anlegg/control/control-types";

function marginalPrice(step: MpcTimestep): number | null {
  return step.effectiveMarginalKrPerKwh ?? step.spotKrPerKwh;
}

export function buildForwardTimesteps(input: {
  calibration: MpcCalibrationBundle;
  weatherForecast: readonly ControlHourlyWeather[];
  priceForecast: readonly ControlHourlyPrice[];
  initialControl: MpcControlVector | null;
  buildingPreferences?: ResolvedMpcBuildingPreferences;
  heatKrPerKwh?: number | null;
  nowMs?: number;
}): MpcTimestep[] {
  const nowMs = input.nowMs ?? Date.now();
  const startMs = nowMs;
  const horizonSteps = input.calibration.solver.horizonSteps;
  const endMs = startMs + horizonSteps * MPC_STEP_MINUTES * 60_000;
  const grid = buildMpcTimeGrid(new Date(startMs), new Date(endMs));

  const weatherByHour = new Map(
    input.weatherForecast.map((w) => [
      controlHourKeyFromIso(w.hour),
      w.outdoorTempC,
    ]),
  );
  const priceByHour = new Map(
    input.priceForecast.map((p) => [
      controlHourKeyFromIso(p.hour),
      {
        spot: p.spotKrPerKwh,
        marginal: p.effectiveMarginalKrPerKwh,
      },
    ]),
  );

  const med = input.calibration.emulator.globalMedians;
  const defaultU: MpcControlVector = {
    supplySetpointC: med.supplySetpointC ?? input.initialControl?.supplySetpointC ?? 18,
    supplyFanPct: med.supplyFanPct ?? input.initialControl?.supplyFanPct ?? 30,
    exhaustFanPct: med.exhaustFanPct ?? input.initialControl?.exhaustFanPct ?? 30,
    heatingValvePct: med.heatingValvePct ?? input.initialControl?.heatingValvePct ?? 0,
    coolingValvePct: med.coolingValvePct ?? input.initialControl?.coolingValvePct ?? 0,
    districtTr002ValvePct:
      med.districtTr002ValvePct ?? input.initialControl?.districtTr002ValvePct ?? 0,
    districtTr003ValvePct:
      med.districtTr003ValvePct ?? input.initialControl?.districtTr003ValvePct ?? 0,
  };
  const referenceU = input.initialControl ?? defaultU;
  const operatingProfile = input.buildingPreferences?.operatingProfile ?? null;
  const occupancyCalibration = input.calibration.occupancy ?? null;
  const setpointRampRate = input.buildingPreferences
    ? preferencesToSolverBounds(input.buildingPreferences).maxDeltaPerStep
        .supplySetpointC
    : 1.5;

  const steps: MpcTimestep[] = [];
  let prevAnchor: MpcControlVector | null = referenceU;
  for (let i = 0; i < grid.length; i++) {
    const t = grid[i]!;
    const parsed = parseMpcStepKey(t);
    const hourKey = controlHourKeyFromIso(t);
    const price = priceByHour.get(hourKey);
    const outdoorTempC = weatherByHour.get(hourKey) ?? null;
    const uMeas = i === 0 ? referenceU : null;

    const stepDraft = {
      t,
      hourLocal: parsed.hourLocal,
      uMeas,
    };
    const occupancyQ =
      operatingProfile != null
        ? resolveOccupancyForStep(
            stepDraft,
            operatingProfile,
            occupancyCalibration,
            { preferMeasured: i === 0 },
          ).q
        : 1;
    const anchorU = applyOccupancyToControlAnchor(referenceU, occupancyQ, {
      previousU: prevAnchor,
      setpointMaxDeltaPerStep: setpointRampRate,
    });
    prevAnchor = anchorU;

    const profileForMode = {
      hour: t,
      supplySetpointC: anchorU.supplySetpointC,
      supplyFanPct: anchorU.supplyFanPct,
      exhaustFanPct: anchorU.exhaustFanPct,
      heatingValvePct: anchorU.heatingValvePct,
      coolingValvePct: anchorU.coolingValvePct,
    };

    steps.push({
      t,
      tMs: new Date(t).getTime(),
      dowUtc: parsed.dowUtc,
      hourUtc: parsed.hourUtc,
      quarterUtc: parsed.quarterUtc,
      hourLocal: parsed.hourLocal,
      uMeas,
      supplySetpointOperatorC: null,
      supplySetpointCalcC: null,
      extractTempC: null,
      outdoorTempC,
      spotKrPerKwh: price?.spot ?? null,
      effectiveMarginalKrPerKwh: price?.marginal ?? price?.spot ?? null,
      heatKrPerKwh: input.heatKrPerKwh ?? null,
      buildingElectricityKwh: 0.5,
      buildingDistrictHeatingKwh: 0.2,
      heatingActive: isOccupiedQ(occupancyQ) && estimateHeatingActive(profileForMode),
      coolingActive:
        isOccupiedQ(occupancyQ) &&
        estimateCoolingActive(profileForMode, outdoorTempC),
    });
  }

  return steps;
}

export function buildMpcForwardPlan(input: {
  calibration: MpcCalibrationBundle;
  weatherForecast: readonly ControlHourlyWeather[];
  priceForecast: readonly ControlHourlyPrice[];
  initialControl: MpcControlVector | null;
  initialExtractTempC: number | null;
  weatherSource: MpcForwardPlan["weatherSource"];
  buildingPreferences?: ResolvedMpcBuildingPreferences;
  heatKrPerKwh?: number | null;
  nowMs?: number;
}): MpcForwardPlan | null {
  if (input.weatherForecast.length === 0) return null;

  const steps = buildForwardTimesteps(input);
  if (steps.length < 4) return null;

  const config = input.calibration.solver;
  const horizon = Math.min(config.horizonSteps, steps.length);
  const operatingProfile = input.buildingPreferences?.operatingProfile ?? null;
  const occupancyCalibration = input.calibration.occupancy ?? null;
  const horizonSlice = steps.slice(0, horizon);
  const occupancyQHorizon =
    operatingProfile != null
      ? buildOccupancyHorizon(horizonSlice, operatingProfile, occupancyCalibration, {
          preferMeasured: false,
        })
      : undefined;

  const uBmsHorizon = applyOccupancyAnchorHorizon(
    buildMpcSearchAnchorHorizon(
      steps,
      0,
      horizon,
      input.calibration,
      undefined,
      input.initialExtractTempC,
    ),
    occupancyQHorizon ?? Array.from({ length: horizon }, () => 1),
    {
      previousU: input.initialControl,
      setpointMaxDeltaPerStep: input.buildingPreferences
        ? preferencesToSolverBounds(input.buildingPreferences).maxDeltaPerStep
            .supplySetpointC
        : 1.5,
    },
  );

  const channelEnabledHorizon = input.buildingPreferences
    ? Array.from({ length: horizon }, (_, i) =>
        mpcChannelEnabledForStep(
          input.buildingPreferences!,
          steps[i]!,
          uBmsHorizon[i] ?? input.initialControl ?? steps[i]?.uMeas ?? null,
          occupancyQHorizon?.[i],
        ),
      )
    : undefined;

  const comfortBandHorizon = input.buildingPreferences?.comfortSchedule
    ? buildComfortBandHorizon(
        horizonSlice,
        input.buildingPreferences.comfortSchedule,
        config.comfortBandC,
        occupancyQHorizon,
      )
    : undefined;

  const comfortLambdaHorizon = input.buildingPreferences?.comfortSchedule
    ? buildComfortLambdaHorizon(
        horizonSlice,
        input.buildingPreferences.comfortSchedule,
        config.lambdaComfort,
        occupancyQHorizon,
      )
    : undefined;

  const lambdaMoveHorizon = input.buildingPreferences?.comfortSchedule
    ? buildLambdaMoveHorizon(
        steps.slice(0, horizon),
        input.buildingPreferences.comfortSchedule,
      )
    : undefined;

  const solution = solveMpcHorizon({
    startIndex: 0,
    steps,
    uBmsSimHorizon: uBmsHorizon,
    tExtInitial: input.initialExtractTempC ?? 20,
    config,
    calibration: input.calibration,
    channelEnabledHorizon,
    comfortBandHorizon,
    comfortLambdaHorizon,
    lambdaMoveHorizon,
  });

  let totalBaseline = 0;
  let totalMpc = 0;
  let totalElKwhBaseline = 0;
  let totalElKwhMpc = 0;
  let totalHeatKwhBaseline = 0;
  let totalHeatKwhMpc = 0;
  let optimizedSteps = 0;
  let fallbackSteps = 0;
  const fallbackByReason = emptyFallbackByReason();
  const planSteps: MpcForwardPlanStep[] = [];
  const powerParams = input.calibration.power;
  const setpointRampRate = input.buildingPreferences
    ? preferencesToSolverBounds(input.buildingPreferences).maxDeltaPerStep
        .supplySetpointC
    : 1.5;
  let prevAppliedMpc: MpcControlVector | null = input.initialControl;

  for (let i = 0; i < horizon; i++) {
    const step = steps[i]!;
    const validity = assessMpcStepValidity(step);
    if (validity.canOptimize) {
      optimizedSteps += 1;
    } else {
      fallbackSteps += 1;
      recordFallbackReason(fallbackByReason, validity.fallbackReason);
    }

    const uBmsSim = uBmsHorizon[i] ?? emulateBaselineControl(
      input.calibration.emulator,
      step,
      { tExtPrev: input.initialExtractTempC },
    );
    const q = occupancyQHorizon?.[i] ?? 1;
    const uMpc = applyOccupancyToControlAnchor(
      solution.uHorizon[i] ?? uBmsSim,
      q,
      {
        previousU: prevAppliedMpc,
        setpointMaxDeltaPerStep: setpointRampRate,
      },
    );
    prevAppliedMpc = uMpc;
    const baselineKw = estimateControllableElectricKw({
      u: uBmsSim,
      buildingElectricityKwh: step.buildingElectricityKwh,
      params: powerParams,
    });
    const mpcKw = estimateControllableElectricKw({
      u: uMpc,
      buildingElectricityKwh: step.buildingElectricityKwh,
      params: powerParams,
    });
    const baselineHeatKw = estimateControllableHeatKw({
      u: uBmsSim,
      outdoorTempC: step.outdoorTempC,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      params: powerParams,
    });
    const mpcHeatKw = estimateControllableHeatKw({
      u: uMpc,
      outdoorTempC: step.outdoorTempC,
      buildingDistrictHeatingKwh: step.buildingDistrictHeatingKwh,
      params: powerParams,
    });

    const costBase = stepEnergyCostKr({
      electricKw: baselineKw,
      heatKw: baselineHeatKw,
      stepMinutes: config.stepMinutes,
      marginalKrPerKwh: marginalPrice(step),
      heatKrPerKwh: step.heatKrPerKwh,
    });
    const costMpc = stepEnergyCostKr({
      electricKw: mpcKw,
      heatKw: mpcHeatKw,
      stepMinutes: config.stepMinutes,
      marginalKrPerKwh: marginalPrice(step),
      heatKrPerKwh: step.heatKrPerKwh,
    });
    totalBaseline += costBase;
    totalMpc += costMpc;
    totalElKwhBaseline += baselineKw * (config.stepMinutes / 60);
    totalElKwhMpc += mpcKw * (config.stepMinutes / 60);
    totalHeatKwhBaseline += baselineHeatKw * (config.stepMinutes / 60);
    totalHeatKwhMpc += mpcHeatKw * (config.stepMinutes / 60);

    planSteps.push({
      t: step.t,
      spotKrPerKwh: step.spotKrPerKwh,
      effectiveMarginalKrPerKwh: step.effectiveMarginalKrPerKwh,
      outdoorTempC: step.outdoorTempC,
      uBmsSim,
      uMpc,
      predictedExtractC: solution.predictedExtractC[i] ?? null,
      expectedDeltaCostKr: Math.round((costMpc - costBase) * 100) / 100,
      usedFallback: !validity.canOptimize,
      fallbackReason: validity.fallbackReason,
    });
  }

  const deltaCostKr = Math.round((totalMpc - totalBaseline) * 100) / 100;
  const deltaCostPct =
    totalBaseline > 0
      ? Math.round((deltaCostKr / totalBaseline) * 1000) / 10
      : 0;

  const dayAheadHourCount = input.priceForecast.filter(
    (p) => p.isDayAheadSpot && p.spotKrPerKwh != null,
  ).length;

  return {
    horizonSteps: planSteps.length,
    stepMinutes: config.stepMinutes,
    planSteps,
    optimizedSteps,
    fallbackSteps,
    fallbackByReason,
    effect: {
      totalCostBaselineKr: Math.round(totalBaseline * 100) / 100,
      totalCostMpcKr: Math.round(totalMpc * 100) / 100,
      deltaCostKr,
      deltaCostPct,
      controllableElectricKwhBaseline: Math.round(totalElKwhBaseline * 10) / 10,
      controllableElectricKwhMpc: Math.round(totalElKwhMpc * 10) / 10,
      controllableHeatKwhBaseline: Math.round(totalHeatKwhBaseline * 10) / 10,
      controllableHeatKwhMpc: Math.round(totalHeatKwhMpc * 10) / 10,
    },
    weatherSource: input.weatherSource,
    dayAheadHourCount,
    computedAt: mpcStepKeyFromMs(input.nowMs ?? Date.now()),
  };
}
