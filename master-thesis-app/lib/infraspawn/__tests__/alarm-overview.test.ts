import { describe, expect, test } from "bun:test";
import {
  buildInfraspawnAlarmOverview,
  formatAlarmModalParam,
  groupActiveEventsBySeverity,
  parseAlarmModalParam,
} from "@/lib/infraspawn/alarm-overview";
import type { InfraspawnAlarmEventListItem } from "@/lib/infraspawn/alarm-event-types";

function event(
  overrides: Partial<InfraspawnAlarmEventListItem> & {
    id: string;
    sourceId: string;
    objectId: string;
  },
): InfraspawnAlarmEventListItem {
  return {
    kind: "ALARM",
    severity: "B",
    alarmText: "362.001RT601_MV: Romtemperatur",
    valueAtActivation: 30.04,
    valueAtClear: null,
    activatedAt: "2024-06-18T07:51:00.000Z",
    clearedAt: null,
    domain: "HEATING",
    sourceLabel: "Nærbyen Næring",
    currentValue: 29.43,
    unit: "°C",
    objectName: null,
    description: null,
    metadata: null,
    ...overrides,
  };
}

describe("alarm-overview", () => {
  test("bygger gruppeindeks med terskel-status", () => {
    const events = [
      event({
        id: "e1",
        sourceId: "src1",
        objectId: "362.001RT601_MV",
        severity: "B",
      }),
      event({
        id: "e2",
        sourceId: "src1",
        objectId: "320.002RP403_MV",
        severity: "B",
        clearedAt: "2024-06-18T08:00:00.000Z",
      }),
    ];

    const overview = buildInfraspawnAlarmOverview({ events });

    expect(overview.thresholdStatus).toBe("not_available");
    expect(overview.allGroups).toHaveLength(2);
    expect(overview.allGroups[0]!.key).toBe("src1:362.001RT601_MV");
    expect(overview.allGroups[0]!.activeEvent).not.toBeNull();
  });

  test("grupperer aktive hendelser per klasse", () => {
    const lanes = groupActiveEventsBySeverity([
      event({ id: "a1", sourceId: "s", objectId: "a", severity: "A" }),
      event({ id: "b1", sourceId: "s", objectId: "b1", severity: "B" }),
      event({
        id: "b2",
        sourceId: "s",
        objectId: "b2",
        severity: "B",
        clearedAt: "2024-06-18T09:00:00.000Z",
      }),
    ]);

    expect(lanes.A).toHaveLength(1);
    expect(lanes.B).toHaveLength(1);
    expect(lanes.C).toHaveLength(0);
  });

  test("parser og formaterer alarm-modal-param", () => {
    const key = formatAlarmModalParam("src-1", "362.001RT601_MV");
    expect(parseAlarmModalParam(key)).toEqual({
      sourceId: "src-1",
      objectId: "362.001RT601_MV",
    });
  });
});
