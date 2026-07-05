import type {
  MpcControlVector,
  MpcTimestep,
} from "@/lib/sd-anlegg/mpc/shared/types";
import type { ComfortSchedule } from "@/lib/sd-anlegg/mpc/config/comfort-schedule";
import {
  isOccupiedQ,
  isUnoccupiedQ,
  type BuildingOperatingProfile,
  type OccupancyCalibration,
} from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";

/** MPC-pådrag + lokale BMS-settpunkter (dokumentert, ikke alle i u-vektor). */
export type MpcPreferenceChannelId =
  | keyof MpcControlVector
  | "extractSetpointC"
  | "supplySetpointCalcC";

export type MpcPreferenceCondition =
  | "always"
  | "when_fan_on"
  | "when_heating_active"
  | "when_cooling_active"
  | "when_occupied"
  /** q ≥ 0.15 — drift, forvarming og delvis belegg (Mirakhorli/Oldewurtel demand proxy). */
  | "when_demand";

export type MpcPreferenceChannelRole =
  | "mpc_actuator"
  | "local_bms"
  | "comfort_proxy";

export type MpcPreferenceChannelLimits = {
  min: number;
  max: number;
  maxDeltaPerStep: number;
};

export type MpcPreferenceChannelDef = {
  id: MpcPreferenceChannelId;
  canonicalId: string;
  label: string;
  unit: "°C" | "%";
  role: MpcPreferenceChannelRole;
  /** Om MPC kan foreslå δu på denne kanalen (local_bms = false). */
  mpcOptimizable: boolean;
  condition: MpcPreferenceCondition;
  limits: MpcPreferenceChannelLimits;
};

export type MpcBuildingPreferencesOverrides = {
  comfortBandMinC?: number;
  comfortBandMaxC?: number;
  tuningPresetId?: string;
  stateBlendAlpha?: number;
  channels?: Partial<
    Record<
      MpcPreferenceChannelId,
      {
        enabledForMpc?: boolean;
        condition?: MpcPreferenceCondition;
        limits?: Partial<MpcPreferenceChannelLimits>;
      }
    >
  >;
};

export type ResolvedMpcPreferenceChannel = MpcPreferenceChannelDef & {
  enabledForMpc: boolean;
  /** Sist observert / typisk fra anlegg (live SD eller replay-median). */
  observedValue: number | null;
  effectiveLimits: MpcPreferenceChannelLimits;
};

export type ResolvedMpcBuildingPreferences = {
  buildingSlug: string;
  unitKey: string;
  comfortBandC: { min: number; max: number };
  /** Tidsvarierende komfortband per steg (occupancy-basert). null = statisk comfortBandC. */
  comfortSchedule: ComfortSchedule | null;
  tuningPresetId: string;
  stateBlendAlpha: number;
  channels: ResolvedMpcPreferenceChannel[];
  /** Per MPC-control-key: om optimizer kan endre δu. */
  mpcChannelEnabled: Record<keyof MpcControlVector, boolean>;
  operatingProfile: BuildingOperatingProfile | null;
};

/** JSON-serialisert preferanse-snapshot for pipeline-run (reproduksjon). */
export type MpcPreferencesSnapshot = {
  buildingSlug: string;
  unitKey: string;
  tuningPresetId: string;
  stateBlendAlpha: number;
  comfortBandC: { min: number; max: number };
  comfortSchedule: ComfortSchedule | null;
  operatingProfile: BuildingOperatingProfile | null;
  occupancyCalibration?: OccupancyCalibration | null;
  mpcChannelEnabled: Record<keyof MpcControlVector, boolean>;
  channels: Array<{
    id: MpcPreferenceChannelId;
    canonicalId: string;
    enabledForMpc: boolean;
    condition: MpcPreferenceCondition;
    effectiveLimits: MpcPreferenceChannelLimits;
  }>;
};

const FAN_ON_THRESHOLD_PCT = 5;

