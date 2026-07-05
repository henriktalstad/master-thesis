import { describe, expect, it } from "vitest";
import { selectOverviewKeyPoints } from "@/lib/infraspawn/dashboard-overview";
import { resolveOverviewSignalsDomain } from "@/lib/sd-anlegg/resolve-overview-signals-domain";
import { InfraspawnSystemDomain } from "@/generated/client/enums";

describe("selectOverviewKeyPoints", () => {
  it("prioriterer varme- og effektroller før volum", () => {
    const dashboard = {
      keyPoints: [
        {
          role: "volume" as const,
          label: "Volum",
          point: { sourceId: "s1", objectId: "v1", lastValue: 1 },
        },
        {
          role: "supply_temp" as const,
          label: "Turtemperatur",
          point: { sourceId: "s1", objectId: "t1", lastValue: 64 },
        },
        {
          role: "power" as const,
          label: "Effekt",
          point: { sourceId: "s1", objectId: "p1", lastValue: 39 },
        },
      ],
      supplyReturnDelta: 31,
      activeAlarmCount: 0,
      dataCoverageHours: 12,
    };

    const selected = selectOverviewKeyPoints(dashboard, 2);
    expect(selected.map((card) => card.role)).toEqual(["supply_temp", "power"]);
  });
});

describe("resolveOverviewSignalsDomain", () => {
  it("velger varme når tur/retur finnes", () => {
    expect(
      resolveOverviewSignalsDomain([
        {
          role: "supply_temp",
          label: "Turtemperatur",
          point: { sourceId: "s1", objectId: "t1", lastValue: 64 },
        },
      ]),
    ).toBe(InfraspawnSystemDomain.HEATING);
  });
});
