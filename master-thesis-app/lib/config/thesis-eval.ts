export type ThesisEvalWindow = {
  start: Date | null;
  end: Date | null;
};

export function parseThesisEnvDate(value: string | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** THESIS_EVAL_END som YYYY-MM-DD = hele dagen inkl. (eksklusiv grid-slutt neste midnatt). */
export function parseThesisEnvEndDate(value: string | undefined): Date | null {
  const dayStart = parseThesisEnvDate(value);
  if (!dayStart) return null;
  const end = new Date(dayStart);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

export function getThesisEvalWindow(): ThesisEvalWindow {
  return {
    start: parseThesisEnvDate(process.env.THESIS_EVAL_START),
    end: parseThesisEnvEndDate(process.env.THESIS_EVAL_END),
  };
}

/** YYYY-MM-DD for thesis/PDF period label (THESIS_EVAL_END inclusive calendar day). */
export function getThesisEvalPeriodEndLabel(): string | null {
  const trimmed = process.env.THESIS_EVAL_END?.trim();
  return trimmed ? trimmed.slice(0, 10) : null;
}

/** Eval-slutt: THESIS_EVAL_END hvis satt, ellers nå (aldri frem i tid). */
export function resolveConfiguredEvalEnd(explicit?: Date | null): Date {
  const thesis = getThesisEvalWindow();
  const now = new Date();
  const end = explicit ?? thesis.end ?? now;
  return end.getTime() > now.getTime() ? now : end;
}

export function getSdCoverageThreshold(): number {
  const raw = Number(process.env.THESIS_SD_COVERAGE_THRESHOLD ?? "0.9");
  if (!Number.isFinite(raw)) return 0.9;
  return Math.min(1, Math.max(0.5, raw));
}

/** Når siste BACnet-prøve er eldre enn dette vs. eval-slutt/klokke → trigger Influx-backfill. */
export function getMpcSdStaleSampleHours(): number {
  const raw = Number(process.env.MPC_SD_STALE_SAMPLE_HOURS ?? "6");
  if (!Number.isFinite(raw)) return 6;
  return Math.min(72, Math.max(1, raw));
}

/** Maks 15-min hull som fylles per signal i eval-datasett (default 4 = 1 t). */
export function getMpcGapFillMaxSteps(): number {
  const raw = Number(process.env.MPC_GAP_FILL_MAX_STEPS ?? "4");
  if (!Number.isFinite(raw)) return 4;
  return Math.min(96, Math.max(0, Math.floor(raw)));
}

/** Min andel optimizable steg for «full control» thesis-run (default 95 %). */
export function getMpcMinOptimizablePct(): number {
  const raw = Number(process.env.MPC_MIN_OPTIMIZABLE_PCT ?? "0.95");
  if (!Number.isFinite(raw)) return 0.95;
  return Math.min(1, Math.max(0.5, raw));
}

/** Klipp påfølgende alarm/pumpe-hale fra eval-slutt (default av — bruk MPC_TRIM_EVAL_FALLBACK_SUFFIX=1). Thesis-replay simulerer alle dager inkl. helg; fallback per steg via usedFallback. */
export function isMpcTrimEvalFallbackSuffixEnabled(): boolean {
  return process.env.MPC_TRIM_EVAL_FALLBACK_SUFFIX === "1";
}
