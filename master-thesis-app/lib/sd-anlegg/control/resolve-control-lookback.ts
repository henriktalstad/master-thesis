import {
  DEFAULT_STYRING_TAB,
  type StyringTabId,
} from "./control-styring-tabs";
import type { StyringAnalysisViewId } from "./control-styring-analysis-views";

export const CONTROL_LOOKBACK_PRESETS = [
  { days: 1 as const, hours: 24, label: "24 t" },
  { days: 7 as const, hours: 168, label: "7 d" },
  { days: 14 as const, hours: 336, label: "14 d" },
  { days: 30 as const, hours: 720, label: "30 d" },
] as const;

export type ControlLookbackDays =
  (typeof CONTROL_LOOKBACK_PRESETS)[number]["days"];

/** Eval-vindu (default) eller siste N dager fra nå. */
export type ControlPeriodMode = "eval" | "live";

/** Brukervalg i UI — 60 min aggregeres automatisk ved lange live-perioder. */
export type StyringSignalGrain = "1" | "5" | "15";

export type ControlDisplayStepMinutes = 1 | 5 | 15 | 60;

export const STYRING_GRAIN_MAX_LOOKBACK_HOURS: Record<
  StyringSignalGrain,
  number
> = {
  "1": 24,
  "5": 168,
  "15": 720,
};

/** Ved 15-min visning og lang periode → timevis cache/on-the-fly. */
export const AUTO_HOUR_AGGREGATE_LOOKBACK_HOURS = 168;

export function parseStyringSignalGrain(
  value: string | undefined,
): StyringSignalGrain {
  if (value === "1") return "1";
  if (value === "5") return "5";
  if (value === "60") return "15";
  return "15";
}

export function effectiveLookbackHoursForGrain(
  lookbackHours: number,
  grain: StyringSignalGrain,
): number {
  return Math.min(lookbackHours, STYRING_GRAIN_MAX_LOOKBACK_HOURS[grain]);
}

/** Maks antall 15-min steg for valgt lookback (opptil 30 d). */
export function resolveControlLoopStepLimit(hours: number): number {
  const steps = Math.ceil(hours / 0.25);
  const maxSteps = 30 * 24 * 4;
  return Math.min(Math.max(steps, 96), maxSteps);
}

export function parseControlPeriodMode(
  daysParam: string | string[] | undefined,
  periodeParam?: string | string[] | undefined,
): ControlPeriodMode {
  const periode = Array.isArray(periodeParam) ? periodeParam[0] : periodeParam;
  if (periode === "live") return "live";
  if (periode === "eval") return "eval";
  const raw = Array.isArray(daysParam) ? daysParam[0] : daysParam;
  return raw ? "live" : "eval";
}

export function resolveControlLookbackHours(
  daysParam: string | string[] | undefined,
): number {
  const raw = Array.isArray(daysParam) ? daysParam[0] : daysParam;
  const days = raw ? Number(raw) : 1;
  const preset = CONTROL_LOOKBACK_PRESETS.find((p) => p.days === days);
  return preset?.hours ?? 24;
}

export function resolveControlLookbackDays(
  hours: number,
): ControlLookbackDays {
  const preset = CONTROL_LOOKBACK_PRESETS.find((p) => p.hours === hours);
  return preset?.days ?? 1;
}

export type ControlStyringHrefOptions = {
  days?: ControlLookbackDays;
  periodMode?: ControlPeriodMode;
  tab?: StyringTabId;
  analysisView?: StyringAnalysisViewId;
  /** SD-visning: 1/5 min fra Influx, 15 min = simuleringsintervall */
  grain?: StyringSignalGrain;
  /** Bevar sensor-modus (?demo=exam) i navigasjon */
  demo?: string;
};

export function controlStyringHrefForExam(
  buildingSlug: string,
  options: ControlStyringHrefOptions,
  examinerMode: boolean,
): string {
  if (!examinerMode) {
    return controlStyringHref(buildingSlug, options);
  }
  return controlStyringHref(buildingSlug, {
    ...options,
    demo: "exam",
    grain: "15",
    analysisView:
      options.tab === "analyse" ? (options.analysisView ?? "oversikt") : options.analysisView,
  });
}

export function controlStyringHref(
  buildingSlug: string,
  daysOrOptions: ControlLookbackDays | ControlStyringHrefOptions = 1,
  legacyTab: StyringTabId = DEFAULT_STYRING_TAB,
): string {
  const options: ControlStyringHrefOptions =
    typeof daysOrOptions === "number"
      ? { days: daysOrOptions, tab: legacyTab }
      : daysOrOptions;

  const periodMode = options.periodMode ?? (options.days ? "live" : "eval");
  const days = options.days ?? 1;
  const tab = options.tab ?? DEFAULT_STYRING_TAB;
  const params = new URLSearchParams();
  if (periodMode === "live") {
    params.set("periode", "live");
    if (days !== 1) params.set("dager", String(days));
  }
  if (tab !== DEFAULT_STYRING_TAB) params.set("vis", tab);
  if (options.grain === "1") params.set("grain", "1");
  if (options.grain === "5") params.set("grain", "5");
  if (options.demo === "exam" && (options.grain ?? "15") === "15") {
    params.set("grain", "15");
  }
  if (options.demo) params.set("demo", options.demo);
  if (tab === "analyse" && options.analysisView && options.analysisView !== "oversikt") {
    params.set("visning", options.analysisView);
  }
  const qs = params.toString();
  const base = `/sd-anlegg/${buildingSlug}/styring`;
  return qs ? `${base}?${qs}` : base;
}

