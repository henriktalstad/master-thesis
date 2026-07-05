import {
  estimateCoolingActive,
  estimateHeatingActive,
} from "@/lib/sd-anlegg/control/control-sd-calibration";
import { controlHourKeyFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import { assessMpcStepValidity } from "@/lib/sd-anlegg/mpc/config/constraints/mpc-step-validity";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  buildObservedControlVector,
  U_MEAS_SAMPLE_FIELD_BY_CANONICAL,
} from "./build-u-meas";
import { readCoolingValveSampleValues } from "./cooling-valve-samples";
import type { MpcControlCanonical } from "./mpc-canonicals";
import { MPC_U_MEAS_CANONICALS } from "./mpc-canonicals";

export function buildMpcTimestepFromFilledSamples(input: {
  grid: readonly string[];
  filledByObjectId: Map<string, Map<string, number>>;
  objectIdByCanonical: Map<MpcControlCanonical, string>;
  weatherByHour: Map<string, number | null>;
  alarmActiveSteps: Set<string>;
  /** AO_4 — brukes ved mettet kjøle-pådrag (analyze-eval-coverage). */
  coolingFeedbackObjectId?: string | null;
}): MpcTimestep[] {
  const steps: MpcTimestep[] = [];

  for (const t of input.grid) {
    const hourKey = controlHourKeyFromIso(t);
    const outdoorTempC = input.weatherByHour.get(hourKey) ?? null;
    const sampleValues: Parameters<typeof buildObservedControlVector>[0] = {};

    for (const canonicalId of MPC_U_MEAS_CANONICALS) {
      const objectId = input.objectIdByCanonical.get(canonicalId);
      const field =
        U_MEAS_SAMPLE_FIELD_BY_CANONICAL[canonicalId as MpcControlCanonical];
      if (!objectId || !field) continue;
      const value = input.filledByObjectId.get(objectId)?.get(t);
      if (value != null) {
        sampleValues[field] = value;
      }
    }

    if (
      sampleValues.supplySetpointCalcC == null &&
      sampleValues.supplySetpointC == null
    ) {
      const operatorObjectId = input.objectIdByCanonical.get("supply.setpoint");
      if (operatorObjectId) {
        const value = input.filledByObjectId.get(operatorObjectId)?.get(t);
        if (value != null) sampleValues.supplySetpointC = value;
      }
    }

    const coolingCommandObjectId =
      input.objectIdByCanonical.get("cooling.valve.command") ?? null;
    Object.assign(
      sampleValues,
      readCoolingValveSampleValues({
        t,
        sampleMaps: input.filledByObjectId,
        commandObjectId: coolingCommandObjectId,
        feedbackObjectId: input.coolingFeedbackObjectId ?? null,
        outdoorTempC,
      }),
    );

    const uMeas = buildObservedControlVector(sampleValues);
    const profileForMode = {
      hour: t,
      supplySetpointC: uMeas?.supplySetpointC,
      supplyFanPct: uMeas?.supplyFanPct,
      exhaustFanPct: uMeas?.exhaustFanPct,
      heatingValvePct: uMeas?.heatingValvePct,
      coolingValvePct: uMeas?.coolingValvePct,
    };

    steps.push({
      t,
      tMs: new Date(t).getTime(),
      dowUtc: new Date(t).getUTCDay(),
      hourUtc: new Date(t).getUTCHours(),
      quarterUtc: Math.floor(new Date(t).getUTCMinutes() / 15),
      hourLocal: new Date(t).getUTCHours(),
      uMeas,
      supplySetpointOperatorC: null,
      supplySetpointCalcC: null,
      extractTempC: null,
      outdoorTempC,
      spotKrPerKwh: null,
      effectiveMarginalKrPerKwh: null,
      heatKrPerKwh: null,
      buildingElectricityKwh: 0,
      buildingDistrictHeatingKwh: 0,
      heatingActive: estimateHeatingActive(profileForMode),
      coolingActive: estimateCoolingActive(profileForMode, outdoorTempC),
      alarmActive: input.alarmActiveSteps.has(t),
      coolingValveCommandPct: sampleValues.coolingValveCommandPct ?? null,
      coolingValveFeedbackPct: sampleValues.coolingValveFeedbackPct ?? null,
    });
  }

  return steps;
}

export function countMpcStepCoverageMetrics(steps: readonly MpcTimestep[]): {
  stepsWithUMeas: number;
  optimizableSteps: number;
  uMeasPct: number;
  optimizablePct: number;
} {
  const stepCount = steps.length;
  const stepsWithUMeas = steps.filter((step) => step.uMeas != null).length;
  const optimizableSteps = steps.filter(
    (step) => assessMpcStepValidity(step).canOptimize,
  ).length;
  return {
    stepsWithUMeas,
    optimizableSteps,
    uMeasPct: stepCount > 0 ? stepsWithUMeas / stepCount : 0,
    optimizablePct: stepCount > 0 ? optimizableSteps / stepCount : 0,
  };
}
