import { osloWeekdayFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import type { MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import type { ComfortBandC } from "./parse-building-comfort-band";

/** Tidsvarierende komfortband — occupancy-baserte grenser per steg. */
export type ComfortSchedulePeriod = {
  /** Inklusiv start, lokale timer [0, 23]. */
  startHourLocal: number;
  /** Eksklusiv slutt (24 = midnatt neste dag). */
  endHourLocal: number;
  band: ComfortBandC;
  label?: string;
  /** Valgfritt: kun disse ukedagene (0=son … 6=lør, Europe/Oslo). */
  weekdaysLocal?: readonly number[];
  /** Skalerer base λ_comfort (typisk høyere i drift, lavere om natt). */
  lambdaComfortMultiplier?: number;
  /** Skalerer λ_move per horisont-steg (f.eks. søndag-forvarming). */
  lambdaMoveMultiplier?: number;
};

export type ComfortSchedule = {
  timezone: "Europe/Oslo";
  /** Brukes når ingen periode matcher. */
  fallbackBand: ComfortBandC;
  /** Standard λ_comfort-multiplikator utenfor perioder. */
  fallbackLambdaComfortMultiplier?: number;
  periods: readonly ComfortSchedulePeriod[];
};

type ComfortScheduleStep = Pick<MpcTimestep, "hourLocal" | "t">;

function hourInPeriod(
  hourLocal: number,
  period: ComfortSchedulePeriod,
): boolean {
  const h = hourLocal;
  if (period.startHourLocal < period.endHourLocal) {
    return h >= period.startHourLocal && h < period.endHourLocal;
  }
  return h >= period.startHourLocal || h < period.endHourLocal;
}

function resolveMatchingPeriod(
  step: ComfortScheduleStep,
  schedule: ComfortSchedule,
): ComfortSchedulePeriod | null {
  const dowLocal = osloWeekdayFromIso(step.t);
  for (const period of schedule.periods) {
    if (
      period.weekdaysLocal?.length &&
      !period.weekdaysLocal.includes(dowLocal)
    ) {
      continue;
    }
    if (hourInPeriod(step.hourLocal, period)) return period;
  }
  return null;
}

/** Nærbyen (kontor): ukedag-drift, helg/natt avslappet, mandag-oppstart, søndag-forvarming. */
export const NAERBYEN_OFFICE_COMFORT_SCHEDULE: ComfortSchedule = {
  timezone: "Europe/Oslo",
  fallbackBand: { min: 17, max: 26 },
  fallbackLambdaComfortMultiplier: 0.65,
  periods: [
    {
      startHourLocal: 12,
      endHourLocal: 18,
      weekdaysLocal: [0],
      band: { min: 17, max: 26 },
      label: "søndag-forvarming",
      lambdaComfortMultiplier: 2,
      lambdaMoveMultiplier: 0.55,
    },
    {
      startHourLocal: 4,
      endHourLocal: 7,
      weekdaysLocal: [1],
      band: { min: 18, max: 24 },
      label: "mandag-oppstart",
      lambdaComfortMultiplier: 35,
      lambdaMoveMultiplier: 0.7,
    },
    {
      startHourLocal: 7,
      endHourLocal: 18,
      weekdaysLocal: [1, 2, 3, 4, 5],
      band: { min: 18, max: 24 },
      label: "ukedag-drift",
      lambdaComfortMultiplier: 14,
      lambdaMoveMultiplier: 0.85,
    },
    {
      startHourLocal: 7,
      endHourLocal: 24,
      weekdaysLocal: [6],
      band: { min: 17, max: 26 },
      label: "lørdag",
      lambdaComfortMultiplier: 0.65,
      lambdaMoveMultiplier: 0.5,
    },
    {
      startHourLocal: 0,
      endHourLocal: 12,
      weekdaysLocal: [0],
      band: { min: 17, max: 26 },
      label: "søndag-morgen",
      lambdaComfortMultiplier: 0.65,
    },
    {
      startHourLocal: 18,
      endHourLocal: 24,
      band: { min: 17, max: 26 },
      label: "kveld",
      lambdaComfortMultiplier: 0.65,
    },
    {
      startHourLocal: 0,
      endHourLocal: 7,
      band: { min: 17, max: 26 },
      label: "natt",
      lambdaComfortMultiplier: 0.65,
    },
  ],
};

/** @deprecated Bruk NAERBYEN_OFFICE_COMFORT_SCHEDULE — «24/7» er byggnavn, ikke driftstype. */
export const NAERBYEN_24_7_COMFORT_SCHEDULE = NAERBYEN_OFFICE_COMFORT_SCHEDULE;


const UNOCCUPIED_BAND: ComfortBandC = { min: 17, max: 26 };

export function interpolateComfortBand(
  occupied: ComfortBandC,
  unoccupied: ComfortBandC,
  q: number,
): ComfortBandC {
  const t = Math.max(0, Math.min(1, q));
  return {
    min: unoccupied.min + t * (occupied.min - unoccupied.min),
    max: unoccupied.max + t * (occupied.max - unoccupied.max),
  };
}

export function resolveComfortBandForStepWithOccupancy(
  step: ComfortScheduleStep,
  schedule: ComfortSchedule | null | undefined,
  fallback: ComfortBandC,
  q: number,
): ComfortBandC {
  const scheduleBand = resolveComfortBandForStep(step, schedule, fallback);
  return interpolateComfortBand(scheduleBand, UNOCCUPIED_BAND, q);
}

export function resolveComfortLambdaMultiplierForStepWithOccupancy(
  step: ComfortScheduleStep,
  schedule: ComfortSchedule | null | undefined,
  q: number,
): number {
  const base = resolveComfortLambdaMultiplierForStep(step, schedule);
  const nightMultiplier = schedule?.fallbackLambdaComfortMultiplier ?? 0.65;
  const occupiedMultiplier = 14;
  const target = nightMultiplier + q * (occupiedMultiplier - nightMultiplier);
  return base * (target / occupiedMultiplier);
}

export function resolveComfortBandForStep(
  step: ComfortScheduleStep,
  schedule: ComfortSchedule | null | undefined,
  fallback: ComfortBandC,
): ComfortBandC {
  if (!schedule?.periods.length) return fallback;
  const period = resolveMatchingPeriod(step, schedule);
  if (period) return period.band;
  return schedule.fallbackBand ?? fallback;
}

export function resolveComfortLambdaMultiplierForStep(
  step: ComfortScheduleStep,
  schedule: ComfortSchedule | null | undefined,
): number {
  if (!schedule?.periods.length) return 1;
  const period = resolveMatchingPeriod(step, schedule);
  if (period?.lambdaComfortMultiplier != null) {
    return period.lambdaComfortMultiplier;
  }
  return schedule.fallbackLambdaComfortMultiplier ?? 1;
}

export function resolveLambdaMoveMultiplierForStep(
  step: ComfortScheduleStep,
  schedule: ComfortSchedule | null | undefined,
): number {
  if (!schedule?.periods.length) return 1;
  const period = resolveMatchingPeriod(step, schedule);
  return period?.lambdaMoveMultiplier ?? 1;
}

export function buildComfortBandHorizon(
  steps: readonly ComfortScheduleStep[],
  schedule: ComfortSchedule | null | undefined,
  fallback: ComfortBandC,
  occupancyQ?: readonly number[],
): ComfortBandC[] {
  return steps.map((step, i) => {
    const q = occupancyQ?.[i] ?? 1;
    return resolveComfortBandForStepWithOccupancy(step, schedule, fallback, q);
  });
}

export function buildComfortLambdaHorizon(
  steps: readonly ComfortScheduleStep[],
  schedule: ComfortSchedule | null | undefined,
  baseLambdaComfort: number,
  occupancyQ?: readonly number[],
): number[] {
  return steps.map((step, i) => {
    const q = occupancyQ?.[i] ?? 1;
    return (
      baseLambdaComfort *
      resolveComfortLambdaMultiplierForStepWithOccupancy(step, schedule, q)
    );
  });
}

export function buildLambdaMoveHorizon(
  steps: readonly ComfortScheduleStep[],
  schedule: ComfortSchedule | null | undefined,
): number[] {
  return steps.map((step) =>
    resolveLambdaMoveMultiplierForStep(step, schedule),
  );
}