export function mpcComparisonResolutionFromStepMinutes(
  stepMinutes: ControlDisplayStepMinutes,
): "step" | "hour" {
  return stepMinutes >= 60 ? "hour" : "step";
}

/** @deprecated Bruk mpcComparisonResolutionFromStepMinutes med faktisk stepMinutes. */
export function mpcComparisonResolutionFromGrain(
  _grain: StyringSignalGrain,
): "step" | "hour" {
  return "step";
}

/** @deprecated Bruk stepMinutes fra controlSignalSeries. */
export function loopChartStepMinutesFromGrain(
  grain: StyringSignalGrain,
): ControlDisplayStepMinutes {
  if (grain === "1") return 1;
  if (grain === "5") return 5;
  return 15;
}

export function grainLabel(grain: StyringSignalGrain): string {
  if (grain === "1") return "1 min";
  if (grain === "5") return "5 min";
  return "15 min";
}

/** Maks dager per oppløsning (ytelse + Influx-grenser). */
export function maxLookbackDaysForGrain(
  grain: StyringSignalGrain,
): ControlLookbackDays {
  if (grain === "1") return 1;
  if (grain === "5") return 7;
  return 30;
}

export function isLookbackAllowedForGrain(
  days: ControlLookbackDays,
  grain: StyringSignalGrain,
): boolean {
  return days <= maxLookbackDaysForGrain(grain);
}

/** Forklaring når valgt periode begrenses av oppløsning. */
export function effectivePeriodCaption(
  requestedDays: ControlLookbackDays,
  grain: StyringSignalGrain,
): string | null {
  const maxDays = maxLookbackDaysForGrain(grain);
  if (requestedDays <= maxDays) return null;
  const maxPreset = CONTROL_LOOKBACK_PRESETS.find((p) => p.days === maxDays);
  return `Viser ${maxPreset?.label ?? `${maxDays} d`} — maks for ${grainLabel(grain)}`;
}

/** Fin SD (1/5 min) viser halen av valgt vindu — ikke hele eval fra start. */
export function resolveFineGrainSeriesWindow(input: {
  rangeSince?: Date;
  rangeUntil: Date;
  effectiveHours: number;
}): { since: Date; until: Date } {
  const until = input.rangeUntil;
  const tailSince = new Date(
    until.getTime() - input.effectiveHours * 3_600_000,
  );
  const since = input.rangeSince
    ? new Date(Math.max(input.rangeSince.getTime(), tailSince.getTime()))
    : tailSince;
  return { since, until };
}

/** Anbefalt oppløsning for valgt periode (ytelse). */
export function recommendedGrainForLookback(
  days: ControlLookbackDays,
): StyringSignalGrain {
  if (days === 1) return "5";
  if (days <= 7) return "5";
  return "15";
}

/** Automatisk mål-oppløsning — Eval = simuleringskontrakt (15 min). */
export function resolveOptimalStyringGrain(input: {
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
}): StyringSignalGrain {
  if (input.periodMode === "eval") return "15";
  return recommendedGrainForLookback(input.lookbackDays);
}

/** Fin SD-kandidater — kun Live (Eval = full 15-min replay). */
export function resolveFineGrainLoadCandidates(input: {
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
}): Array<1 | 5> {
  if (input.periodMode === "eval") return [];
  if (input.lookbackDays === 1) return [1, 5];
  if (input.lookbackDays <= 7) return [5];
  return [];
}

/** Effektiv grain etter periode — URL-overstyring clampes til det som er mulig. */
export function resolveEffectiveStyringGrain(input: {
  periodMode: ControlPeriodMode;
  lookbackDays: ControlLookbackDays;
  requested?: StyringSignalGrain;
}): StyringSignalGrain {
  const optimal = resolveOptimalStyringGrain(input);
  if (input.periodMode === "eval") return "15";
  const requested = input.requested ?? optimal;
  if (!isLookbackAllowedForGrain(input.lookbackDays, requested)) {
    return optimal;
  }
  return requested;
}

export function styringStepMinutesToGrain(
  stepMinutes: ControlDisplayStepMinutes,
): StyringSignalGrain {
  if (stepMinutes === 1) return "1";
  if (stepMinutes === 5) return "5";
  return "15";
}

export function formatStyringResolutionLabel(
  stepMinutes: ControlDisplayStepMinutes,
  options?: { autoHour?: boolean },
): string {
  if (options?.autoHour || stepMinutes >= 60) return "Timevis snitt";
  if (stepMinutes === 1) return "1 min · SD";
  if (stepMinutes === 5) return "5 min · SD";
  return "15 min · simulering";
}
