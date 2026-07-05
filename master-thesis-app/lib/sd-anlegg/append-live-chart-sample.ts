import type { InfraspawnSeriesSample } from "@/lib/infraspawn/series-samples";
import { mergeInfraspawnSeriesSamples } from "@/lib/infraspawn/series-samples";

export type LiveChartSampleInput = {
  lastValue: number | null | undefined;
  lastSampledAt: string | null | undefined;
};

function buildLiveSample(
  input: LiveChartSampleInput,
): InfraspawnSeriesSample | null {
  if (input.lastValue == null || Number.isNaN(input.lastValue)) return null;

  const t = input.lastSampledAt?.trim()
    ? input.lastSampledAt
    : new Date().toISOString();
  if (Number.isNaN(new Date(t).getTime())) return null;

  return { t, value: input.lastValue };
}

/** Legger til / oppdaterer siste punkt i serie fra live poll uten full chart-refetch. */
export function appendLiveSampleToSeriesSamples(
  samples: readonly InfraspawnSeriesSample[],
  live: LiveChartSampleInput,
): InfraspawnSeriesSample[] {
  const liveSample = buildLiveSample(live);
  if (!liveSample) return [...samples];
  if (samples.length === 0) return [liveSample];
  return mergeInfraspawnSeriesSamples(samples, [liveSample]);
}

/** Batch-variant for flere serier identifisert med stabil nøkkel. */
export function appendLiveSamplesToChartSeries<
  T extends { key: string; samples: readonly InfraspawnSeriesSample[] },
>(
  series: readonly T[],
  liveByKey: ReadonlyMap<string, LiveChartSampleInput>,
): T[] {
  return series.map((entry) => {
    const live = liveByKey.get(entry.key);
    if (!live) return entry;
    return {
      ...entry,
      samples: appendLiveSampleToSeriesSamples(entry.samples, live),
    };
  });
}
