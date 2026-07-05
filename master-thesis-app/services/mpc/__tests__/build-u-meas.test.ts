import { describe, expect, test } from "bun:test";
import { buildObservedControlVector } from "@/services/mpc/build-u-meas";

describe("buildObservedControlVector", () => {
  test("returnerer null uten alle kjerne-signaler", () => {
    expect(
      buildObservedControlVector({ supplySetpointC: 17, supplyFanPct: 30 }),
    ).toBeNull();
  });

  test("returnerer null uten avtrekksvifte", () => {
    expect(
      buildObservedControlVector({
        supplySetpointC: 17,
        supplyFanPct: 42,
        heatingValvePct: 10,
      }),
    ).toBeNull();
  });

  test("returnerer vektor når SP, vifter og varme er målt", () => {
    const u = buildObservedControlVector({
      supplySetpointC: 17,
      supplyFanPct: 42,
      exhaustFanPct: 38,
      heatingValvePct: 10,
    });
    expect(u).toEqual({
      supplySetpointC: 17,
      supplyFanPct: 42,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValvePct: 0,
      districtTr002ValvePct: 0,
      districtTr003ValvePct: 0,
    });
  });

  test("resolver mettet kjøle-pådrag via feedback ved høy utetemp", () => {
    const u = buildObservedControlVector({
      supplySetpointC: 17,
      supplyFanPct: 42,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValveCommandPct: 100,
      coolingValveFeedbackPct: 3.4,
      outdoorTempC: 18,
    });
    expect(u?.coolingValvePct).toBe(3.4);
  });

  test("nuller mettet kjøle-pådrag uten feedback ved lav utetemp", () => {
    const u = buildObservedControlVector({
      supplySetpointC: 17,
      supplyFanPct: 42,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValveCommandPct: 100,
      outdoorTempC: 14,
    });
    expect(u?.coolingValvePct).toBe(0);
  });

  test("prefererer beregnet settpunkt over operatør-SP", () => {
    const u = buildObservedControlVector({
      supplySetpointC: 17,
      supplySetpointCalcC: 18.2,
      supplyFanPct: 42,
      exhaustFanPct: 38,
      heatingValvePct: 10,
    });
    expect(u?.supplySetpointC).toBe(18.2);
  });

  test("bruker feedback som fallback når command mangler", () => {
    const u = buildObservedControlVector({
      supplySetpointC: 17,
      supplyFanPct: 42,
      exhaustFanPct: 38,
      heatingValvePct: 10,
      coolingValveFeedbackPct: 12,
      outdoorTempC: 20,
    });
    expect(u?.coolingValvePct).toBe(12);
  });

  test("returnerer null ved luftmengde feilkoblet som vifte-%", () => {
    expect(
      buildObservedControlVector({
        supplySetpointC: 17,
        supplyFanPct: 3011,
        exhaustFanPct: 38,
        heatingValvePct: 10,
      }),
    ).toBeNull();
  });

  test("aksepterer varmeventil normalisert fra volt (42 %)", () => {
    const u = buildObservedControlVector({
      supplySetpointC: 17,
      supplyFanPct: 42,
      exhaustFanPct: 38,
      heatingValvePct: 42,
    });
    expect(u?.heatingValvePct).toBe(42);
  });
});
