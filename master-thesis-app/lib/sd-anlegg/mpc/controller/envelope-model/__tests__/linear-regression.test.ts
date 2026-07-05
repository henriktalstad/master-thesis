import { describe, expect, test } from "bun:test";
import { fitLinearRegression, predictLinear } from "../linear-regression";

describe("fitLinearRegression", () => {
  test("gjenkjenner lineær sammenheng", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      x: [i],
      y: 2 * i + 3,
    }));
    const model = fitLinearRegression(rows);
    expect(model).not.toBeNull();
    expect(predictLinear([10], model!)).toBeCloseTo(23, 0);
  });
});
