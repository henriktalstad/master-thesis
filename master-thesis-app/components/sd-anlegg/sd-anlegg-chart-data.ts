import { formatInfraspawnPointLabel } from "@/lib/infraspawn/display-format";
import { formatInfraspawnUnit } from "@/lib/infraspawn/format-unit";
import { formatInfraspawnPointTechnicalRef } from "@/lib/infraspawn/point-display-labels";
import type {
  InfraspawnChartSeriesEntry,
  InfraspawnPointListItem,
} from "@/lib/infraspawn/types";
import {
  resolveSystemairMsvKind,
  type SystemairMsvKind,
} from "@/lib/sd-anlegg/systemair-msv-labels";
import { isPumpCommandChartPoint } from "@/lib/sd-anlegg/format-process-slot-display";
import {
  isAoValveCommandSignal,
  mapValveCommandChartSampleValue,
} from "@/lib/sd-anlegg/valve-command-percent";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";

const OSLO_CHART_DAY_TIME = new Intl.DateTimeFormat("nb-NO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

const OSLO_CHART_HOUR_MINUTE = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

const OSLO_COVERAGE_RANGE = new Intl.DateTimeFormat("nb-NO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

export type SdAnleggChartSeriesScale = "analog" | "binary" | "msv";

export const SD_ANLEGG_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const SD_ANLEGG_MAX_CHART_SERIES = 8;

export type SdAnleggChartSeries = {
  key: string;
  label: string;
  unit: string | null;
  color: string;
  scale: SdAnleggChartSeriesScale;
  msvKind?: SystemairMsvKind;
  samples: readonly { t: string; value: number | null }[];
  objectId?: string;
  objectName?: string | null;
  description?: string | null;
};

const BINARY_SAMPLE_EPSILON = 0.05;

function isBinarySampleValue(value: number): boolean {
  return (
    Math.abs(value) <= BINARY_SAMPLE_EPSILON ||
    Math.abs(value - 1) <= BINARY_SAMPLE_EPSILON
  );
}

export function classifySdAnleggChartSeriesScale(
  point: Pick<InfraspawnPointListItem, "objectName" | "objectId" | "description">,
  samples: readonly { value: number | null }[],
): SdAnleggChartSeriesScale {
  if (resolveSystemairMsvKind(point)) return "msv";
  if (isPumpCommandChartPoint(point)) return "msv";

  const values = samples
    .map((sample) => sample.value)
    .filter((value): value is number => value != null && !Number.isNaN(value));

  if (values.length === 0) return "analog";
  if (values.every(isBinarySampleValue)) return "binary";
  return "analog";
}

function shortChartLabelDisambiguator(point: InfraspawnPointListItem): string {
  const label = formatInfraspawnPointLabel(point);
  const name = point.objectName?.trim();
  if (name && name !== label) return name;
  return point.objectId;
}

export function disambiguateSdAnleggChartLabels(
  points: readonly InfraspawnPointListItem[],
): Map<string, string> {
  const entries = points.map((point) => ({
    key: sdAnleggPointKey(point),
    base: formatInfraspawnPointLabel(point),
    point,
  }));

  const countByLabel = new Map<string, number>();
  for (const entry of entries) {
    countByLabel.set(entry.base, (countByLabel.get(entry.base) ?? 0) + 1);
  }

  const labels = new Map<string, string>();
  for (const entry of entries) {
    if ((countByLabel.get(entry.base) ?? 0) <= 1) {
      labels.set(entry.key, entry.base);
      continue;
    }

    const technicalRef = formatInfraspawnPointTechnicalRef(entry.point);
    const suffix = technicalRef ?? shortChartLabelDisambiguator(entry.point);
    labels.set(entry.key, `${entry.base} · ${suffix}`);
  }

  return labels;
}

export function resolveSdAnleggChartYDomain(
  series: SdAnleggChartSeries[],
  rows: SdAnleggChartRow[],
  scale: SdAnleggChartSeriesScale,
): [number, number] {
  if (scale === "binary") return [-0.05, 1.05];
  if (scale === "msv") {
    const msvAxis = resolveSdAnleggChartMsvAxis(series, rows);
    return msvAxis?.domain ?? [0.5, 4.5];
  }

  const keys = new Set<string>();
  for (const entry of series) {
    if (entry.scale === "analog") keys.add(entry.key);
  }
  if (keys.size === 0) return [0, 1];

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value !== "number" || Number.isNaN(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad = Math.abs(min) >= 10 ? 2 : 0.5;
    return [min - pad, max + pad];
  }

  const span = max - min;
  const padding = Math.max(span * 0.08, span < 5 ? 0.25 : 1);
  return [min - padding, max + padding];
}

export function resolveSdAnleggChartMsvAxis(
  series: SdAnleggChartSeries[],
  rows: SdAnleggChartRow[],
): { ticks: number[]; domain: [number, number] } | null {
  const msvKeys: string[] = [];
  for (const entry of series) {
    if (entry.scale === "msv") msvKeys.push(entry.key);
  }
  if (msvKeys.length === 0) return null;

  const values = new Set<number>();
  for (const row of rows) {
    for (const key of msvKeys) {
      const value = row[key];
      if (typeof value !== "number" || Number.isNaN(value)) continue;
      values.add(Math.round(value));
    }
  }

  const ticks = [...values].toSorted((a, b) => a - b);
  if (ticks.length === 0) {
    return { ticks: [1, 2, 3, 4], domain: [0.5, 4.5] };
  }

  const min = Math.min(...ticks);
  const max = Math.max(...ticks);
  return {
    ticks,
    domain: [min - 0.5, max + 0.5],
  };
}

export function resolveSdAnleggChartAnalogUnitLabel(
  series: SdAnleggChartSeries[],
): string | null {
  const units = new Set<string>();
  for (const entry of series) {
    if (entry.scale !== "analog") continue;
    const unit = formatInfraspawnUnit(entry.unit);
    if (unit) units.add(unit);
  }
  if (units.size !== 1) return null;
  return [...units][0] ?? null;
}

export type SdAnleggChartRow = {
  timestamp: number;
  [seriesKey: string]: number | null;
};

export function buildSdAnleggChartSeries(
  selectedPoints: readonly InfraspawnPointListItem[],
  seriesEntries: readonly InfraspawnChartSeriesEntry[],
): SdAnleggChartSeries[] {
  const byKey = new Map(
    seriesEntries.map((entry) => [sdAnleggPointKey(entry), entry]),
  );
  const labels = disambiguateSdAnleggChartLabels(selectedPoints);

  return selectedPoints.flatMap((point, index) => {
    const key = sdAnleggPointKey(point);
    const entry = byKey.get(key);
    if (!entry) return [];
    const color =
      SD_ANLEGG_CHART_COLORS[index % SD_ANLEGG_CHART_COLORS.length];
    const msvKind = resolveSystemairMsvKind(point);
    const valveCommand = isAoValveCommandSignal(point);
    const samples = valveCommand
      ? entry.samples.map((sample) => ({
          ...sample,
          value:
            sample.value != null
              ? mapValveCommandChartSampleValue(sample.value, point)
              : null,
        }))
      : entry.samples;
    return [
      {
        key,
        label: labels.get(key) ?? formatInfraspawnPointLabel(point),
        unit: valveCommand ? "percent" : (entry.unit ?? point.unit),
        color,
        scale: classifySdAnleggChartSeriesScale(point, entry.samples),
        msvKind: msvKind ?? undefined,
        samples,
        objectId: point.objectId,
        objectName: point.objectName,
        description: point.description,
      },
    ];
  });
}

export function mergeSdAnleggChartRows(series: SdAnleggChartSeries[]): SdAnleggChartRow[] {
  const byTs = new Map<number, SdAnleggChartRow>();

  for (const s of series) {
    for (const sample of s.samples) {
      const ts = new Date(sample.t).getTime();
      if (Number.isNaN(ts)) continue;
      let row = byTs.get(ts);
      if (!row) {
        row = { timestamp: ts };
        byTs.set(ts, row);
      }
      row[s.key] = sample.value;
    }
  }

  return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
}

const MIN_LIVE_WINDOW_MS = 15 * 60_000;
const LIVE_PADDING_MS = 45_000;

export function resolveSdAnleggChartTimeDomain(
  hours: number,
  rows: SdAnleggChartRow[],
): [number, number] {
  const end = Date.now();
  const requestedStart = end - hours * 60 * 60 * 1000;
  const requestedSpan = end - requestedStart;

  if (rows.length === 0) {
    return [requestedStart, end];
  }

  const dataMin = Math.min(...rows.map((row) => row.timestamp));
  const dataMax = Math.max(...rows.map((row) => row.timestamp));
  const dataSpan = Math.max(0, dataMax - dataMin);

  if (dataSpan < requestedSpan * 0.15) {
    const halfSpan = Math.max(
      MIN_LIVE_WINDOW_MS / 2,
      dataSpan / 2 + LIVE_PADDING_MS,
    );
    const center = dataSpan > 0 ? (dataMin + dataMax) / 2 : end;
    return [center - halfSpan, center + halfSpan];
  }

  return [requestedStart, end];
}

export function formatSdAnleggChartAxisTime(
  ts: number,
  spanMs: number,
): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "";

  const oneDay = 24 * 60 * 60 * 1000;
  if (spanMs >= oneDay * 0.9) {
    return OSLO_CHART_DAY_TIME.format(date);
  }

  return OSLO_CHART_HOUR_MINUTE.format(date);
}

export function formatSdAnleggDataCoverage(
  series: SdAnleggChartSeries[],
  windowHours: number,
): string | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const uniqueTimestamps = new Set<string>();

  for (const s of series) {
    for (const sample of s.samples) {
      const ts = new Date(sample.t).getTime();
      if (Number.isNaN(ts)) continue;
      min = Math.min(min, ts);
      max = Math.max(max, ts);
      uniqueTimestamps.add(sample.t);
    }
  }

  const count = uniqueTimestamps.size;
  if (count === 0) return null;

  const fmt = (ts: number) => OSLO_COVERAGE_RANGE.format(new Date(ts));

  const spanMs = max - min;
  const spanMin = Math.max(1, Math.round(spanMs / 60_000));
  const spanLabel =
    spanMin < 60
      ? `${spanMin} min`
      : `${Math.round(spanMin / 60)} t`;

  const windowMs = windowHours * 60 * 60 * 1000;
  if (spanMs >= windowMs * 0.9) {
    return `${count.toLocaleString("nb-NO")} målepunkter i perioden`;
  }

  return `${fmt(min)}–${fmt(max)} · ${count.toLocaleString("nb-NO")} punkter (${spanLabel})`;
}
