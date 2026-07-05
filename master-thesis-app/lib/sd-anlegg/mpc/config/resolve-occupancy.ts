import { isNorwegianHolidayEve, isNorwegianPublicHoliday } from "@/lib/calendar/norwegian-public-holidays";
import { osloWeekdayFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";
import { isNormalDriftTrainingStep } from "@/lib/sd-anlegg/mpc/config/constraints/normal-drift-step";
import type { MpcControlVector, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";

export const FAN_ON_THRESHOLD_PCT = 5;
export const COIL_ACTIVE_THRESHOLD_PCT = 8;
export const OCCUPIED_Q_THRESHOLD = 0.5;
export const UNOCCUPIED_Q_THRESHOLD = 0.15;

export type OccupancySource =
  | "measured"
  | "historical"
  | "schedule"
  | "holiday"
  | "holiday_eve";

export type OccupancyResolution = {
  q: number;
  source: OccupancySource;
};

export type BuildingOperatingProfile = {
  timezone: "Europe/Oslo";
  /** 0=søn … 6=lør */
  occupiedWeekdays: readonly number[];
  occupiedHours: { start: number; end: number };
  /** Forvarming før drift (minutter). */
  preheatMinutes?: number;
};

export type OccupancyCalibration = {
  /** "dowLocal:hourLocal" → q ∈ [0,1] */
  historicalQByDowHour: Record<string, number>;
};

export const NAERBYEN_OFFICE_OPERATING_PROFILE: BuildingOperatingProfile = {
  timezone: "Europe/Oslo",
  occupiedWeekdays: [1, 2, 3, 4, 5],
  occupiedHours: { start: 7, end: 18 },
  preheatMinutes: 180,
};

export function occupancyDowHourKey(dowLocal: number, hourLocal: number): string {
  return `${dowLocal}:${hourLocal}`;
}

function hourInOperatingWindow(
  hourLocal: number,
  profile: BuildingOperatingProfile,
): boolean {
  const { start, end } = profile.occupiedHours;
  return hourLocal >= start && hourLocal < end;
}

function scheduleOccupancyQ(
  step: Pick<MpcTimestep, "t" | "hourLocal">,
  profile: BuildingOperatingProfile,
): number {
  const dowLocal = osloWeekdayFromIso(step.t);
  if (!profile.occupiedWeekdays.includes(dowLocal)) return 0;

  if (hourInOperatingWindow(step.hourLocal, profile)) return 1;

  const preheatHours = (profile.preheatMinutes ?? 0) / 60;
  if (
    preheatHours > 0 &&
    step.hourLocal >= profile.occupiedHours.start - preheatHours &&
    step.hourLocal < profile.occupiedHours.start
  ) {
    const progress =
      (step.hourLocal - (profile.occupiedHours.start - preheatHours)) /
      preheatHours;
    return Math.max(0, Math.min(1, progress));
  }

  return 0;
}

export function measuredOccupancyFromControl(
  u: MpcControlVector | null | undefined,
): number | null {
  if (!u) return null;
  const fanAvg = (u.supplyFanPct + u.exhaustFanPct) / 2;
  const districtMax = Math.max(
    u.districtTr002ValvePct,
    u.districtTr003ValvePct,
  );
  const coilMax = Math.max(
    u.heatingValvePct,
    u.coolingValvePct,
    districtMax,
  );
  if (fanAvg <= FAN_ON_THRESHOLD_PCT && coilMax <= COIL_ACTIVE_THRESHOLD_PCT) {
    return 0;
  }
  if (fanAvg > FAN_ON_THRESHOLD_PCT || coilMax > COIL_ACTIVE_THRESHOLD_PCT) {
    const raw = Math.max(fanAvg / 100, coilMax / 100, districtMax / 100);
    // Kun FV-ventil aktiv (typisk grunnlast): ikke klassifiser som helt av — unngår
    // applyOffState som nullstiller TR003 mens målt kost fortsatt har varme.
    if (
      districtMax > COIL_ACTIVE_THRESHOLD_PCT &&
      raw < UNOCCUPIED_Q_THRESHOLD
    ) {
      return Math.min(1, UNOCCUPIED_Q_THRESHOLD + 0.05);
    }
    return Math.max(0, Math.min(1, raw));
  }
  return null;
}

export function resolveOccupancyForStep(
  step: Pick<MpcTimestep, "t" | "hourLocal" | "uMeas">,
  profile: BuildingOperatingProfile,
  calibration?: OccupancyCalibration | null,
  options?: { preferMeasured?: boolean },
): OccupancyResolution {
  if (isNorwegianPublicHoliday(step.t)) {
    return { q: 0, source: "holiday" };
  }

  const measuredQ = measuredOccupancyFromControl(step.uMeas);
  if (options?.preferMeasured !== false && measuredQ != null) {
    return { q: measuredQ, source: "measured" };
  }

  const dowLocal = osloWeekdayFromIso(step.t);
  const histKey = occupancyDowHourKey(dowLocal, step.hourLocal);
  const historicalQ = calibration?.historicalQByDowHour[histKey];
  if (historicalQ != null) {
    return { q: historicalQ, source: "historical" };
  }

  const scheduleQ = scheduleOccupancyQ(step, profile);
  if (isNorwegianHolidayEve(step.t) && scheduleQ > 0) {
    return { q: Math.min(scheduleQ, 0.35), source: "holiday_eve" };
  }

  return { q: scheduleQ, source: "schedule" };
}

export function isOccupiedQ(q: number): boolean {
  return q >= OCCUPIED_Q_THRESHOLD;
}

export function isUnoccupiedQ(q: number): boolean {
  return q < UNOCCUPIED_Q_THRESHOLD;
}

/** Treningsproxy: median vifte+batteri per dowLocal×hourLocal → q. */
export function fitOccupancyCalibrationFromSteps(
  train: readonly MpcTimestep[],
): OccupancyCalibration {
  const normalSteps = train.filter(isNormalDriftTrainingStep);
  const fitSteps = normalSteps.length >= 48 ? normalSteps : train.filter((s) => s.uMeas);

  const buckets = new Map<string, number[]>();
  for (const step of fitSteps) {
    if (!step.uMeas) continue;
    const dowLocal = osloWeekdayFromIso(step.t);
    const key = occupancyDowHourKey(dowLocal, step.hourLocal);
    const q = measuredOccupancyFromControl(step.uMeas);
    if (q == null) continue;
    const arr = buckets.get(key) ?? [];
    arr.push(q);
    buckets.set(key, arr);
  }

  const historicalQByDowHour: Record<string, number> = {};
  for (const [key, values] of buckets) {
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    historicalQByDowHour[key] =
      values.length % 2 === 0
        ? (values[mid - 1]! + values[mid]!) / 2
        : values[mid]!;
  }

  return { historicalQByDowHour };
}

export const DEFAULT_OFF_STATE_SETBACK_C = 16;

export type OccupancyAnchorOptions = {
  /** Forrige utstedte kontrollanker — brukes til SP-ramping ved off-state. */
  previousU?: MpcControlVector | null;
  setbackSetpointC?: number;
  /** Maks |ΔSP| per 15-min (samme rate som MPC actuator-grense). */
  setpointMaxDeltaPerStep?: number;
};

export function rampScalarToward(
  current: number,
  target: number,
  maxDelta: number,
): number {
  if (maxDelta <= 0) return target;
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

export function applyOffStateControl(
  u: MpcControlVector,
  setbackSetpointC = DEFAULT_OFF_STATE_SETBACK_C,
): MpcControlVector {
  return {
    ...u,
    supplySetpointC: Math.min(u.supplySetpointC, setbackSetpointC),
    supplyFanPct: 0,
    exhaustFanPct: 0,
    heatingValvePct: 0,
    coolingValvePct: 0,
  };
}

/** Trekk emulert FV-pådrag mot målt når emulatoren underpredikerer aktiv krets. */
export function alignEmulatedControlWithMeasured(
  uEmul: MpcControlVector,
  uMeas: MpcControlVector | null | undefined,
): MpcControlVector {
  if (!uMeas) return uEmul;

  let aligned = uEmul;

  const measCool = uMeas.coolingValvePct ?? 0;
  const emulCool = aligned.coolingValvePct ?? 0;
  if (measCool > COIL_ACTIVE_THRESHOLD_PCT && emulCool < measCool * 0.5) {
    aligned = { ...aligned, coolingValvePct: measCool };
  }

  const measDistrict = Math.max(
    uMeas.districtTr002ValvePct ?? 0,
    uMeas.districtTr003ValvePct ?? 0,
  );
  const emulDistrict = Math.max(
    aligned.districtTr002ValvePct ?? 0,
    aligned.districtTr003ValvePct ?? 0,
  );
  if (measDistrict <= COIL_ACTIVE_THRESHOLD_PCT) return aligned;
  if (emulDistrict >= measDistrict * 0.5) return aligned;
  return {
    ...aligned,
    districtTr002ValvePct: uMeas.districtTr002ValvePct ?? 0,
    districtTr003ValvePct: uMeas.districtTr003ValvePct ?? 0,
  };
}

export function occupancyContextLabel(
  step: Pick<MpcTimestep, "t">,
  q: number,
): string {
  const dowLocal = osloWeekdayFromIso(step.t);
  const isWeekend = dowLocal === 0 || dowLocal === 6;
  if (isUnoccupiedQ(q)) {
    if (isNorwegianPublicHoliday(step.t)) return "Helligdag · lavt belegg";
    return isWeekend ? "Helg · lavt belegg" : "Utenfor drift · lavt belegg";
  }
  if (isWeekend) return "Helg · drift";
  return "Ukedag · drift";
}

export function buildOccupancyHorizon(
  steps: readonly Pick<MpcTimestep, "t" | "hourLocal" | "uMeas">[],
  profile: BuildingOperatingProfile,
  calibration?: OccupancyCalibration | null,
  options?: { preferMeasured?: boolean },
): number[] {
  return steps.map((step) =>
    resolveOccupancyForStep(step, profile, calibration, options).q,
  );
}

export function applyOccupancyToControlAnchor(
  u: MpcControlVector,
  q: number,
  options?: OccupancyAnchorOptions,
): MpcControlVector {
  if (!isUnoccupiedQ(q)) return u;

  const setback = options?.setbackSetpointC ?? DEFAULT_OFF_STATE_SETBACK_C;
  const maxDelta = options?.setpointMaxDeltaPerStep ?? 1.5;
  const off = applyOffStateControl(u, setback);
  const startSp = options?.previousU?.supplySetpointC ?? u.supplySetpointC;

  return {
    ...off,
    supplySetpointC: rampScalarToward(startSp, off.supplySetpointC, maxDelta),
  };
}

export function applyOccupancyAnchorHorizon(
  anchors: readonly MpcControlVector[],
  occupancyQs: readonly number[],
  options?: OccupancyAnchorOptions,
): MpcControlVector[] {
  const out: MpcControlVector[] = [];
  let prev = options?.previousU ?? null;
  for (let i = 0; i < anchors.length; i++) {
    const applied = applyOccupancyToControlAnchor(anchors[i]!, occupancyQs[i] ?? 1, {
      ...options,
      previousU: prev,
    });
    out.push(applied);
    prev = applied;
  }
  return out;
}

export function alignedWithEstimatedHintForOccupancy(
  step: Pick<MpcTimestep, "t">,
  q: number,
): string {
  if (isUnoccupiedQ(q)) {
    if (isNorwegianPublicHoliday(step.t)) {
      return "Simulert i tråd med forventet helligdagsdrift.";
    }
    const dowLocal = osloWeekdayFromIso(step.t);
    if (dowLocal === 0 || dowLocal === 6) {
      return "Simulert i tråd med forventet helgedrift.";
    }
    return "Simulert i tråd med forventet drift utenfor åpningstid.";
  }
  return "Simulert i tråd med forventet ukedagsdrift.";
}
