import { describe, expect, it } from "bun:test";
import { resolveRegulatorForBuilding } from "@/lib/sd-anlegg/mpc/controller/regulator/resolve-regulator";
import { CascadeHeatRegulator, DirectAhuRegulator } from "@/lib/sd-anlegg/mpc/controller/regulator/regulator-policy";

describe("resolveRegulatorForBuilding", () => {
  it("bruker DirectAhuRegulator som default", () => {
    delete process.env.MPC_USE_CASCADE_REGULATOR;
    expect(resolveRegulatorForBuilding()).toBeInstanceOf(DirectAhuRegulator);
  });

  it("bruker CascadeHeatRegulator når env er satt", () => {
    process.env.MPC_USE_CASCADE_REGULATOR = "1";
    expect(resolveRegulatorForBuilding()).toBeInstanceOf(CascadeHeatRegulator);
    delete process.env.MPC_USE_CASCADE_REGULATOR;
  });
});
