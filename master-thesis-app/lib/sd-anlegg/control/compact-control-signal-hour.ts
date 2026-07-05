import type { MpcControlVector, MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { MPC_CONTROL_KEYS } from "@/lib/sd-anlegg/mpc/shared/types";
import { controlHourKeyFromIso } from "./control-time-buckets";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

function avgVector(
  vectors: Array<MpcControlVector | null | undefined>,
): MpcControlVector | null {
  const finite = vectors.filter((v): v is MpcControlVector => v != null);
  if (finite.length === 0) return null;
  const out = {} as MpcControlVector;
  for (const key of MPC_CONTROL_KEYS) {
    const values = finite.map((v) => v[key]).filter(Number.isFinite);
    out[key] = avg(values) ?? 0;
  }
  return out;
}

/** Kompakt time-bucket — gjennomsnitt av 15-min kontrollvektorer. */
export type CompactControlSignalHourPayload = {
  o: number[] | null;
  s: number[];
  m: number[];
  d?: number[];
  n: number;
};

function vectorToArray(v: MpcControlVector | null | undefined): number[] | null {
  if (!v) return null;
  return MPC_CONTROL_KEYS.map((key) => v[key]);
}

function arrayToVector(arr: number[]): MpcControlVector {
  return {
    supplySetpointC: arr[0] ?? 0,
    supplyFanPct: arr[1] ?? 0,
    exhaustFanPct: arr[2] ?? 0,
    heatingValvePct: arr[3] ?? 0,
    coolingValvePct: arr[4] ?? 0,
    districtTr002ValvePct: arr[5] ?? 0,
    districtTr003ValvePct: arr[6] ?? 0,
  };
}

export function compactControlSignalHour(input: {
  observed: MpcControlVector | null;
  emulated: MpcControlVector;
  mpc: MpcControlVector;
  demand: MpcControlVector | null;
  stepCount: number;
}): CompactControlSignalHourPayload {
  return {
    o: vectorToArray(input.observed),
    s: vectorToArray(input.emulated)!,
    m: vectorToArray(input.mpc)!,
    ...(input.demand ? { d: vectorToArray(input.demand)! } : {}),
    n: input.stepCount,
  };
}

export function expandControlSignalHourToReplayStep(
  hourAt: string,
  payload: CompactControlSignalHourPayload,
): MpcReplayStep {
  const emulated = arrayToVector(payload.s);
  const mpc = arrayToVector(payload.m);
  const observed = payload.o ? arrayToVector(payload.o) : null;
  const demand = payload.d ? arrayToVector(payload.d) : null;
  return {
    t: hourAt,
    uBmsMeas: observed ?? undefined,
    uBmsSim: emulated,
    uMpc: mpc,
    uDemand: demand ?? undefined,
    costBaselineKr: 0,
    costEmulatedKr: 0,
    costMpcKr: 0,
  } as MpcReplayStep;
}

export type AggregatedControlSignalHour = {
  hourAt: string;
  payload: CompactControlSignalHourPayload;
};

/** Aggreger 15-min replay-steg til time-buckets (UTC time key). */
export function aggregateReplayStepsToControlHours(
  steps: readonly MpcReplayStep[],
): AggregatedControlSignalHour[] {
  const buckets = new Map<string, MpcReplayStep[]>();
  for (const step of steps) {
    const key = controlHourKeyFromIso(step.t);
    const list = buckets.get(key) ?? [];
    list.push(step);
    buckets.set(key, list);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hourKey, bucket]) => {
      const hourAt = `${hourKey}:00:00.000Z`;
      const payload = compactControlSignalHour({
        observed: avgVector(bucket.map((s) => s.uBmsMeas ?? null)),
        emulated: avgVector(bucket.map((s) => s.uBmsSim)) ?? bucket[0]!.uBmsSim,
        mpc: avgVector(bucket.map((s) => s.uMpc)) ?? bucket[0]!.uMpc,
        demand: avgVector(bucket.map((s) => s.uDemand ?? null)),
        stepCount: bucket.length,
      });
      return { hourAt, payload };
    });
}
