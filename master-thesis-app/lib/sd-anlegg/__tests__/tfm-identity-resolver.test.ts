import { describe, expect, test } from "bun:test";
import { InfraspawnSystemDomain } from "@/generated/client/enums";
import { resolveTfmIdentityForPoint } from "@/lib/sd-anlegg/tfm-identity-resolver";

describe("resolveTfmIdentityForPoint", () => {
  test("mapper varme tur og settpunkt", () => {
    const mv = resolveTfmIdentityForPoint({
      objectId: "AI-1",
      objectName: "320.002RT402_MV",
      description: "Temperatur turvann",
      unit: "degrees-celsius",
    });

    expect(mv.systemDomain).toBe(InfraspawnSystemDomain.HEATING);
    expect(mv.anleggsenhetKey).toBe("320002");
    expect(mv.signalRole).toBe("measured_value");
    expect(mv.lane).toBe("heating");
    expect(mv.rules).toContain("anleggsenhet:320002");

    const sp = resolveTfmIdentityForPoint({
      objectId: "AO-1",
      objectName: "310.001RT402_SP",
      description: "Setpunkt retur",
      unit: "degrees-celsius",
    });

    expect(sp.signalRole).toBe("setpoint");
    expect(sp.lane).toBe("status");
    expect(sp.anleggsenhetKey).toBeNull();
  });

  test("mapper PA-0805 ventilasjon avtrekk", () => {
    const resolved = resolveTfmIdentityForPoint({
      objectId: "AI-2",
      objectName: "+123456=3600.001.05-RTA001%RTA.001.001",
      description: null,
      unit: "degrees-celsius",
    });

    expect(resolved.systemDomain).toBe(InfraspawnSystemDomain.VENTILATION);
    expect(resolved.anleggsenhetKey).toBe("3600001");
    expect(resolved.identity?.subsystemRole).toBe("extract_air");
    expect(resolved.lane).toBe("exhaust");
  });

  test("løser flere punkter uavhengig med regler", () => {
    const points = [
      {
        sourceId: "s1",
        sourceLabel: "320.002",
        objectId: "AI-1",
        objectName: "320.002RT402_MV",
        description: null,
        unit: "degrees-celsius",
        lastValue: 42,
        lastSampledAt: "2026-06-20T12:00:00.000Z",
        quality: "ok" as const,
        statusFault: false,
        statusInAlarm: false,
        statusOutOfService: false,
        statusOverridden: false,
      },
      {
        sourceId: "s1",
        sourceLabel: "320.002",
        objectId: "AO-1",
        objectName: "310.001RT402_SP",
        description: null,
        unit: "degrees-celsius",
        lastValue: 40,
        lastSampledAt: "2026-06-20T12:00:00.000Z",
        quality: "ok" as const,
        statusFault: false,
        statusInAlarm: false,
        statusOutOfService: false,
        statusOverridden: false,
      },
    ];

    const resolved = points.map((point) => resolveTfmIdentityForPoint(point));

    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.systemDomain).toBe(InfraspawnSystemDomain.HEATING);
    expect(resolved[0]?.rules.length).toBeGreaterThan(0);
    expect(resolved[1]?.signalRole).toBe("setpoint");
  });
});
