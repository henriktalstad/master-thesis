export type InfraspawnSeriesSample = {
  t: string;
  value: number | null;
};

function sampleTimeMs(t: string): number | null {
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function bucketInfraspawnSeriesSamples(
  samples: readonly InfraspawnSeriesSample[],
  bucketMs: number,
): InfraspawnSeriesSample[] {
  if (bucketMs <= 0 || samples.length === 0) return [...samples];

  const byBucket = new Map<number, InfraspawnSeriesSample>();
  for (const sample of samples) {
    const ms = sampleTimeMs(sample.t);
    if (ms == null) continue;
    const bucketStart = Math.floor(ms / bucketMs) * bucketMs;
    const existing = byBucket.get(bucketStart);
    if (!existing || ms >= (sampleTimeMs(existing.t) ?? 0)) {
      byBucket.set(bucketStart, {
        t: new Date(bucketStart).toISOString(),
        value: sample.value,
      });
    }
  }

  return Array.from(byBucket.entries())
    .sort(([a], [b]) => a - b)
    .map(([, sample]) => sample);
}

export function mergeInfraspawnSeriesSamples(
  ...layers: readonly (readonly InfraspawnSeriesSample[])[]
): InfraspawnSeriesSample[] {
  const byMs = new Map<number, number | null>();

  for (const samples of layers) {
    for (const sample of samples) {
      const ms = sampleTimeMs(sample.t);
      if (ms == null) continue;
      byMs.set(ms, sample.value);
    }
  }

  return Array.from(byMs.entries())
    .sort(([a], [b]) => a - b)
    .map(([ms, value]) => ({ t: new Date(ms).toISOString(), value }));
}
