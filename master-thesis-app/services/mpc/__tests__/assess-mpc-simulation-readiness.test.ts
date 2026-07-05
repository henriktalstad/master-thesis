import { describe, expect, test } from "bun:test";
import { assessMpcSimulationReadiness } from "@/services/mpc/assess-mpc-simulation-readiness";

describe("assessMpcSimulationReadiness", () => {
  test("blokkerer når uMeas under terskel", () => {
    const r = assessMpcSimulationReadiness({
      stepCount: 200,
      stepsWithUMeas: 80,
      uMeasPct: 0.4,
      extractTempPct: 0.9,
      thresholdPct: 0.9,
      missingCanonicals: [],
    });
    expect(r.canSimulate).toBe(false);
    expect(r.reason).toBe("insufficient_u_meas_coverage");
  });

  test("tillater sim når dekning OK", () => {
    const r = assessMpcSimulationReadiness({
      stepCount: 200,
      stepsWithUMeas: 190,
      uMeasPct: 0.95,
      extractTempPct: 0.8,
      thresholdPct: 0.9,
      missingCanonicals: [],
    });
    expect(r.canSimulate).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  test("blokkerer manglende canonicals", () => {
    const r = assessMpcSimulationReadiness({
      stepCount: 200,
      stepsWithUMeas: 200,
      uMeasPct: 1,
      extractTempPct: 1,
      thresholdPct: 0.9,
      missingCanonicals: ["supply.setpoint"],
    });
    expect(r.canSimulate).toBe(false);
    expect(r.reason).toBe("missing_control_signals");
  });
});
