import { normalizeControlPercent } from "@/lib/sd-anlegg/control/normalize-control-percent";
import { resolveTrustedCoolingValvePct } from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";
import type { MpcControlVector } from "@/lib/sd-anlegg/mpc/shared/types";

function pctActuator(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const { pct, suspectMisMap } = normalizeControlPercent(value);
  return suspectMisMap ? null : pct;
}

export type ControlSampleValues = {
  supplySetpointC?: number;
  supplySetpointCalcC?: number;
  supplyFanPct?: number;
  exhaustFanPct?: number;
  heatingValvePct?: number;
  coolingValveCommandPct?: number;
  coolingValveFeedbackPct?: number;
  districtTr002ValvePct?: number;
  districtTr003ValvePct?: number;
  outdoorTempC?: number | null;
};
export const U_MEAS_SAMPLE_FIELD_BY_CANONICAL: Partial<
  Record<string, keyof ControlSampleValues>
> = {
  "supply.setpoint": "supplySetpointC",
  "supply.setpoint_calculated": "supplySetpointCalcC",
  "supply.fan.command": "supplyFanPct",
  "exhaust.fan.command": "exhaustFanPct",
  "heating.valve.command": "heatingValvePct",
};

export function buildObservedControlVector(
  values: ControlSampleValues,
): MpcControlVector | null {
  const supplySetpointC =
    values.supplySetpointCalcC ?? values.supplySetpointC;
  const { supplyFanPct, exhaustFanPct, heatingValvePct } = values;
  if (
    supplySetpointC == null ||
    supplyFanPct == null ||
    exhaustFanPct == null ||
    heatingValvePct == null
  ) {
    return null;
  }

  const coolingCommand = values.coolingValveCommandPct;
  const coolingFeedback = values.coolingValveFeedbackPct;
  const cooling = resolveTrustedCoolingValvePct({
    commandPct: coolingCommand ?? coolingFeedback ?? 0,
    feedbackPct: coolingFeedback,
    outdoorTempC: values.outdoorTempC,
  });

  const supplyFan = pctActuator(supplyFanPct);
  const exhaustFan = pctActuator(exhaustFanPct);
  const heatingValve = pctActuator(heatingValvePct);
  if (supplyFan == null || exhaustFan == null || heatingValve == null) {
    return null;
  }

  return {
    supplySetpointC,
    supplyFanPct: supplyFan,
    exhaustFanPct: exhaustFan,
    heatingValvePct: heatingValve,
    coolingValvePct: cooling.trustedPct,
    districtTr002ValvePct: pctActuator(values.districtTr002ValvePct) ?? 0,
    districtTr003ValvePct: pctActuator(values.districtTr003ValvePct) ?? 0,
  };
}
