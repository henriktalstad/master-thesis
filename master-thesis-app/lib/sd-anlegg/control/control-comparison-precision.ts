/** Avviksterskel etter normalisert oppløsning (1 desimal % / °C). */
export function controlComparisonDeviationEpsilon(unit: string): number {
  if (unit === "kr") return 0.01;
  if (unit === "%" || unit === "°C") return 0.05;
  return 0.05;
}

/** Normaliser skalar for sammenligning og visning — % og °C: 1 desimal. */
export function roundControlComparisonValue(
  value: number | null | undefined,
  unit: string,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (unit === "kr") return Math.round(value * 100) / 100;
  if (unit === "%" || unit === "°C") return Math.round(value * 10) / 10;
  if (Math.abs(value) >= 100) return Math.round(value);
  return Math.round(value * 10) / 10;
}

export function controlComparisonDeviation(
  a: number | null | undefined,
  b: number | null | undefined,
  unit: string,
): number | null {
  const left = roundControlComparisonValue(a, unit);
  const right = roundControlComparisonValue(b, unit);
  if (left == null || right == null) return null;
  return roundControlComparisonValue(Math.abs(left - right), unit);
}

export function isControlComparisonDeviation(
  a: number | null | undefined,
  b: number | null | undefined,
  unit: string,
): boolean {
  const delta = controlComparisonDeviation(a, b, unit);
  return delta != null && delta > controlComparisonDeviationEpsilon(unit);
}
