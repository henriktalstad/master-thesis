/** Rullerende plattform-periode (Oslo, t.o.m. i går). Drift bruker kalenderår — ikke denne typen. */
export type PeriodOption = "year" | "month" | "7days";

/** Alle perioder i rekkefølge 7d → måned → år (for prefetch, enqueue, lister). */
export const ALL_PERIOD_OPTIONS: PeriodOption[] = ["7days", "month", "year"];

/** URL-verdi → PeriodOption (for ?periode= i /oversikt og /eos) */
export const PERIODE_TO_OPTION: Record<string, PeriodOption> = {
  aar: "year",
  maaned: "month",
  uke: "7days",
};

/** PeriodOption → URL-verdi */
export const OPTION_TO_PERIODE: Record<PeriodOption, string> = {
  year: "aar",
  month: "maaned",
  "7days": "uke",
};

/** Runtime-guard for PeriodOption (context, URL-sync, klient-hydrering). */
export function normalizePeriodOption(value: string | undefined): PeriodOption {
  return value === "month" || value === "year" || value === "7days"
    ? value
    : "7days";
}

/**
 * Antall kalenderdager i perioden (lengde).
 * 7days: 7, month: 30, year: 365.
 * For beregning av «dager tilbake fra slutt» bruk PERIOD_DAYS[x] - 1.
 */
export const PERIOD_DAYS: Record<PeriodOption, number> = {
  "7days": 7,
  month: 30,
  year: 365,
};

/** Kalenderdager per periode (samme som PERIOD_DAYS). Brukes for daysDuration, expectedDays. */
export const DAYS_IN_PERIOD: Record<PeriodOption, number> = {
  "7days": 7,
  month: 30,
  year: 365,
};

/** Brukervennlige periodelabler – konsistent i header, oversikt og EOS. */
export const PERIOD_LABELS: Record<PeriodOption, string> = {
  "7days": "Siste uke",
  month: "Siste måned",
  year: "Siste året",
};

/** Korte periodelabler (header sm–md, tooltips/aria bruker fortsatt `PERIOD_LABELS`). */
export const PERIOD_LABELS_SHORT: Record<PeriodOption, string> = {
  "7days": "Uke",
  month: "Måned",
  year: "År",
};

/** Minste periodelabler (header under `sm` – minst plassbruk). */
export const PERIOD_LABELS_MICRO: Record<PeriodOption, string> = {
  "7days": "7d",
  month: "Mnd",
  year: "År",
};

/** Labels når perioden er tilpasset til tilgjengelig data (observation bounds). */
export const PERIOD_LABELS_ADJUSTED: Record<PeriodOption, string> = {
  "7days": "Siste tilgjengelige uke",
  month: "Siste tilgjengelige måned",
  year: "Siste tilgjengelige året",
};

/**
 * Returnerer periodelabel tilpasset om data viser tilpasset periode (siste tilgjengelige data).
 * Brukes på EOS/oversikt når periodAdjusted er satt.
 */
export function getPeriodLabel(
  periodOption: PeriodOption,
  periodAdjusted?: unknown,
): string {
  return isPeriodAdjustedShape(periodAdjusted)
    ? (PERIOD_LABELS_ADJUSTED[periodOption] ?? PERIOD_LABELS[periodOption])
    : PERIOD_LABELS[periodOption];
}

/** Datoformat for chart-akser (Intl/date-fns). */
export const PERIOD_LABEL_FORMAT: Record<PeriodOption, string> = {
  "7days": "eee",
  month: "d. MMM",
  year: "MMM",
};

/** ISO-datoer når periode er clampet til observation bounds (EOS, DashboardCache, overview). */
export type PeriodAdjustedShape = { start: string; end: string };

/** Type guard for periodAdjusted fra Prisma JSON / API-respons. */
export function isPeriodAdjustedShape(
  value: unknown,
): value is PeriodAdjustedShape {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.start === "string" && typeof obj.end === "string";
}

/**
 * Coverage-threshold for trend-beregning per periode.
 * Brukes av både sync-dashboard og materialize-trends for konsistens.
 * 7days: 0.6, month: 0.7, year: 0.8
 */
export const TREND_COVERAGE_THRESHOLD: Record<PeriodOption, number> = {
  "7days": 0.6,
  month: 0.7,
  year: 0.8,
};

/** Henter trend coverage-threshold for en periode (konsistent med sync-dashboard). */
export function getTrendCoverageThreshold(period: PeriodOption): number {
  return TREND_COVERAGE_THRESHOLD[period] ?? 0.8;
}
