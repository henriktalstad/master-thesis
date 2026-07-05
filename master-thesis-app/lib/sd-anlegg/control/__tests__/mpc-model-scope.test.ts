import { describe, expect, it } from "bun:test";
import { buildMpcModelScopeSummary } from "../mpc-model-scope";

describe("buildMpcModelScopeSummary", () => {
  it("rapporterer AHU 360.102 omfang", () => {
    const scope = buildMpcModelScopeSummary();
    expect(scope.bmsPointCountApprox).toBe(123);
    expect(scope.catalogSignalCount).toBeGreaterThanOrEqual(20);
    expect(scope.mpcActuatorCount).toBe(6);
    expect(scope.districtActuatorCount).toBe(2);
    expect(scope.uMeasRequiredCount).toBe(5);
    expect(scope.mpcActuatorLabels.length).toBe(6);
    expect(scope.outsideMpcExamples.length).toBeGreaterThan(0);
  });
});
