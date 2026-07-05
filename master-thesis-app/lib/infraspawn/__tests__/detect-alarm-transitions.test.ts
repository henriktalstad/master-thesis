import { describe, expect, test } from "bun:test";
import { InfraspawnAlarmKind } from "@/generated/client/enums";
import {
  diffAlarmKinds,
  extractPointAlarmStateFromRawMetadata,
} from "@/lib/infraspawn/point-alarm-state";
import { inferInfraspawnAlarmSeverity } from "@/lib/infraspawn/alarm-severity";

describe("extractPointAlarmStateFromRawMetadata", () => {
  test("leser alarm/fault/outOfService fra rawMetadata", () => {
    expect(
      extractPointAlarmStateFromRawMetadata({
        status_inAlarm: true,
        status_fault: false,
        status_outOfService: false,
        lastSampledAt: "2026-06-20T12:00:00.000Z",
      }),
    ).toEqual({ alarm: true, fault: false, outOfService: false });
  });
});

describe("diffAlarmKinds", () => {
  test("finner aktivering og clearing", () => {
    expect(
      diffAlarmKinds(
        { alarm: false, fault: false, outOfService: false },
        { alarm: true, fault: false, outOfService: false },
      ),
    ).toEqual({ activated: [InfraspawnAlarmKind.ALARM], cleared: [] });

    expect(
      diffAlarmKinds(
        { alarm: true, fault: true, outOfService: false },
        { alarm: false, fault: false, outOfService: false },
      ),
    ).toEqual({
      activated: [],
      cleared: [InfraspawnAlarmKind.FAULT, InfraspawnAlarmKind.ALARM],
    });
  });
});

describe("inferInfraspawnAlarmSeverity", () => {
  test("klassifiserer brann som critical", () => {
    expect(
      inferInfraspawnAlarmSeverity({
        objectId: "AI-1",
        objectName: "Brannsentral",
        description: "Brannalarm aktiv",
        unit: null,
        kind: InfraspawnAlarmKind.ALARM,
      }),
    ).toBe("A");
  });
});
