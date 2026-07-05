import { describe, expect, test } from "bun:test";
import { resolveSubsystemRole, subsystemRoleLabel } from "@/lib/infraspawn/tfm-subsystem-roles";

describe("resolveSubsystemRole", () => {
  test("varme tur/retur", () => {
    expect(resolveSubsystemRole("3200", "04")).toBe("supply_water");
    expect(resolveSubsystemRole("3200", "05")).toBe("return_water");
    expect(subsystemRoleLabel("supply_water")).toBe("Tur");
  });

  test("ventilasjon tilluft/avtrekk", () => {
    expect(resolveSubsystemRole("3600", "04")).toBe("supply_air");
    expect(resolveSubsystemRole("3600", "05")).toBe("extract_air");
    expect(subsystemRoleLabel("extract_air")).toBe("Avtrekk");
  });
});
