import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  deriveHeatRecoveryEfficiencyPercent,
  resolveHeatRecoveryEfficiency,
  resolveHeatRecoveryEfficiencyCategory,
} from "@/lib/sd-anlegg/heat-recovery-efficiency";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "360.102",
    objectId: "p1",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 0,
    lastSampledAt: "2026-06-24T05:51:52.000Z",
    valueSource: "influx-live",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("deriveHeatRecoveryEfficiencyPercent", () => {
  test("beregner virkningsgrad fra etter-gjenvinner, inntak og avtrekk", () => {
    const result = deriveHeatRecoveryEfficiencyPercent([
      point({
        objectId: "RT402",
        objectName: "AI_EfficiencyTemp",
        lastValue: 19.91,
      }),
      point({
        objectId: "RT901",
        objectName: "AI_IntakeAirTemp",
        lastValue: 15.04,
      }),
      point({
        objectId: "RT501",
        objectName: "AI_ExtractAirTemp",
        lastValue: 22.42,
      }),
    ]);

    expect(result?.percent).toBeCloseTo(66, 0);
  });

  test("bruker Frost Efficiency som primær når den er gyldig", () => {
    const result = resolveHeatRecoveryEfficiency([
      point({
        objectId: "EFF",
        objectName: "Efficiency",
        unit: "percent",
        lastValue: 65.6,
      }),
      point({
        objectId: "RT402",
        objectName: "AI_EfficiencyTemp",
        lastValue: 19.91,
      }),
      point({
        objectId: "RT901",
        objectName: "AI_IntakeAirTemp",
        lastValue: 15.04,
      }),
      point({
        objectId: "RT501",
        objectName: "AI_ExtractAirTemp",
        lastValue: 22.42,
      }),
    ]);

    expect(result.percent).toBe(65.6);
    expect(result.source).toBe("source");
    expect(result.category).toBe("Høy");
  });
});

describe("resolveHeatRecoveryEfficiencyCategory", () => {
  test("lar Lowefficiency-alarm overstyre prosentkategori", () => {
    expect(
      resolveHeatRecoveryEfficiencyCategory({
        percent: 66,
        lowEfficiencyActive: true,
        hasActiveRecovery: true,
      }),
    ).toBe("Lav");
  });
});
