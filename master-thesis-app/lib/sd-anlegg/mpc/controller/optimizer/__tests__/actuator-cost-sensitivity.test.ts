import { describe, expect, it } from "bun:test";
import {
  actuatorCostWeight,
  isEconomicControlDelta,
  supplySetpointAffectsPower,
} from "../actuator-cost-sensitivity";

describe("actuatorCostWeight", () => {
  it("prioriterer vifte når vifte er på", () => {
    const u = {
      supplySetpointC: 20,
      supplyFanPct: 55,
      exhaustFanPct: 50,
      heatingValvePct: 0,
      coolingValvePct: 0,
    };
    expect(actuatorCostWeight({ key: "supplyFanPct", u, step: { heatingActive: false, coolingActive: false } })).toBe(1);
    expect(actuatorCostWeight({ key: "supplySetpointC", u, step: { heatingActive: false, coolingActive: false } })).toBeLessThan(0.1);
  });

  it("SP påvirker effekt når varmeventil er aktiv", () => {
    const u = {
      supplySetpointC: 20,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 40,
      coolingValvePct: 0,
    };
    expect(supplySetpointAffectsPower({ u, step: { heatingActive: true, coolingActive: false } })).toBe(true);
    expect(actuatorCostWeight({ key: "supplySetpointC", u, step: { heatingActive: true, coolingActive: false } })).toBeGreaterThan(0.4);
  });

  it("skiller økonomisk δu fra SP-only", () => {
    expect(isEconomicControlDelta({
      supplySetpointC: -0.6,
      supplyFanPct: 0,
      exhaustFanPct: 0,
      heatingValvePct: 0,
      coolingValvePct: 0,
    })).toBe(false);
    expect(isEconomicControlDelta({
      supplySetpointC: 0,
      supplyFanPct: -4,
      exhaustFanPct: -4,
      heatingValvePct: 0,
      coolingValvePct: 0,
    })).toBe(true);
  });
});
