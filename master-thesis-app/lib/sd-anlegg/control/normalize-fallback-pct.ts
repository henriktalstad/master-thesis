/**
 * Canonical fallbackPct for MpcReplayResult["summary"] is a 0–1 fraction.
 * Legacy DB scalars and snapshot JSON may store 0–100 (percent).
 */
export function normalizeFallbackPctFraction(value: number): number {
  if (value <= 0) return 0;
  if (value > 1) return Math.round(value * 10) / 1000;
  return value;
}

export function formatFallbackPctDisplay(value: number): string {
  const pct = normalizeFallbackPctFraction(value) * 100;
  return `${Math.round(pct * 10) / 10} %`;
}
