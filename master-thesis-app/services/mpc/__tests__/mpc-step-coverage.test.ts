import { describe, expect, test } from "bun:test";
import { buildMpcTimestepFromFilledSamples } from "@/services/mpc/mpc-step-coverage";

describe("buildMpcTimestepFromFilledSamples", () => {
  test("bygger uMeas fra kalkulert SP og faller tilbake til operatør-SP", () => {
    const t = "2026-06-30T12:00:00.000Z";
    const filledByObjectId = new Map<string, Map<string, number>>([
      ["AV-40433", new Map([[t, 18.2]])],
      ["AV-40353", new Map([[t, 42]])],
      ["AV-40354", new Map([[t, 38]])],
      ["AV-40372", new Map([[t, 10]])],
      ["AV-40374", new Map([[t, 0]])],
    ]);

    const steps = buildMpcTimestepFromFilledSamples({
      grid: [t],
      filledByObjectId,
      objectIdByCanonical: new Map([
        ["supply.setpoint_calculated", "AV-40433"],
        ["supply.fan.command", "AV-40353"],
        ["exhaust.fan.command", "AV-40354"],
        ["heating.valve.command", "AV-40372"],
        ["cooling.valve.command", "AV-40374"],
      ]),
      weatherByHour: new Map(),
      alarmActiveSteps: new Set(),
    });

    expect(steps[0]?.uMeas?.supplySetpointC).toBe(18.2);
  });

  test("bruker operatør-SP når kalkulert SP mangler", () => {
    const t = "2026-06-30T12:00:00.000Z";
    const filledByObjectId = new Map<string, Map<string, number>>([
      ["AV-30588", new Map([[t, 17]])],
      ["AV-40353", new Map([[t, 42]])],
      ["AV-40354", new Map([[t, 38]])],
      ["AV-40372", new Map([[t, 10]])],
      ["AV-40374", new Map([[t, 0]])],
    ]);

    const steps = buildMpcTimestepFromFilledSamples({
      grid: [t],
      filledByObjectId,
      objectIdByCanonical: new Map([
        ["supply.setpoint_calculated", "AV-40433"],
        ["supply.setpoint", "AV-30588"],
        ["supply.fan.command", "AV-40353"],
        ["exhaust.fan.command", "AV-40354"],
        ["heating.valve.command", "AV-40372"],
        ["cooling.valve.command", "AV-40374"],
      ]),
      weatherByHour: new Map(),
      alarmActiveSteps: new Set(),
    });

    expect(steps[0]?.uMeas?.supplySetpointC).toBe(17);
  });
});
