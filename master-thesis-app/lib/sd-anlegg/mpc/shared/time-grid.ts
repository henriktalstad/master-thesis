import { osloHourFromIso } from "@/lib/sd-anlegg/control/control-time-buckets";

export const MPC_STEP_MINUTES = 15;
const MPC_STEP_MS = MPC_STEP_MINUTES * 60_000;

function floorToMpcStepMs(ms: number): number {
  return Math.floor(ms / MPC_STEP_MS) * MPC_STEP_MS;
}

export function mpcStepKeyFromMs(ms: number): string {
  const d = new Date(floorToMpcStepMs(ms));
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function mpcTemplateKey(dowUtc: number, hourUtc: number, quarterUtc: number): string {
  return `${dowUtc}:${hourUtc}:${quarterUtc}`;
}

export function mpcHourlyTemplateKey(hourUtc: number, quarterUtc: number): string {
  return `${hourUtc}:${quarterUtc}`;
}

export function parseMpcStepKey(t: string): {
  dowUtc: number;
  hourUtc: number;
  quarterUtc: number;
  hourLocal: number;
} {
  const d = new Date(t);
  const hourUtc = d.getUTCHours();
  const minute = d.getUTCMinutes();
  return {
    dowUtc: d.getUTCDay(),
    hourUtc,
    quarterUtc: Math.floor(minute / MPC_STEP_MINUTES),
    hourLocal: osloHourFromIso(t),
  };
}

export function buildMpcTimeGrid(start: Date, end: Date): string[] {
  const startMs = floorToMpcStepMs(start.getTime());
  const endMs = floorToMpcStepMs(end.getTime());
  const keys: string[] = [];
  for (let ms = startMs; ms < endMs; ms += MPC_STEP_MS) {
    keys.push(mpcStepKeyFromMs(ms));
  }
  return keys;
}

export function stepKeyFromMs(ms: number, stepMinutes: number): string {
  const stepMs = stepMinutes * 60_000;
  const d = new Date(Math.floor(ms / stepMs) * stepMs);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function bucketSamplesByStepMinutes(
  samples: readonly { t: string; value: number | null }[],
  stepMinutes: 1 | 5 | 15 | 60,
): Map<string, number> {
  const buckets = new Map<string, { sum: number; count: number }>();

  for (const sample of samples) {
    if (sample.value == null || Number.isNaN(sample.value)) continue;
    const key = stepKeyFromMs(new Date(sample.t).getTime(), stepMinutes);
    const agg = buckets.get(key) ?? { sum: 0, count: 0 };
    agg.sum += sample.value;
    agg.count += 1;
    buckets.set(key, agg);
  }

  return new Map(
    [...buckets.entries()].map(([key, agg]) => [
      key,
      Math.round((agg.sum / agg.count) * 100) / 100,
    ]),
  );
}

export function bucketSamplesByMpcStep(
  samples: readonly { t: string; value: number | null }[],
): Map<string, number> {
  return bucketSamplesByStepMinutes(samples, MPC_STEP_MINUTES);
}

export function splitTrainHoldout<T>(
  rows: readonly T[],
  trainRatio = 0.7,
): { train: T[]; holdout: T[] } {
  const split = Math.max(1, Math.floor(rows.length * trainRatio));
  return {
    train: rows.slice(0, split),
    holdout: rows.slice(split),
  };
}
