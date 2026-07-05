import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  buildSchematicAlarmHistoryTarget,
  isSchematicBinaryAlarmActive,
  resolveAhuSchematicAlarms,
  resolveHxLowEfficiencyAlarm,
} from "@/lib/sd-anlegg/ahu-schematic-alarm-indicators";

function point(
  objectName: string,
  overrides: Partial<InfraspawnPointListItem> = {},
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    objectId: `id-${objectName}`,
    sourceLabel: "Kilde",
    objectName,
    description: null,
    unit: null,
    lastValue: 0,
    lastSampledAt: "2026-06-04T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("resolveAhuSchematicAlarms", () => {
  test("skiller SumAlarm fra SumAlarmA/B/C", () => {
    const alarms = resolveAhuSchematicAlarms([
      point("SumAlarm", { lastValue: 1 }),
      point("SumAlarmA", { lastValue: 0 }),
      point("SumAlarmB", { lastValue: 1, statusInAlarm: true }),
      point("Firealarm", { lastValue: 0 }),
    ]);

    expect(alarms.find((item) => item.id === "sum")?.active).toBe(true);
    expect(alarms.find((item) => item.id === "sum_a")?.active).toBe(false);
    expect(alarms.find((item) => item.id === "sum_b")?.active).toBe(true);
    expect(alarms.find((item) => item.id === "fire")?.active).toBe(false);
  });

  test("prioriterer røykdetektor for brannalarm", () => {
    const alarms = resolveAhuSchematicAlarms([
      point("Firealarm", { lastValue: 1 }),
      point("Smokedetectoralarm", { lastValue: 0, objectId: "smoke-1" }),
    ]);

    expect(alarms.find((item) => item.id === "fire")?.point?.objectName).toBe(
      "Smokedetectoralarm",
    );
  });
});

describe("resolveHxLowEfficiencyAlarm", () => {
  test("finner Lowefficiency og tolker binær aktiv", () => {
    const inactive = resolveHxLowEfficiencyAlarm([point("Lowefficiency", { lastValue: 0 })]);
    const active = resolveHxLowEfficiencyAlarm([
      point("Lowefficiency", { lastValue: 1, statusInAlarm: true }),
    ]);

    expect(inactive.active).toBe(false);
    expect(active.active).toBe(true);
    expect(active.point?.objectName).toBe("Lowefficiency");
  });
});

describe("isSchematicBinaryAlarmActive", () => {
  test("bruker statusInAlarm eller lastValue >= 1", () => {
    expect(isSchematicBinaryAlarmActive(point("X", { lastValue: 0 }))).toBe(false);
    expect(isSchematicBinaryAlarmActive(point("X", { lastValue: 1 }))).toBe(true);
    expect(
      isSchematicBinaryAlarmActive(point("X", { lastValue: 0, statusInAlarm: true })),
    ).toBe(true);
  });
});

describe("buildSchematicAlarmHistoryTarget", () => {
  test("bygger historikk-target for alarm med punkt", () => {
    const smoke = point("Smokedetectoralarm", { lastValue: 0, objectId: "smoke-1" });
    const fire = point("Firealarm", { lastValue: 1 });
    const target = buildSchematicAlarmHistoryTarget(
      {
        id: "fire",
        label: "Brannalarm",
        active: true,
        point: smoke,
      },
      [smoke, fire],
    );

    expect(target?.code).toBe("Brannalarm");
    expect(target?.roleLabel).toBe("Alarmstatus");
    expect(target?.stateLabel).toBe("Aktiv alarm");
    expect(target?.relatedPoints.map((entry) => entry.objectName)).toEqual([
      "Smokedetectoralarm",
      "Firealarm",
    ]);
  });

  test("returnerer null uten punkt", () => {
    expect(
      buildSchematicAlarmHistoryTarget({
        id: "fire",
        label: "Brannalarm",
        active: false,
      }),
    ).toBeNull();
  });
});
