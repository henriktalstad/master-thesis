import { describe, expect, test } from "bun:test";
import {
  AHU_SIGNAL_ALIAS_REGISTRY,
  isHxControlPercentSignal,
  isHxEfficiencyPercentSignal,
  resolveAhuSignalAliasSlotId,
  resolveAhuSignalAliasSlotIdForPoint,
  resolveAhuSignalFdvDescription,
  resolveCanonicalIdsForAliasPoint,
} from "@/lib/sd-anlegg/ahu-signal-alias-registry";

describe("ahu-signal-alias-registry", () => {
  test("mapper flate Nærbyen-navn til riktig slot", () => {
    expect(resolveAhuSignalAliasSlotId("DO_SeqPumpY1")).toBe("heating.pump");
    expect(resolveAhuSignalAliasSlotId("AO_3")).toBe("heating.valve");
    expect(resolveAhuSignalAliasSlotId("AO_5")).toBe("heating.cool_valve");
    expect(resolveAhuSignalAliasSlotId("AI_FrostprotTemp1")).toBe("heating.temp");
    expect(resolveAhuSignalAliasSlotId("Frostrisk")).toBe("status.frost");
    expect(resolveAhuSignalAliasSlotId("AI_FilterGuard1")).toBe("supply.filter");
    expect(resolveAhuSignalAliasSlotId("AI_FilterGuard2")).toBe("exhaust.filter");
    expect(resolveAhuSignalAliasSlotId("360102_QD401_PV")).toBe("supply.filter");
    expect(resolveAhuSignalAliasSlotId("360102_QD501_PV")).toBe("exhaust.filter");
    expect(resolveAhuSignalAliasSlotId("AI_EAFPressure")).toBe("exhaust.fan");
    expect(resolveAhuSignalAliasSlotId("SupplyPID_SetP")).toBe("status.setpoint");
  });

  test("mapper utstyrstagger når de kommer i objectName", () => {
    expect(resolveAhuSignalAliasSlotId("360102_KA401_S")).toBe("supply.damper");
    expect(resolveAhuSignalAliasSlotId("360102_KA501_S")).toBe("exhaust.damper");
    expect(resolveAhuSignalAliasSlotId("360102_LX471_C")).toBe("heat_recovery.unit");
    expect(resolveAhuSignalFdvDescription("360102_LX471_C")).toBe("Pådrag gjenvinner");
    expect(resolveAhuSignalFdvDescription("360102_JV401_KV")).toBe(
      "Luftmengde tilluft",
    );
  });

  test("resolveAhuSignalAliasSlotIdForPoint matcher FDV-beskrivelse", () => {
    expect(
      resolveAhuSignalAliasSlotIdForPoint({
        objectId: "bacnet-1",
        objectName: "360102_LX471_C",
        description: "Pådrag gjenvinner",
      }),
    ).toBe("heat_recovery.unit");
    expect(
      resolveAhuSignalAliasSlotIdForPoint({
        objectId: "360102_LX471_C",
        objectName: null,
        description: "Pådrag gjenvinner",
      }),
    ).toBe("heat_recovery.unit");
  });

  test("klassifiserer LX471 hastighet og effektivitet", () => {
    expect(
      isHxControlPercentSignal({
        objectName: "360102_LX471_C",
        objectId: "x",
        description: "Pådrag gjenvinner",
      }),
    ).toBe(true);
    expect(
      isHxEfficiencyPercentSignal({
        objectName: "360102_LX471_KV",
        objectId: "x",
        description: "Virkningsgrad",
      }),
    ).toBe(true);
  });

  test("mapper binære gjenvinner-signaler til riktig canonical", () => {
    expect(
      resolveCanonicalIdsForAliasPoint({
        objectName: "Lowefficiency",
        objectId: "BV-20075",
        description: "Low efficiency",
      }),
    ).toEqual(["constraint.low_efficiency"]);

    expect(
      resolveCanonicalIdsForAliasPoint({
        objectName: "Rotationguardexchanger",
        objectId: "BV-20077",
        description: "Rotation guard exchanger",
      }),
    ).toEqual(["heat_recovery.rotation_guard"]);

    expect(
      resolveCanonicalIdsForAliasPoint({
        objectName: "Efficiency",
        objectId: "AV-40395",
        description: "Efficiency for exchanger",
      }),
    ).toEqual(["heat_recovery.efficiency"]);
  });

  test("skiller temp etter gjenvinner fra virkningsgrad via beskrivelse", () => {
    expect(
      resolveAhuSignalAliasSlotIdForPoint({
        objectName: "AI_EfficiencyTemp",
        objectId: "AV-40325",
        description: "temp. efficiency sensor",
      }),
    ).toBe("supply.temp_mid");
  });

  test("har FDV-beskrivelse per registry-rad", () => {
    for (const entry of AHU_SIGNAL_ALIAS_REGISTRY) {
      expect(entry.description.trim().length).toBeGreaterThan(0);
      expect(entry.patterns.length).toBeGreaterThan(0);
      expect(resolveAhuSignalFdvDescription(entry.patterns[0]!)).toBe(
        entry.description,
      );
    }
  });
});
