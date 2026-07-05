import { describe, expect, test } from "bun:test";
import {
  buildAlarmCycleHistoryRows,
  dedupeAlarmEvents,
  formatAlarmCycleDuration,
  groupInfraspawnAlarmEventsByPoint,
  resolveAlarmGroupDisplayCycle,
  sortAlarmEventsForDisplay,
} from "@/lib/infraspawn/group-alarm-events";
import type { InfraspawnAlarmEventListItem } from "@/lib/infraspawn/alarm-event-types";

function event(
  overrides: Partial<InfraspawnAlarmEventListItem> & Pick<InfraspawnAlarmEventListItem, "id">,
): InfraspawnAlarmEventListItem {
  return {
    sourceId: "src-1",
    objectId: "362.001RT601_MV",
    kind: "ALARM",
    severity: "B",
    alarmText: "AI-20",
    valueAtActivation: 30,
    valueAtClear: null,
    activatedAt: "2026-06-18T10:00:00.000Z",
    clearedAt: null,
    domain: null,
    sourceLabel: "Nærbyen Næring",
    currentValue: 30.15,
    unit: "°C",
    objectName: null,
    description: null,
    metadata: null,
    ...overrides,
  };
}

describe("groupInfraspawnAlarmEventsByPoint", () => {
  test("slår sammen sykluser for samme punkt", () => {
    const groups = groupInfraspawnAlarmEventsByPoint([
      event({
        id: "1",
        activatedAt: "2026-06-18T12:00:00.000Z",
        clearedAt: "2026-06-18T13:00:00.000Z",
      }),
      event({
        id: "2",
        activatedAt: "2026-06-18T14:00:00.000Z",
        clearedAt: null,
      }),
      event({
        id: "3",
        sourceId: "src-1",
        objectId: "other-point",
        activatedAt: "2026-06-18T11:00:00.000Z",
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.objectId).toBe("362.001RT601_MV");
    expect(groups[0]!.cycleCount).toBe(2);
    expect(groups[0]!.activeEvent?.id).toBe("2");
  });

  test("teller sykluser uten duplikater", () => {
    const groups = groupInfraspawnAlarmEventsByPoint([
      event({
        id: "1",
        activatedAt: "2026-06-18T12:00:00.000Z",
        clearedAt: "2026-06-18T12:01:00.000Z",
      }),
      event({
        id: "2",
        activatedAt: "2026-06-18T12:00:00.000Z",
        clearedAt: "2026-06-18T12:01:00.000Z",
      }),
    ]);

    expect(groups[0]!.cycleCount).toBe(1);
  });
});

describe("sortAlarmEventsForDisplay", () => {
  test("aktiv syklus først, deretter nyeste avsluttede", () => {
    const sorted = sortAlarmEventsForDisplay([
      event({
        id: "old-active",
        activatedAt: "2026-06-18T08:00:00.000Z",
        clearedAt: null,
      }),
      event({
        id: "new-cleared",
        activatedAt: "2026-06-18T14:00:00.000Z",
        clearedAt: "2026-06-18T15:00:00.000Z",
      }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["old-active", "new-cleared"]);
  });
});

describe("resolveAlarmGroupDisplayCycle", () => {
  test("bruker aktiv syklus for oppsummering", () => {
    const groups = groupInfraspawnAlarmEventsByPoint([
      event({
        id: "1",
        activatedAt: "2026-06-18T14:00:00.000Z",
        clearedAt: "2026-06-18T15:00:00.000Z",
      }),
      event({
        id: "2",
        activatedAt: "2026-06-18T08:00:00.000Z",
        clearedAt: null,
      }),
    ]);

    const display = resolveAlarmGroupDisplayCycle(groups[0]!);
    expect(display.id).toBe("2");
  });
});

describe("buildAlarmCycleHistoryRows", () => {
  test("slår sammen korte flapping-utslag", () => {
    const rows = buildAlarmCycleHistoryRows([
      event({
        id: "1",
        activatedAt: "2026-06-18T12:00:00.000Z",
        clearedAt: "2026-06-18T12:00:30.000Z",
      }),
      event({
        id: "2",
        activatedAt: "2026-06-18T12:01:00.000Z",
        clearedAt: "2026-06-18T12:01:30.000Z",
      }),
      event({
        id: "3",
        activatedAt: "2026-06-18T11:00:00.000Z",
        clearedAt: "2026-06-18T12:00:00.000Z",
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "flap", count: 2 });
    expect(rows[1]).toMatchObject({ type: "cycle", event: { id: "3" } });
  });
});

describe("dedupeAlarmEvents", () => {
  test("fjerner identiske sykluser", () => {
    const deduped = dedupeAlarmEvents([
      event({
        id: "1",
        activatedAt: "2026-06-18T12:00:00.000Z",
        clearedAt: "2026-06-18T12:01:00.000Z",
        valueAtActivation: 29.74,
      }),
      event({
        id: "2",
        activatedAt: "2026-06-18T12:00:00.000Z",
        clearedAt: "2026-06-18T12:01:00.000Z",
        valueAtActivation: 29.74,
      }),
    ]);

    expect(deduped).toHaveLength(1);
  });
});

describe("formatAlarmCycleDuration", () => {
  test("viser pågår uten clearedAt", () => {
    expect(
      formatAlarmCycleDuration("2026-06-18T10:00:00.000Z", null),
    ).toBe("Pågår");
  });

  test("viser minutter", () => {
    expect(
      formatAlarmCycleDuration(
        "2026-06-18T10:00:00.000Z",
        "2026-06-18T10:45:00.000Z",
      ),
    ).toBe("45 min");
  });

  test("viser ugyldig tidsrekke når clearedAt er før activatedAt", () => {
    expect(
      formatAlarmCycleDuration(
        "2026-06-19T15:16:00.000Z",
        "2026-06-19T10:06:00.000Z",
      ),
    ).toBe("Ugyldig tidsrekke");
  });
});

describe("isValidAlarmCycleEvent", () => {
  test("filtrerer bort sykluser med clearedAt før activatedAt", () => {
    const groups = groupInfraspawnAlarmEventsByPoint([
      event({
        id: "1",
        activatedAt: "2026-06-19T15:16:00.000Z",
        clearedAt: "2026-06-19T10:06:00.000Z",
      }),
      event({
        id: "2",
        activatedAt: "2026-06-18T08:00:00.000Z",
        clearedAt: null,
      }),
    ]);

    expect(groups[0]!.cycleCount).toBe(1);
    expect(groups[0]!.activeEvent?.id).toBe("2");
  });
});
