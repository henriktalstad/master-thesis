import { describe, expect, test } from "bun:test";
import { buildControlPlantModel } from "@/lib/sd-anlegg/control/build-control-plant-model";
import { buildControlLoopDiagram } from "@/lib/sd-anlegg/control/build-control-loop-model";
import { detectLoadProfileDataGap } from "@/lib/sd-anlegg/control/detect-load-profile-gap";

describe("build-control-loop-model", () => {
  test("genererer noder for tilluft og avtrekk", () => {
    const model = buildControlPlantModel({
      buildingId: "b1",
      buildingName: "Test",
      points: [],
      dataQuality: {
        energyHourCount: 100,
        weatherHourCount: 100,
        priceHourCount: 100,
        historyDays: 7,
        warnings: [],
      },
    });
    const diagram = buildControlLoopDiagram(model);
    expect(diagram.nodes.some((n) => n.id === "supply_sp")).toBe(true);
    expect(diagram.nodes.some((n) => n.id === "simulatedMpc")).toBe(true);
    expect(diagram.edges.some((e) => e.dashed && e.from === "simulatedMpc")).toBe(true);
  });
});

describe("detect-load-profile-gap", () => {
  test("finner avsluttende null-serie", () => {
    const profile = [
      ...Array.from({ length: 10 }, (_, i) => ({
        hour: `2026-06-20T${String(i).padStart(2, "0")}:00:00.000Z`,
        actualKw: 2,
        costKr: 10,
        spotKrPerKwh: 0.5,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        hour: `2026-06-21T${String(i).padStart(2, "0")}:00:00.000Z`,
        actualKw: 0,
        costKr: 0,
        spotKrPerKwh: null,
      })),
    ];
    const gap = detectLoadProfileDataGap(profile);
    expect(gap?.trailingZeroHours).toBe(8);
  });
});
