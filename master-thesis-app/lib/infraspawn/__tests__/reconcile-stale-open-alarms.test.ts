import { describe, expect, test } from "bun:test";
import {
  isAlarmKindActiveInState,
  type PointAlarmState,
} from "@/lib/infraspawn/point-alarm-state";
import { InfraspawnAlarmKind } from "@/generated/client/enums";

describe("isAlarmKindActiveInState", () => {
  const inactive: PointAlarmState = {
    alarm: false,
    fault: false,
    outOfService: false,
  };

  test("matcher kind mot tilstand", () => {
    expect(
      isAlarmKindActiveInState(
        { alarm: true, fault: false, outOfService: false },
        InfraspawnAlarmKind.ALARM,
      ),
    ).toBe(true);
    expect(
      isAlarmKindActiveInState(inactive, InfraspawnAlarmKind.ALARM),
    ).toBe(false);
    expect(
      isAlarmKindActiveInState(
        { alarm: false, fault: true, outOfService: false },
        InfraspawnAlarmKind.FAULT,
      ),
    ).toBe(true);
  });
});
