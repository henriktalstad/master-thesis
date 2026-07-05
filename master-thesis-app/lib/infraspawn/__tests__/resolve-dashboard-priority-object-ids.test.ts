import { describe, expect, test } from "bun:test";
import { buildInfraspawnBuildingDashboard } from "@/lib/infraspawn/build-infraspawn-building-dashboard";
import { pickBestPointForDashboardRole } from "@/lib/infraspawn/resolve-dashboard-priority-object-ids";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function point(
  objectId: string,
  objectName: string,
  lastValue: number,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Test",
    objectId,
    objectName,
    description: null,
    unit: "degrees-celsius",
    lastValue,
    lastSampledAt: "2026-06-20T14:39:40Z",
    valueSource: "influx-stale",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("pickBestPointForDashboardRole", () => {
  test("velger varme tur/retur fremfor tilluft og avtrekk", () => {
    const points = [
      point("AV-40301", "AI_SupplyAirTemp", 22.97),
      point("AV-40302", "AI_ExtractAirTemp", 34.07),
      point("AI-320001-turtemp", "320001OE001_turtemp", 64.2),
      point("AI-320001-returtemp", "320001OE001_returtemp", 33.1),
    ];

    expect(
      pickBestPointForDashboardRole(points, "supply_temp")?.objectName,
    ).toBe("320001OE001_turtemp");
    expect(
      pickBestPointForDashboardRole(points, "supply_air_temp")?.objectName,
    ).toBe("AI_SupplyAirTemp");
    expect(
      pickBestPointForDashboardRole(points, "return_temp")?.objectName,
    ).toBe("320001OE001_returtemp");
  });
});

describe("buildInfraspawnBuildingDashboard", () => {
  test("beregner positiv tur/retur-delta for fjernvarme", () => {
    const dashboard = buildInfraspawnBuildingDashboard([
      point("AV-40301", "AI_SupplyAirTemp", 22.97),
      point("AV-40302", "AI_ExtractAirTemp", 34.07),
      point("AI-320001-turtemp", "320001OE001_turtemp", 64.2),
      point("AI-320001-returtemp", "320001OE001_returtemp", 33.1),
    ]);

    expect(dashboard.supplyReturnDelta).toBeCloseTo(31.1, 1);
  });
});
