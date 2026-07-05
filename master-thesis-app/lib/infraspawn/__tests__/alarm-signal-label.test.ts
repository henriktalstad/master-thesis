import { describe, expect, test } from "bun:test";
import {
  isTechnicalAlarmSignalRef,
  resolveAlarmSignalTitle,
} from "@/lib/infraspawn/alarm-signal-label";

describe("isTechnicalAlarmSignalRef", () => {
  test("gjenkjenner BACnet AI-referanser", () => {
    expect(isTechnicalAlarmSignalRef("AI-20")).toBe(true);
    expect(isTechnicalAlarmSignalRef("BI-3")).toBe(true);
  });

  test("gjenkjenner strukturerte objectId", () => {
    expect(isTechnicalAlarmSignalRef("362.001RT601_MV")).toBe(true);
  });

  test("slipper gjennom menneskelig tekst", () => {
    expect(isTechnicalAlarmSignalRef("Turtemperatur")).toBe(false);
  });
});

describe("resolveAlarmSignalTitle", () => {
  test("prioriterer menneskelig alarmtekst", () => {
    expect(
      resolveAlarmSignalTitle({
        alarmText: "Turtemperatur",
        objectId: "362.001RT601_MV",
      }),
    ).toBe("Turtemperatur");
  });

  test("tolker RT601_MV som romtemperatur, ikke retur", () => {
    expect(
      resolveAlarmSignalTitle({
        alarmText: "AI-20",
        objectId: "362.001RT601_MV",
      }),
    ).toBe("Romtemperatur");
  });

  test("bruker objectName når alarmText er teknisk", () => {
    expect(
      resolveAlarmSignalTitle({
        alarmText: "AI-20",
        objectId: "AI-20",
        objectName: "362.001RT601_MV",
        description: "Romtemperatur",
      }),
    ).toBe("Romtemperatur");
  });
});
