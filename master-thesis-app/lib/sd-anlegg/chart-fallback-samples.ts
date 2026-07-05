import type { InfraspawnAlarmPointGroup } from "@/lib/infraspawn/group-alarm-events";
import type { InfraspawnSeriesSample } from "@/lib/infraspawn/series-samples";

export type SdAnleggChartFallbackSource = "alarm-cycles" | "live-snapshot";

export function sdAnleggChartFallbackFootnote(
  source: SdAnleggChartFallbackSource | null | undefined,
): string | null {
  if (source === "alarm-cycles") {
    return "Viser alarmverdier — kontinuerlig målehistorikk mangler i perioden.";
  }
  if (source === "live-snapshot") {
    return "Viser siste måleverdi — historikk mangler i perioden.";
  }
  return null;
}

export function buildSdAnleggChartLiveFallbackSamples(input: {
  lastValue?: number | null;
  lastSampledAt?: string | null;
}): { samples: InfraspawnSeriesSample[]; source: SdAnleggChartFallbackSource | null } {
  const byTime = new Map<number, InfraspawnSeriesSample>();

  const push = (t: string, value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return;
    const ms = new Date(t).getTime();
    if (Number.isNaN(ms)) return;
    byTime.set(ms, { t: new Date(ms).toISOString(), value });
  };

  if (input.lastSampledAt && input.lastValue != null) {
    push(input.lastSampledAt, input.lastValue);
  } else if (input.lastValue != null) {
    push(new Date().toISOString(), input.lastValue);
  }

  const samples = [...byTime.values()].sort(
    (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime(),
  );

  if (samples.length === 0) {
    return { samples: [], source: null };
  }

  return { samples, source: "live-snapshot" };
}

export function buildSdAnleggChartFallbackSamples(input: {
  group: Pick<InfraspawnAlarmPointGroup, "historyRows" | "currentValue">;
  lastValue?: number | null;
  lastSampledAt?: string | null;
}): { samples: InfraspawnSeriesSample[]; source: SdAnleggChartFallbackSource | null } {
  const byTime = new Map<number, InfraspawnSeriesSample>();

  const push = (t: string, value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return;
    const ms = new Date(t).getTime();
    if (Number.isNaN(ms)) return;
    byTime.set(ms, { t: new Date(ms).toISOString(), value });
  };

  for (const row of input.group.historyRows) {
    if (row.type !== "cycle") continue;
    push(row.event.activatedAt, row.event.valueAtActivation);
  }

  if (input.lastSampledAt && input.lastValue != null) {
    push(input.lastSampledAt, input.lastValue);
  } else if (input.group.currentValue != null) {
    push(new Date().toISOString(), input.group.currentValue);
  }

  const samples = [...byTime.values()].sort(
    (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime(),
  );

  if (samples.length === 0) {
    return { samples: [], source: null };
  }

  const fromAlarm = input.group.historyRows.some(
    (row) => row.type === "cycle" && row.event.valueAtActivation != null,
  );

  return {
    samples,
    source: fromAlarm ? "alarm-cycles" : "live-snapshot",
  };
}
