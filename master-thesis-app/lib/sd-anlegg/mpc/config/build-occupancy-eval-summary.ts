import { isNorwegianPublicHoliday } from "@/lib/calendar/norwegian-public-holidays";
import { osloWeekdayFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { parseMpcStepKey } from "@/lib/sd-anlegg/mpc/shared/time-grid";
import {
  NAERBYEN_OFFICE_OPERATING_PROFILE,
  type OccupancyCalibration,
  type OccupancySource,
  UNOCCUPIED_Q_THRESHOLD,
  resolveOccupancyForStep,
} from "./resolve-occupancy";

export type OccupancyEvalSummary = {
  stepCount: number;
  unoccupiedStepCount: number;
  unoccupiedStepPct: number;
  weekendStepCount: number;
  holidayStepCount: number;
  measuredOffStepCount: number;
  avgOccupancyQ: number;
  bySource: Partial<Record<OccupancySource, number>>;
  operatingProfile: typeof NAERBYEN_OFFICE_OPERATING_PROFILE;
};

export function buildOccupancyEvalSummary(
  steps: readonly MpcReplayStep[],
  calibration?: OccupancyCalibration | null,
): OccupancyEvalSummary {
  const bySource: Partial<Record<OccupancySource, number>> = {};
  let unoccupiedStepCount = 0;
  let weekendStepCount = 0;
  let holidayStepCount = 0;
  let measuredOffStepCount = 0;
  let qSum = 0;

  for (const step of steps) {
    const { hourLocal } = parseMpcStepKey(step.t);
    const resolved =
      step.occupancyQ != null
        ? {
            q: step.occupancyQ,
            source:
              (step.occupancySource as OccupancySource | undefined) ??
              ("historical" as const),
          }
        : resolveOccupancyForStep(
            {
              t: step.t,
              hourLocal,
              uMeas: step.uBmsMeas,
            },
            NAERBYEN_OFFICE_OPERATING_PROFILE,
            calibration,
          );

    qSum += resolved.q;
    bySource[resolved.source] = (bySource[resolved.source] ?? 0) + 1;
    if (resolved.q < UNOCCUPIED_Q_THRESHOLD) unoccupiedStepCount += 1;
    if (resolved.source === "measured") measuredOffStepCount += 1;
    if (isNorwegianPublicHoliday(step.t)) holidayStepCount += 1;

    const dowLocal = osloWeekdayFromIso(step.t);
    if (dowLocal === 0 || dowLocal === 6) weekendStepCount += 1;
  }

  const stepCount = steps.length;
  return {
    stepCount,
    unoccupiedStepCount,
    unoccupiedStepPct:
      stepCount > 0
        ? Math.round((unoccupiedStepCount / stepCount) * 1000) / 10
        : 0,
    weekendStepCount,
    holidayStepCount,
    measuredOffStepCount,
    avgOccupancyQ:
      stepCount > 0 ? Math.round((qSum / stepCount) * 1000) / 1000 : 0,
    bySource,
    operatingProfile: NAERBYEN_OFFICE_OPERATING_PROFILE,
  };
}
