export type LinearModel = {
  intercept: number;
  coefficients: number[];
};

export function predictLinear(features: readonly number[], model: LinearModel): number {
  let y = model.intercept;
  for (let i = 0; i < features.length; i++) {
    y += (model.coefficients[i] ?? 0) * (features[i] ?? 0);
  }
  return y;
}

/** OLS med ridge (λ) for numerisk stabilitet. */
export function fitLinearRegression(
  rows: readonly { x: readonly number[]; y: number }[],
  ridge = 1e-6,
): LinearModel | null {
  if (rows.length < (rows[0]?.x.length ?? 0) + 2) return null;

  const p = rows[0]!.x.length;
  const dim = p + 1;

  const xtx = Array.from({ length: dim }, () => Array(dim).fill(0));
  const xty = Array(dim).fill(0);

  for (const row of rows) {
    const augmented = [1, ...row.x];
    for (let i = 0; i < dim; i++) {
      xty[i]! += augmented[i]! * row.y;
      for (let j = 0; j < dim; j++) {
        xtx[i]![j]! += augmented[i]! * augmented[j]!;
      }
    }
  }

  for (let i = 0; i < dim; i++) {
    xtx[i]![i]! += ridge;
  }

  const beta = solveSymmetric(xtx, xty);
  if (!beta) return null;

  return {
    intercept: beta[0]!,
    coefficients: beta.slice(1),
  };
}

function solveSymmetric(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row) => [...row]);
  const x = [...b];

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    [x[col], x[pivot]] = [x[pivot]!, x[col]!];

    const div = m[col]![col]!;
    for (let j = col; j < n; j++) m[col]![j]! /= div;
    x[col]! /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row]![col]!;
      for (let j = col; j < n; j++) {
        m[row]![j]! -= factor * m[col]![j]!;
      }
      x[row]! -= factor * x[col]!;
    }
  }

  return x;
}

export function regressionMetrics(
  rows: readonly { x: readonly number[]; y: number }[],
  model: LinearModel,
): { mae: number; rmse: number } {
  if (rows.length === 0) return { mae: 0, rmse: 0 };
  let abs = 0;
  let sq = 0;
  for (const row of rows) {
    const err = predictLinear(row.x, model) - row.y;
    abs += Math.abs(err);
    sq += err * err;
  }
  const n = rows.length;
  return {
    mae: Math.round((abs / n) * 1000) / 1000,
    rmse: Math.round(Math.sqrt(sq / n) * 1000) / 1000,
  };
}
