export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function meanAbs(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + Math.abs(b), 0) / values.length;
}

export function classificationAccuracy(
  predicted: readonly boolean[],
  actual: readonly boolean[],
): number | null {
  if (predicted.length === 0 || predicted.length !== actual.length) return null;
  let correct = 0;
  for (let i = 0; i < predicted.length; i++) {
    if (predicted[i] === actual[i]) correct += 1;
  }
  return Math.round((correct / predicted.length) * 1000) / 10;
}

export function rmseFromErrors(errors: readonly number[]): number {
  if (errors.length === 0) return 0;
  const sq = errors.reduce((a, b) => a + b * b, 0);
  return Math.round(Math.sqrt(sq / errors.length) * 100) / 100;
}

export function maeFromErrors(errors: readonly number[]): number {
  if (errors.length === 0) return 0;
  return (
    Math.round(
      (errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length) * 100,
    ) / 100
  );
}
