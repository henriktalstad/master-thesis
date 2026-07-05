export function formatKrShort(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString("nb-NO", { maximumFractionDigits: 1 })}k`;
  }
  return value.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

const OSLO_CONTROL_HOUR = new Intl.DateTimeFormat("nb-NO", {
  weekday: "short",
  hour: "2-digit",
  timeZone: "Europe/Oslo",
});

const OSLO_CONTROL_DATETIME = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

const OSLO_CONTROL_DATE = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Oslo",
});

const OSLO_CONTROL_SAMPLE_TIME = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

/** UTC ISO → klokkeslett (time:min) for live-striper og metadata. */
export function formatControlSampleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return OSLO_CONTROL_SAMPLE_TIME.format(d);
}

/** UTC ISO → norsk klokkeslett for grafer/tabeller (lagring forblir UTC). */
export function formatControlHourLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return OSLO_CONTROL_HOUR.format(d);
}

/** UTC ISO → klokkeslett med minutter (15-min steg). */
export function formatControlStepLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return OSLO_CONTROL_DATETIME.format(d);
}

/** Velger label ut fra oppløsning og tidsrom (inkluder dato ved >36 t spenn). */
export function formatControlTimeLabel(
  iso: string,
  stepMinutes: 1 | 5 | 15 | 60,
  spanMs?: number,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  if (spanMs != null && spanMs > 36 * 3_600_000) {
    return OSLO_CONTROL_DATETIME.format(d);
  }
  if (spanMs != null || stepMinutes >= 60) {
    return formatControlHourLabel(iso);
  }
  return formatControlStepLabel(iso);
}

/** Bryter linjer ved hull > maxGapMs (unngå connectNulls over dager). */
export function breakControlSeriesAtGaps<
  T extends {
    hour: string;
    observed?: number | null;
    emulated?: number | null;
    demand?: number | null;
    mpc?: number | null;
    reference?: number | null;
  },
>(points: readonly T[], maxGapMs = 75 * 60_000): T[] {
  return breakSeriesAtTimeGaps(
    points,
    (p) => p.hour,
    ["observed", "emulated", "demand", "mpc", "reference"],
    maxGapMs,
  );
}

/** Nuller valgte felt ved tidshull — gjelder alle tids-serier (time eller 15-min). */
export function breakSeriesAtTimeGaps<T>(
  points: readonly T[],
  getTime: (point: T) => string,
  nullFields: readonly (keyof T)[],
  maxGapMs = 75 * 60_000,
): T[] {
  if (points.length <= 1) return [...points];
  const out: T[] = [];
  let prevMs: number | null = null;
  for (const point of points) {
    const ms = new Date(getTime(point)).getTime();
    if (prevMs != null && Number.isFinite(ms) && ms - prevMs > maxGapMs) {
      const broken = { ...point };
      for (const key of nullFields) {
        (broken as Record<string, unknown>)[key as string] = null;
      }
      out.push(broken);
    } else {
      out.push(point);
    }
    if (Number.isFinite(ms)) prevMs = ms;
  }
  return out;
}

export function controlSeriesTimeSpanMs(
  points: readonly { hour: string }[],
): number {
  if (points.length < 2) return 0;
  const first = new Date(points[0]!.hour).getTime();
  const last = new Date(points[points.length - 1]!.hour).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
  return Math.max(0, last - first);
}

/** UTC ISO → dato + klokkeslett i Europe/Oslo. */
export function formatControlDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return OSLO_CONTROL_DATETIME.format(d);
}

/** UTC ISO → kalenderdato (YYYY-MM-DD) i Europe/Oslo — for eval-banner. */
export function formatControlOsloDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return OSLO_CONTROL_DATE.format(d);
}

/** Eval-vindu med en-dash — brukes konsekvent i status, hero og lenker. */
export function formatEvalWindow(
  evalPeriod:
    | { evalStart: string; evalEnd: string; periodEnd?: string | null }
    | null
    | undefined,
): string | null {
  if (!evalPeriod) return null;
  const from = formatControlOsloDate(evalPeriod.evalStart);
  const to = formatControlOsloDate(evalPeriod.evalEnd);
  return from === to ? from : `${from} – ${to}`;
}

export const CONTROL_CHART_HEIGHT = "h-[min(240px,40vh)] w-full";

/** Y-akse for %-pådrag — unngå zoom på støy (0–0,01 %) når alt er nær null. */
export function controlPercentYDomain(
  values: readonly (number | null | undefined)[],
): [number, number] {
  const finite = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (finite.length === 0) return [0, 100];
  const max = Math.max(...finite, 0);
  if (max <= 1) return [0, 5];
  return [0, Math.min(100, Math.ceil(Math.max(max * 1.15, 10)))];
}

/** Y-akse for temperatur — liten padding rundt data. */
export function controlTemperatureYDomain(
  values: readonly (number | null | undefined)[],
): [number, number] | undefined {
  const finite = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (finite.length === 0) return undefined;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const pad = Math.max(0.5, (max - min) * 0.08);
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
}

/** Visningsverdi for pådrag/temperatur i UI (konsistent oppløsning). */
export function formatControlSignalValue(
  value: number | null | undefined,
  unit: "°C" | "%" | "kr" | string,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const decimals = unit === "°C" ? 1 : unit === "%" ? 1 : unit === "kr" ? 2 : 1;
  const formatted = value.toLocaleString("nb-NO", {
    minimumFractionDigits: unit === "%" || unit === "°C" ? 1 : 0,
    maximumFractionDigits: decimals,
  });
  if (unit === "°C") return `${formatted} °C`;
  if (unit === "%") return `${formatted} %`;
  if (unit === "kr") return `${formatted} kr`;
  return `${formatted} ${unit}`;
}

/** Formater sammenligningsverdi uten enhetssuffix (tabellceller med egen kolonne-enhet). */
export function formatControlComparisonScalar(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (unit === "kr") {
    return value.toLocaleString("nb-NO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (unit === "%" || unit === "°C") {
    return value.toLocaleString("nb-NO", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }
  return value.toLocaleString("nb-NO", { maximumFractionDigits: 1 });
}

/** Undertittel for replay-dekning i signal-panel. */
export function formatMpcComparisonCoverage(
  comparison: {
    stepCount: number;
    stepMinutes: 1 | 5 | 15 | 60;
    series: ReadonlyArray<{ summary: { sampleHours: number } }>;
  },
  replayStepCount?: number,
): string {
  const total = replayStepCount ?? comparison.stepCount;
  if (comparison.stepMinutes < 60) {
    const partial =
      total > comparison.stepCount
        ? ` · viser siste ${comparison.stepCount} av ${total} steg`
        : "";
    return `${comparison.stepCount} steg à ${comparison.stepMinutes} min${partial}`;
  }
  const hourCount = comparison.series[0]?.summary.sampleHours ?? 0;
  return `${hourCount} timer aggregert · ${total} replay-steg à 15 min`;
}
