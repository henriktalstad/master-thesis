import { describe, expect, test } from "bun:test";
import { SD_ANLEGG_INITIAL_TAIL_MAX_OBJECT_IDS } from "@/lib/infraspawn/live-display-policy";
import { resolveInitialPaintTailObjectIds } from "@/lib/infraspawn/resolve-initial-paint-tail-object-ids";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function point(objectId: string, objectName: string): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Test",
    objectId,
    objectName,
    description: null,
    unit: "degrees-celsius",
    lastValue: null,
    lastSampledAt: null,
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("resolveInitialPaintTailObjectIds", () => {
  test("inkluderer dashboard-prioritet og workspace-scope", () => {
    const points = [
      point("outdoor-1", "360102_OutdoorAirTemp"),
      point("supply-1", "360102_SupplyAirTemp"),
      point("unit-only", "360102_SB501"),
    ];

    const tailIds = resolveInitialPaintTailObjectIds({
      points,
      sources: [{ id: "src-1", label: "Test" }],
      workspaceScope: { unitObjectIds: ["unit-only"] },
    });

    expect(tailIds).toContain("outdoor-1");
    expect(tailIds).toContain("unit-only");
    expect(tailIds.length).toBeLessThanOrEqual(
      SD_ANLEGG_INITIAL_TAIL_MAX_OBJECT_IDS,
    );
  });

  test("priorityObjectIds kommer før dashboard", () => {
    const points = [
      point("outdoor-1", "360102_OutdoorAirTemp"),
      point("setpoint-1", "ExtractSetpoint"),
    ];

    const tailIds = resolveInitialPaintTailObjectIds({
      points,
      sources: [{ id: "src-1", label: "Test" }],
      priorityObjectIds: ["setpoint-1"],
    });

    expect(tailIds[0]).toBe("setpoint-1");
    expect(tailIds).toContain("outdoor-1");
  });
});
