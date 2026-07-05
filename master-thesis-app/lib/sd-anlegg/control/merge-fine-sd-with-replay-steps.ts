import { buildObservedControlVector } from "@/services/mpc/build-u-meas";
import type { ControlSdHourlyProfile } from "./control-sd-calibration";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { stepKeyFromMs } from "@/lib/sd-anlegg/mpc/shared/time-grid";

const SD_NUMERIC_FIELDS = [
  "supplySetpointC",
  "supplySetpointCalcC",
  "extractSetpointC",
  "supplyFanPct",
  "exhaustFanPct",
  "heatingValvePct",
  "coolingValvePct",
  "extractTempC",
  "supplyTempC",
] as const satisfies readonly (keyof ControlSdHourlyProfile)[];

function avgOptional(values: Array<number | undefined>): number | undefined {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length === 0) return undefined;
  return Math.round((finite.reduce((a, b) => a + b, 0) / finite.length) * 10) / 10;
}

/** Aggreger fin SD (f.eks. 5 min) til 15/60-min bucket for graf-merge. */
export function aggregateSdProfilesToBuckets(
  profiles: readonly ControlSdHourlyProfile[],
  bucketMinutes: 15 | 60,
): ControlSdHourlyProfile[] {
  const groups = new Map<string, ControlSdHourlyProfile[]>();
  for (const profile of profiles) {
    const key = stepKeyFromMs(new Date(profile.hour).getTime(), bucketMinutes);
    const list = groups.get(key) ?? [];
    list.push(profile);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, bucketProfiles]) => {
      const merged: ControlSdHourlyProfile = { hour };
      for (const field of SD_NUMERIC_FIELDS) {
        const value = avgOptional(bucketProfiles.map((p) => p[field]));
        if (value != null) merged[field] = value;
      }
      return merged;
    });
}

export function applySdProfileToReplayStep(
  base: MpcReplayStep,
  profile: ControlSdHourlyProfile | undefined,
  t: string,
): MpcReplayStep {
  if (!profile) {
    return { ...base, t };
  }

  const uMeas = buildObservedControlVector({
    supplySetpointC: profile.supplySetpointC,
    supplySetpointCalcC: profile.supplySetpointCalcC,
    supplyFanPct: profile.supplyFanPct,
    exhaustFanPct: profile.exhaustFanPct,
    heatingValvePct: profile.heatingValvePct,
    coolingValveFeedbackPct: profile.coolingValvePct,
    outdoorTempC: base.outdoorTempC,
  });

  const setpointC =
    profile.supplySetpointCalcC ?? profile.supplySetpointC ?? undefined;
  const uBmsMeas =
    uMeas ??
    (setpointC != null && base.uBmsMeas
      ? { ...base.uBmsMeas, supplySetpointC: setpointC }
      : base.uBmsMeas);

  return {
    ...base,
    t,
    uBmsMeas,
    supplySetpointOperatorC:
      profile.supplySetpointC ?? base.supplySetpointOperatorC,
    supplySetpointCalcC: profile.supplySetpointCalcC ?? base.supplySetpointCalcC,
    extractTempMeasC: profile.extractTempC ?? base.extractTempMeasC,
    supplyTempMeasC: profile.supplyTempC ?? base.supplyTempMeasC,
    coolingValveCommandPct:
      profile.coolingValvePct ?? base.coolingValveCommandPct,
    coolingValveFeedbackPct:
      profile.coolingValvePct ?? base.coolingValveFeedbackPct,
  };
}

/** Fin SD-observasjon på tidsrutenett; simulert MPC holdes per 15 min. */
export function mergeFineSdProfilesWithReplaySteps(input: {
  replaySteps: readonly MpcReplayStep[];
  sdProfiles: readonly ControlSdHourlyProfile[];
  stepMinutes: 1 | 5;
}): MpcReplayStep[] {
  if (input.replaySteps.length === 0) return [];
  if (input.sdProfiles.length === 0) return [...input.replaySteps];

  const sdByStep = new Map(input.sdProfiles.map((p) => [p.hour, p]));
  const replaySorted = input.replaySteps;
  const replayStartMs = new Date(replaySorted[0].t).getTime();
  const replayEndMs = new Date(
    replaySorted[replaySorted.length - 1].t,
  ).getTime();

  const stepKeys = new Set<string>();
  for (const profile of input.sdProfiles) {
    const ms = new Date(profile.hour).getTime();
    if (ms >= replayStartMs && ms <= replayEndMs + 15 * 60_000) {
      stepKeys.add(stepKeyFromMs(ms, input.stepMinutes));
    }
  }

  if (stepKeys.size === 0) return [...input.replaySteps];

  const sortedKeys = [...stepKeys].sort();
  let replayIdx = 0;

  return sortedKeys.map((t) => {
    const tMs = new Date(t).getTime();
    while (
      replayIdx + 1 < replaySorted.length &&
      new Date(replaySorted[replayIdx + 1].t).getTime() <= tMs
    ) {
      replayIdx += 1;
    }
    const base = replaySorted[replayIdx];
    const profile = sdByStep.get(t);
    return applySdProfileToReplayStep(base, profile, t);
  });
}

/** Oppdater observert fra SD på eksisterende steg; utvid hale med SD-only timer. */
export function patchSdObservedOntoReplaySteps(input: {
  replaySteps: readonly MpcReplayStep[];
  sdProfiles: readonly ControlSdHourlyProfile[];
  bucketMinutes: 15 | 60;
  extendTail?: boolean;
}): MpcReplayStep[] {
  if (input.replaySteps.length === 0) return [];
  if (input.sdProfiles.length === 0) return [...input.replaySteps];

  const sdByBucket = new Map(
    aggregateSdProfilesToBuckets(input.sdProfiles, input.bucketMinutes).map(
      (profile) => [
        stepKeyFromMs(new Date(profile.hour).getTime(), input.bucketMinutes),
        profile,
      ],
    ),
  );

  const patched = input.replaySteps.map((step) => {
    const key = stepKeyFromMs(new Date(step.t).getTime(), input.bucketMinutes);
    const profile = sdByBucket.get(key);
    if (!profile) return step;
    return applySdProfileToReplayStep(step, profile, step.t);
  });

  if (!input.extendTail) return patched;

  const lastReplayMs = new Date(patched[patched.length - 1]!.t).getTime();
  const tailBase = patched[patched.length - 1]!;
  const tailKeys = [...sdByBucket.keys()]
    .filter((key) => new Date(key).getTime() > lastReplayMs)
    .sort();

  if (tailKeys.length === 0) return patched;

  return [
    ...patched,
    ...tailKeys.map((key) =>
      applySdProfileToReplayStep(tailBase, sdByBucket.get(key), key),
    ),
  ];
}
