import { describe, expect, test } from "bun:test";
import {
  deriveDistrictPlantFollowers,
  districtPumpFollowerActive,
} from "@/lib/sd-anlegg/mpc/controller/district/district-plant-followers";

describe("district-plant-followers", () => {
  test("pumpe ON når ventil over terskel", () => {
    expect(districtPumpFollowerActive(0)).toBe(false);
    expect(districtPumpFollowerActive(8)).toBe(false);
    expect(districtPumpFollowerActive(9)).toBe(true);
  });

  test("deriverer TR002/TR003 pumpe fra u_k", () => {
    expect(
      deriveDistrictPlantFollowers({
        districtTr002ValvePct: 20,
        districtTr003ValvePct: 0,
      }),
    ).toEqual({
      districtTr002PumpActive: true,
      districtTr003PumpActive: false,
    });
  });
});
