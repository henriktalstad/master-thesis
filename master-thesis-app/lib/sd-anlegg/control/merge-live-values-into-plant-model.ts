import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type {
  ControlPlantModel,
  ControlPlantSubsystem,
  ResolvedControlSignal,
} from "./control-types";
import { resolvePointForCatalogEntry } from "./resolve-control-signals";

function findLivePoint(
  signal: ResolvedControlSignal,
  livePoints: readonly InfraspawnPointListItem[],
): InfraspawnPointListItem | undefined {
  if (signal.point) {
    const matched = livePoints.find(
      (point) =>
        point.sourceId === signal.point!.sourceId &&
        point.objectId === signal.point!.objectId,
    );
    if (matched) return matched;
  }
  return resolvePointForCatalogEntry(livePoints, signal.catalog);
}

function mergeSignalLiveValue(
  signal: ResolvedControlSignal,
  livePoints: readonly InfraspawnPointListItem[],
): ResolvedControlSignal {
  const livePoint = findLivePoint(signal, livePoints);
  if (!livePoint) return signal;

  return {
    ...signal,
    availability:
      signal.availability === "missing" ? "available" : signal.availability,
    point: livePoint,
    lastValue: livePoint.lastValue ?? signal.lastValue,
    lastSampledAt: livePoint.lastSampledAt ?? signal.lastSampledAt,
  };
}

function mergeSubsystemLiveValues(
  subsystem: ControlPlantSubsystem,
  livePoints: readonly InfraspawnPointListItem[],
): ControlPlantSubsystem {
  return {
    ...subsystem,
    controls: subsystem.controls.map((signal) =>
      mergeSignalLiveValue(signal, livePoints),
    ),
    states: subsystem.states.map((signal) =>
      mergeSignalLiveValue(signal, livePoints),
    ),
    constraints: subsystem.constraints.map((signal) =>
      mergeSignalLiveValue(signal, livePoints),
    ),
  };
}

/** Beriker SSR plantModel med live-verdier fra delt points-poll (2s). */
export function mergeLiveValuesIntoPlantModel(
  plantModel: ControlPlantModel,
  livePoints: readonly InfraspawnPointListItem[] | undefined,
): ControlPlantModel {
  if (!livePoints?.length) return plantModel;

  return {
    ...plantModel,
    subsystems: plantModel.subsystems.map((subsystem) =>
      mergeSubsystemLiveValues(subsystem, livePoints),
    ),
  };
}

/** Nyeste lastSampledAt blant tilgjengelige kontrollsignaler. */
export function resolveControlPlantLatestSampleAt(
  plantModel: ControlPlantModel,
): string | null {
  let latest: string | null = null;
  let latestMs = -Infinity;

  for (const subsystem of plantModel.subsystems) {
    for (const signal of [
      ...subsystem.controls,
      ...subsystem.states,
      ...subsystem.constraints,
    ]) {
      if (!signal.lastSampledAt) continue;
      const ms = new Date(signal.lastSampledAt).getTime();
      if (Number.isNaN(ms) || ms <= latestMs) continue;
      latestMs = ms;
      latest = signal.lastSampledAt;
    }
  }

  return latest;
}
