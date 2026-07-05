import { describe, expect, it } from "bun:test";
import { resolveAlarmThreshold } from "../resolve-alarm-threshold";
import type { InfraspawnPointListItem } from "../types";

function point(
  overrides: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectId">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Test",
    objectName: null,
    description: null,
    unit: "°C",
    lastValue: 22,
    lastSampledAt: "2026-06-20T10:00:00.000Z",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("resolveAlarmThreshold", () => {
  it("leser terskel fra metadata når den finnes", () => {
    expect(
      resolveAlarmThreshold({
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        unit: "°C",
        metadata: { threshold: 23.5 },
      }),
    ).toEqual({
      value: 23.5,
      unit: "°C",
      source: "metadata",
    });
  });

  it("slår opp setpunkt for romtemperatur-alarm", () => {
    expect(
      resolveAlarmThreshold({
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        unit: "°C",
        metadata: null,
        livePoints: [
          point({
            objectId: "362.001RT601_MV",
            lastValue: 30.96,
          }),
          point({
            objectId: "362.001RT601_SP",
            lastValue: 22,
            objectName: "Romtemperatur setpunkt",
          }),
        ],
      }),
    ).toEqual({
      value: 22,
      unit: "°C",
      source: "setpoint",
      setpointObjectId: "362.001RT601_SP",
    });
  });

  it("returnerer null uten metadata og uten setpunkt", () => {
    expect(
      resolveAlarmThreshold({
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        unit: "°C",
        metadata: null,
        livePoints: [
          point({
            objectId: "362.001RT601_MV",
            lastValue: 30.96,
          }),
        ],
      }),
    ).toBeNull();
  });
});
