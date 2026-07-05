import { describe, expect, test } from "bun:test";
import { buildObservedControlVector } from "@/services/mpc/build-u-meas";
import { normalizeEvalValveSamplePct } from "@/services/mpc/normalize-eval-valve-sample";

describe("normalizeEvalValveSamplePct", () => {
  test("skalerer AO_3 volt til prosent før uMeas", () => {
    const pct = normalizeEvalValveSamplePct("heating.valve.command", 4.2, {
      objectId: "AV-3",
      objectName: "AO_3",
      unit: "volts",
    });
    expect(pct).toBe(42);

    const u = buildObservedControlVector({
      supplySetpointC: 17,
      supplyFanPct: 42,
      exhaustFanPct: 38,
      heatingValvePct: pct,
    });
    expect(u?.heatingValvePct).toBe(42);
  });

  test("skalerer AO_5/AO_4 volt for kjølekanaler", () => {
    expect(
      normalizeEvalValveSamplePct("cooling.valve.command", 2.5, {
        objectId: "AV-40374",
        objectName: "AO_5",
        unit: "volts",
      }),
    ).toBe(25);
    expect(
      normalizeEvalValveSamplePct("cooling.valve.position", 1.0, {
        objectId: "AV-40373",
        objectName: "AO_4",
        unit: "volts",
      }),
    ).toBe(10);
  });

  test("lar ikke-ventil canonical passere uendret", () => {
    expect(
      normalizeEvalValveSamplePct("supply.fan.command", 42, {
        objectName: "AO_SAF",
        unit: "percent",
      }),
    ).toBe(42);
  });
});
