import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { bootstrapControlSignalBindings } from "@/lib/sd-anlegg/control/bootstrap-control-signal-bindings";

function mockPoint(
  overrides: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectName">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Nærbyen",
    objectId: overrides.objectId ?? overrides.objectName,
    description: null,
    unit: "generic",
    lastValue: 0,
    lastSampledAt: "2026-06-20T12:00:00.000Z",
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("bootstrap-control-signal-bindings", () => {
  test("binder Lowefficiency til constraint og ikke heat_recovery.command", () => {
    const bindings = bootstrapControlSignalBindings({
      points: [
        mockPoint({
          objectName: "Lowefficiency",
          objectId: "BV-20075",
          description: "Low efficiency",
          unit: "boolean",
        }),
      ],
      defaultUnitKey: "360102",
    });

    const canonicalIds = bindings.map((row) => row.canonicalId);
    expect(canonicalIds).toContain("constraint.low_efficiency");
    expect(canonicalIds).not.toContain("heat_recovery.command");
  });

  test("binder Efficiency til heat_recovery.efficiency", () => {
    const bindings = bootstrapControlSignalBindings({
      points: [
        mockPoint({
          objectName: "Efficiency",
          objectId: "AV-40395",
          description: "Efficiency for exchanger",
          unit: "percent",
          lastValue: 72,
        }),
      ],
      defaultUnitKey: "360102",
    });

    expect(
      bindings.some((row) => row.canonicalId === "heat_recovery.efficiency"),
    ).toBe(true);
    expect(
      bindings.some((row) => row.canonicalId === "heat_recovery.command"),
    ).toBe(false);
  });
});
