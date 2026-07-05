import { describe, expect, test } from "bun:test";
import {
  isInfraspawnActiveAlarmPoint,
  isInfraspawnActiveFaultPoint,
  isInfraspawnBinarySignal,
  resolveInfraspawnPointDisplayStatus,
} from "@/lib/infraspawn/point-status";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function basePoint(
  overrides: Partial<InfraspawnPointListItem> = {},
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "Kilde",
    objectId: "AI-1",
    objectName: "Temp",
    description: null,
    unit: "degrees-celsius",
    lastValue: 21,
    lastSampledAt: "2026-06-19T12:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("isInfraspawnBinarySignal", () => {
  test("gjenkjenner BV-signaler", () => {
    expect(
      isInfraspawnBinarySignal(
        basePoint({ objectId: "BV-20068", objectName: "Firealarm" }),
      ),
    ).toBe(true);
  });
});

describe("isInfraspawnActiveAlarmPoint", () => {
  test("ignorerer sumalarm med verdi 0 uten aktiv alarmstatus", () => {
    expect(
      isInfraspawnActiveAlarmPoint(
        basePoint({
          objectId: "BV-20007",
          objectName: "SumAlarm",
          lastValue: 0,
          statusInAlarm: false,
          quality: "ok",
        }),
      ),
    ).toBe(false);
  });

  test("teller analog alarm med status_inAlarm", () => {
    expect(
      isInfraspawnActiveAlarmPoint(
        basePoint({
          objectId: "362.001RT601_MV",
          objectName: "362.001RT601_MV",
          statusInAlarm: true,
          lastValue: 29.12,
        }),
      ),
    ).toBe(true);
  });
});

describe("isInfraspawnActiveFaultPoint", () => {
  test("trykk uten verdi men med status_fault er feil", () => {
    expect(
      isInfraspawnActiveFaultPoint(
        basePoint({
          objectId: "AV-40300",
          objectName: "AI_EAFPressure",
          lastValue: null,
          statusFault: true,
        }),
      ),
    ).toBe(true);
  });
});

describe("resolveInfraspawnPointDisplayStatus", () => {
  test("prioriterer alarm over feil", () => {
    expect(
      resolveInfraspawnPointDisplayStatus(
        basePoint({ statusInAlarm: true, statusFault: true }),
      ),
    ).toBe("alarm");
  });
});
