import { toNorwegianTime, utcHourBucketStartMs } from "@/lib/utils";
import type { ApiObservation, MappedEnelyzeObservation } from "./types";

export function mapEnelyzeObservation(
  obs: ApiObservation,
): MappedEnelyzeObservation | null {
  const parsed = new Date(obs.time);
  if (Number.isNaN(parsed.getTime())) return null;

  const utcTime = new Date(utcHourBucketStartMs(parsed));
  if (Number.isNaN(utcTime.getTime())) return null;

  return {
    utcTime,
    time: toNorwegianTime(utcTime),
    direction: obs.direction,
    method: obs.method,
    volume_kwh: obs.volume_kwh,
  };
}

export function dedupeMappedObservations(
  rows: MappedEnelyzeObservation[],
): MappedEnelyzeObservation[] {
  const byUtc = new Map<number, MappedEnelyzeObservation>();
  for (const row of rows) {
    const key = row.utcTime.getTime();
    if (!byUtc.has(key)) {
      byUtc.set(key, row);
    }
  }
  return [...byUtc.values()].sort(
    (a, b) => a.utcTime.getTime() - b.utcTime.getTime(),
  );
}
