import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { resolveSdAnleggSlowChangingTailObjectIds } from "@/lib/sd-anlegg/resolve-slow-changing-live-tail-object-ids";

function point(
  objectId: string,
  objectName: string,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Test",
    objectId,
    objectName,
    description: null,
    unit: null,
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

describe("resolveSdAnleggSlowChangingTailObjectIds", () => {
  test("plukker settpunkt og HX-effektivitet", () => {
    const ids = resolveSdAnleggSlowChangingTailObjectIds([
      point("temp-1", "AI_SupplyAirTemp"),
      point("sp-1", "ExtractSetpoint"),
      point("eff-1", "360102_LX471_KV"),
    ]);

    expect(ids).toEqual(["sp-1", "eff-1"]);
  });
});
