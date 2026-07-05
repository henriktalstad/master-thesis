import type { ControlPlantModel } from "@/lib/sd-anlegg/control/control-types";
import {
  DEFAULT_MPC_BOUNDS,
  resolveMpcSolverConfig,
} from "@/lib/sd-anlegg/mpc/config/mpc-config";
import {
  applyTuningPreset,
  presetById,
  type MpcTuningPresetId,
} from "@/lib/sd-anlegg/mpc/config/mpc-tuning-presets";
import { resolveStateBlendAlpha } from "@/lib/sd-anlegg/mpc/controller/state-estimator/extract-blend";
import type { MpcControlVector, MpcControlBounds, MpcReplayStep, MpcSolverConfig, MpcTimestep } from "@/lib/sd-anlegg/mpc/shared/types";
import {
  preferenceTemplateForBuilding,
  NAERBYEN_360102_PREFERENCE_CHANNELS,
} from "./buildings/naerbyen-360102-preferences";
import type {
  MpcBuildingPreferencesOverrides,
  MpcPreferenceChannelId,
  MpcPreferencesSnapshot,
  ResolvedMpcBuildingPreferences,
  ResolvedMpcPreferenceChannel,
} from "@/lib/sd-anlegg/mpc/config/mpc-building-preferences";
import { resolveComfortBandC } from "@/lib/sd-anlegg/mpc/config/parse-building-comfort-band";
import type { OccupancyCalibration } from "./resolve-occupancy";

type PreferenceReplayStep = {
  extractSetpointC?: number | null;
  supplySetpointCalcC?: number | null;
  uMeas?: MpcTimestep["uMeas"];
  uBmsMeas?: MpcReplayStep["uBmsMeas"];
};

