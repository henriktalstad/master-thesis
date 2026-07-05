import { describe, expect, test } from "bun:test";
import { SD_ANLEGG_POLL_TAIL_MAX_OBJECT_IDS } from "@/lib/infraspawn/live-display-policy";
import { resolvePollTailObjectIds } from "@/lib/infraspawn/resolve-poll-tail-object-ids";
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

describe("resolvePollTailObjectIds", () => {
  test("uten scope: kun dashboard-prioritet", () => {
    const points = [
      point("outdoor-1", "360102_OutdoorAirTemp"),
      point("supply-air-1", "AI_SupplyAirTemp"),
      point("extra-1", "360102_SB501"),
    ];

    const tailIds = resolvePollTailObjectIds({ points });

    expect(tailIds).toContain("supply-air-1");
    expect(tailIds).not.toContain("extra-1");
    expect(tailIds.length).toBeLessThanOrEqual(
      SD_ANLEGG_POLL_TAIL_MAX_OBJECT_IDS,
    );
  });

  test("med scope: prioriterer dashboard + unitObjectIds og capper antall", () => {
    const scopedPoints = Array.from({ length: 40 }, (_, index) =>
      point(`scoped-${index}`, `Signal_${index}`),
    );

    const tailIds = resolvePollTailObjectIds({
      points: scopedPoints,
      scopedPoints,
      workspaceScope: { unitObjectIds: ["scoped-39"] },
    });

    expect(tailIds).toContain("scoped-39");
    expect(tailIds.length).toBeLessThanOrEqual(
      SD_ANLEGG_POLL_TAIL_MAX_OBJECT_IDS,
    );
    expect(tailIds.length).toBe(SD_ANLEGG_POLL_TAIL_MAX_OBJECT_IDS);
  });

  test("priorityObjectIds kommer før dashboard og scoped-fill", () => {
    const scopedPoints = Array.from({ length: 40 }, (_, index) =>
      point(`scoped-${index}`, `Signal_${index}`),
    );

    const tailIds = resolvePollTailObjectIds({
      points: scopedPoints,
      scopedPoints,
      priorityObjectIds: ["scoped-38", "scoped-39"],
    });

    expect(tailIds[0]).toBe("scoped-38");
    expect(tailIds[1]).toBe("scoped-39");
  });
});
