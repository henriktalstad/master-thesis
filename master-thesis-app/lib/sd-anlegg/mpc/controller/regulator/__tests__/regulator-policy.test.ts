import { describe, expect, it } from "bun:test";
import {
  CascadeHeatRegulator,
  DirectAhuRegulator,
} from "@/lib/sd-anlegg/mpc/controller/regulator/regulator-policy";

describe("regulator policies", () => {
  it("DirectAhuRegulator returnerer uDirect", () => {
    const reg = new DirectAhuRegulator();
    const u = {
      supplySetpointC: 19,
      supplyFanPct: 40,
      exhaustFanPct: 40,
      heatingValvePct: 0,
      coolingValvePct: 0,
    };
    expect(reg.apply({ uDirect: u }, { tExtC: 22, tSupMeasC: 18, uPrevious: null })).toEqual(u);
  });

  it("CascadeHeatRegulator justerer setpoint fra q_h", () => {
    const reg = new CascadeHeatRegulator();
    const out = reg.apply(
      { qHeatKw: 100 },
      {
        tExtC: 22,
        tSupMeasC: 18,
        uPrevious: {
          supplySetpointC: 18,
          supplyFanPct: 30,
          exhaustFanPct: 30,
          heatingValvePct: 0,
          coolingValvePct: 0,
        },
      },
    );
    expect(out.supplySetpointC).toBeGreaterThan(18);
  });
});