function controlFromPreferenceStep(
  step: PreferenceReplayStep,
): MpcControlVector | null {
  return step.uBmsMeas ?? step.uMeas ?? null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function observedFromPlant(
  plantModel: ControlPlantModel | null | undefined,
  canonicalId: string,
): number | null {
  if (!plantModel) return null;
  for (const sub of plantModel.subsystems) {
    for (const signal of [
      ...sub.controls,
      ...sub.states,
      ...sub.constraints,
    ]) {
      if (signal.catalog.canonicalId === canonicalId && signal.lastValue != null) {
        return signal.lastValue;
      }
    }
  }
  return null;
}

function observedFromReplay(
  replaySteps: readonly PreferenceReplayStep[] | undefined,
  channelId: MpcPreferenceChannelId,
): number | null {
  if (!replaySteps?.length) return null;
  const values: number[] = [];
  for (const step of replaySteps) {
    if (channelId === "extractSetpointC") {
      if (step.extractSetpointC != null) values.push(step.extractSetpointC);
      continue;
    }
    if (channelId === "supplySetpointCalcC") {
      if (step.supplySetpointCalcC != null) values.push(step.supplySetpointCalcC);
      continue;
    }
    const u = controlFromPreferenceStep(step);
    if (!u) continue;
    const v = u[channelId as keyof MpcControlVector];
    if (v != null && Number.isFinite(v)) values.push(v);
  }
  return median(values);
}

function resolveObservedValue(
  channelId: MpcPreferenceChannelId,
  canonicalId: string,
  plantModel: ControlPlantModel | null | undefined,
  replaySteps: readonly PreferenceReplayStep[] | undefined,
): number | null {
  return (
    observedFromPlant(plantModel, canonicalId) ??
    observedFromReplay(replaySteps, channelId)
  );
}

function mergeLimits(
  base: MpcControlBounds,
  channelId: MpcPreferenceChannelId,
  overrides?: Partial<{ min: number; max: number; maxDeltaPerStep: number }>,
): { min: number; max: number; maxDeltaPerStep: number } {
  const key = channelId as keyof MpcControlVector;
  if (channelId === "extractSetpointC") {
    return {
      min: overrides?.min ?? 16,
      max: overrides?.max ?? 28,
      maxDeltaPerStep: 0,
    };
  }
  if (channelId === "supplySetpointCalcC") {
    return {
      min: overrides?.min ?? 14,
      max: overrides?.max ?? 26,
      maxDeltaPerStep: 0,
    };
  }
  return {
    min: overrides?.min ?? base.min[key],
    max: overrides?.max ?? base.max[key],
    maxDeltaPerStep: overrides?.maxDeltaPerStep ?? base.maxDeltaPerStep[key],
  };
}

export function resolveMpcBuildingPreferences(input: {
  buildingSlug: string;
  plantModel?: ControlPlantModel | null;
  replaySteps?: readonly PreferenceReplayStep[];
  overrides?: MpcBuildingPreferencesOverrides | null;
  /** `Building.comfortTargets` fra Prisma — brukes når UI/file-overrides mangler. */
  comfortTargets?: unknown | null;
}): ResolvedMpcBuildingPreferences | null {
  const template = preferenceTemplateForBuilding(input.buildingSlug);
  if (!template) return null;

  const baseSolver = resolveMpcSolverConfig();
  const bounds = baseSolver.bounds;
  const ov = input.overrides ?? {};

  const comfortBandC = resolveComfortBandC({
    base: baseSolver.comfortBandC,
    comfortTargets: input.comfortTargets,
    overrides: ov,
  });

  const channels: ResolvedMpcPreferenceChannel[] = template.channels.map(
    (def) => {
      const chOv = ov.channels?.[def.id];
      const enabledForMpc =
        def.mpcOptimizable && (chOv?.enabledForMpc ?? true);
      return {
        ...def,
        condition: chOv?.condition ?? def.condition,
        enabledForMpc,
        observedValue: resolveObservedValue(
          def.id,
          def.canonicalId,
          input.plantModel,
          input.replaySteps,
        ),
        effectiveLimits: mergeLimits(bounds, def.id, {
          ...def.limits,
          ...chOv?.limits,
        }),
      };
    },
  );

  const mpcChannelEnabled: Record<keyof MpcControlVector, boolean> = {
    supplySetpointC: true,
    supplyFanPct: true,
    exhaustFanPct: true,
    heatingValvePct: true,
    coolingValvePct: true,
    districtTr002ValvePct: true,
    districtTr003ValvePct: true,
  };

  for (const ch of channels) {
    if (ch.id === "extractSetpointC" || ch.id === "supplySetpointCalcC") continue;
    const key = ch.id as keyof MpcControlVector;
    mpcChannelEnabled[key] = ch.enabledForMpc;
  }

  return {
    buildingSlug: input.buildingSlug,
    unitKey: template.unitKey,
    comfortBandC,
    comfortSchedule: template.comfortSchedule ?? null,
    operatingProfile: template.operatingProfile ?? null,
    tuningPresetId: ov.tuningPresetId ?? "anlegg_pris_respons_v1",
    stateBlendAlpha: ov.stateBlendAlpha ?? resolveStateBlendAlpha(),
    channels,
    mpcChannelEnabled,
  };
}

/** Fallback når bygg ikke har mal — bruk Nærbyen-kanaler som generisk AHU. */
export function resolveGenericMpcBuildingPreferences(
  input: Omit<Parameters<typeof resolveMpcBuildingPreferences>[0], "buildingSlug"> & {
    buildingSlug: string;
  },
): ResolvedMpcBuildingPreferences {
  const resolved = resolveMpcBuildingPreferences(input);
  if (resolved) return resolved;

  return resolveMpcBuildingPreferences({
    ...input,
    buildingSlug: "naerbyen-24-7",
  })!;
}

export function preferencesToSolverBounds(
  prefs: ResolvedMpcBuildingPreferences,
): MpcControlBounds {
  const base = DEFAULT_MPC_BOUNDS;
  const min = { ...base.min };
  const max = { ...base.max };
  const maxDeltaPerStep = { ...base.maxDeltaPerStep };

  for (const ch of prefs.channels) {
    if (ch.id === "extractSetpointC" || ch.id === "supplySetpointCalcC") continue;
    const key = ch.id as keyof MpcControlVector;
    min[key] = ch.effectiveLimits.min;
    max[key] = ch.effectiveLimits.max;
    maxDeltaPerStep[key] = ch.effectiveLimits.maxDeltaPerStep;
  }

  return { min, max, maxDeltaPerStep };
}

export function solverConfigFromPreferences(
  prefs: ResolvedMpcBuildingPreferences,
  base?: MpcSolverConfig,
): MpcSolverConfig {
  const baseSolver = base ?? resolveMpcSolverConfig();
  const preset = presetById(prefs.tuningPresetId as MpcTuningPresetId);
  return applyTuningPreset(
    {
      ...baseSolver,
      bounds: preferencesToSolverBounds(prefs),
      comfortBandC: prefs.comfortBandC,
    },
    preset,
  );
}

export function serializeMpcPreferencesSnapshot(
  prefs: ResolvedMpcBuildingPreferences,
  extras?: {
    occupancyCalibration?: OccupancyCalibration | null;
  },
): MpcPreferencesSnapshot {
  return {
    buildingSlug: prefs.buildingSlug,
    unitKey: prefs.unitKey,
    tuningPresetId: prefs.tuningPresetId,
    stateBlendAlpha: prefs.stateBlendAlpha,
    comfortBandC: prefs.comfortBandC,
    comfortSchedule: prefs.comfortSchedule,
    operatingProfile: prefs.operatingProfile,
    occupancyCalibration: extras?.occupancyCalibration ?? null,
    mpcChannelEnabled: prefs.mpcChannelEnabled,
    channels: prefs.channels.map((ch) => ({
      id: ch.id,
      canonicalId: ch.canonicalId,
      enabledForMpc: ch.enabledForMpc,
      condition: ch.condition,
      effectiveLimits: ch.effectiveLimits,
    })),
  };
}

export { NAERBYEN_360102_PREFERENCE_CHANNELS };