export function evaluatePreferenceCondition(
  condition: MpcPreferenceCondition,
  step: Pick<MpcTimestep, "uMeas" | "heatingActive" | "coolingActive">,
  referenceU?: MpcControlVector | null,
  occupancyQ?: number | null,
): boolean {
  const q = occupancyQ ?? 1;
  switch (condition) {
    case "always":
      return true;
    case "when_occupied":
      return isOccupiedQ(q);
    case "when_demand":
      return !isUnoccupiedQ(q);
    case "when_fan_on": {
      if (isUnoccupiedQ(q)) return false;
      const u = step.uMeas ?? referenceU;
      if (!u) return false;
      return (
        u.supplyFanPct > FAN_ON_THRESHOLD_PCT ||
        u.exhaustFanPct > FAN_ON_THRESHOLD_PCT
      );
    }
    case "when_heating_active":
      if (isUnoccupiedQ(q)) return false;
      return step.heatingActive || heatingActiveFromReference(referenceU);
    case "when_cooling_active":
      if (isUnoccupiedQ(q)) return false;
      return step.coolingActive || coolingActiveFromReference(referenceU);
    default:
      return true;
  }
}

function heatingActiveFromReference(
  u: MpcControlVector | null | undefined,
): boolean {
  return (u?.heatingValvePct ?? 0) > 8;
}

function coolingActiveFromReference(
  u: MpcControlVector | null | undefined,
): boolean {
  return (u?.coolingValvePct ?? 0) > 8;
}

export function mpcChannelEnabledForStep(
  prefs: ResolvedMpcBuildingPreferences,
  step: Pick<MpcTimestep, "uMeas" | "heatingActive" | "coolingActive">,
  referenceU?: MpcControlVector | null,
  occupancyQ?: number | null,
): Record<keyof MpcControlVector, boolean> {
  const out = { ...prefs.mpcChannelEnabled };
  for (const ch of prefs.channels) {
    if (
      !ch.mpcOptimizable ||
      ch.id === "extractSetpointC" ||
      ch.id === "supplySetpointCalcC"
    )
      continue;
    const key = ch.id as keyof MpcControlVector;
    if (!ch.enabledForMpc) {
      out[key] = false;
      continue;
    }
    if (
      !evaluatePreferenceCondition(ch.condition, step, referenceU, occupancyQ)
    ) {
      out[key] = false;
    }
  }
  return out;
}

export function buildChannelEnabledHorizon(
  prefs: ResolvedMpcBuildingPreferences,
  steps: readonly MpcTimestep[],
  startIndex: number,
  horizonSteps: number,
  referenceU?: MpcControlVector | null,
  occupancyQHorizon?: readonly number[],
): Array<Record<keyof MpcControlVector, boolean>> {
  const count = Math.min(horizonSteps, steps.length - startIndex);
  return Array.from({ length: count }, (_, idx) =>
    mpcChannelEnabledForStep(
      prefs,
      steps[startIndex + idx]!,
      referenceU,
      occupancyQHorizon?.[idx],
    ),
  );
}

export function zeroDisabledDeltaComponents(
  delta: MpcControlVector,
  enabled: Record<keyof MpcControlVector, boolean>,
): MpcControlVector {
  return {
    supplySetpointC: enabled.supplySetpointC ? delta.supplySetpointC : 0,
    supplyFanPct: enabled.supplyFanPct ? delta.supplyFanPct : 0,
    exhaustFanPct: enabled.exhaustFanPct ? delta.exhaustFanPct : 0,
    heatingValvePct: enabled.heatingValvePct ? delta.heatingValvePct : 0,
    coolingValvePct: enabled.coolingValvePct ? delta.coolingValvePct : 0,
    districtTr002ValvePct: enabled.districtTr002ValvePct
      ? delta.districtTr002ValvePct
      : 0,
    districtTr003ValvePct: enabled.districtTr003ValvePct
      ? delta.districtTr003ValvePct
      : 0,
  };
}

export const MPC_PREFERENCE_CONDITION_LABELS: Record<
  MpcPreferenceCondition,
  string
> = {
  always: "Alltid",
  when_fan_on: "Når vifte > 5 % og q ≥ 15 %",
  when_heating_active: "Når varme aktiv og q ≥ 15 %",
  when_cooling_active: "Når kjøling aktiv og q ≥ 15 %",
  when_occupied: "Når belegg ≥ 50 %",
  when_demand: "Når q ≥ 15 % (drift/forvarming)",
};

export const MPC_PREFERENCE_ROLE_LABELS: Record<
  MpcPreferenceChannelRole,
  string
> = {
  mpc_actuator: "Foreslått pådrag MPC",
  local_bms: "Målt pådrag SD",
  comfort_proxy: "Komfortproxy",
};
