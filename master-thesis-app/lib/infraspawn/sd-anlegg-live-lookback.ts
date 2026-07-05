import { resolveInfluxMaxLookbackHours } from "@/lib/infraspawn/bucket-aggregate";
import {
  SD_ANLEGG_INFLUX_TAIL_MAX_HOURS,
  SD_ANLEGG_INFLUX_TAIL_MIN_MINUTES,
  SD_ANLEGG_MIRROR_BUCKET_MS,
} from "@/lib/infraspawn/sd-anlegg-chart-policy";

type MirrorSlice = {
  samples: readonly { t: string }[];
};

export function resolveSdAnleggLiveChartLookbackMinutes(input: {
  mirrorByObject: ReadonlyMap<string, MirrorSlice>;
  objectIds: readonly string[];
  bucketMs?: number;
  maxHours?: number;
  minMinutes?: number;
}): number {
  const bucketMs = input.bucketMs ?? SD_ANLEGG_MIRROR_BUCKET_MS;
  const maxHours = input.maxHours ?? SD_ANLEGG_INFLUX_TAIL_MAX_HOURS;
  const minMinutes = input.minMinutes ?? SD_ANLEGG_INFLUX_TAIL_MIN_MINUTES;

  let latestMirrorMs = 0;
  for (const objectId of input.objectIds) {
    for (const sample of input.mirrorByObject.get(objectId)?.samples ?? []) {
      const ms = new Date(sample.t).getTime();
      if (!Number.isNaN(ms)) latestMirrorMs = Math.max(latestMirrorMs, ms);
    }
  }

  const maxMs = maxHours * 3_600_000;
  const minMs = minMinutes * 60_000;
  const gapMs =
    latestMirrorMs > 0 ? Math.max(0, Date.now() - latestMirrorMs) : maxMs;

  return Math.ceil(
    Math.min(maxMs, Math.max(minMs, gapMs + bucketMs * 2)) / 60_000,
  );
}

export function resolveSdAnleggChartInfluxLookbackMinutes(input: {
  mirrorByObject: ReadonlyMap<string, MirrorSlice>;
  objectIds: readonly string[];
  hours: number;
  sinceMs: number;
}): number {
  const maxMinutes = resolveInfluxMaxLookbackHours() * 60;
  const hasSamplesInWindow = input.objectIds.some((objectId) =>
    (input.mirrorByObject.get(objectId)?.samples ?? []).some((sample) => {
      const ms = new Date(sample.t).getTime();
      return !Number.isNaN(ms) && ms >= input.sinceMs;
    }),
  );

  if (!hasSamplesInWindow) {
    return Math.min(Math.max(input.hours, 1) * 60, maxMinutes);
  }

  return resolveSdAnleggLiveChartLookbackMinutes({
    mirrorByObject: input.mirrorByObject,
    objectIds: input.objectIds,
  });
}

export function resolveSdAnleggLiveChartMaxRows(
  objectCount: number,
  lookbackMinutes: number,
): number {
  if (objectCount <= 0) return 0;
  return objectCount * (lookbackMinutes + 5);
}
