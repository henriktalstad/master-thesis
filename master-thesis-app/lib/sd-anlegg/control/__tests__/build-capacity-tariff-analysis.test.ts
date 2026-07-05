import { describe, expect, test } from "bun:test";
import {
  buildCapacityTariffAnalysis,
  loadProfileMissingPeakFields,
} from "../build-capacity-tariff-analysis";
import type { ControlLoadHourPoint } from "../control-types";
import type { MonthlyGridTariff } from "../grid-tariff-monthly";

function hourPoint(
  hour: string,
  input: Partial<ControlLoadHourPoint> = {},
): ControlLoadHourPoint {
  return {
    hour,
    actualKw: 4,
    simulatedKw: 3.5,
    observedKw: 4.2,
    peakObservedKw: 5,
    peakEmulatedKw: 4.8,
    peakMpcKw: 4,
    costKr: 10,
    spotKrPerKwh: 1,
    ...input,
  };
}

function tariff(month: string, link: number): MonthlyGridTariff {
  return {
    month,
    energyLinkOre: 12,
    capacityLinkKrPerKw: link,
    fixedLinkKrPerMonth: 100,
    sampleTimestamp: `${month}-15T08:00:00.000Z`,
  };
}

describe("buildCapacityTariffAnalysis", () => {
  test("finner eval-effekttopp fra peak-felter", () => {
    const monthlyTariffs = new Map([
      ["2026-06", tariff("2026-06", 50)],
    ]);
    const analysis = buildCapacityTariffAnalysis({
      loadProfile: [
        hourPoint("2026-06-24T10:00:00.000Z", { peakEmulatedKw: 6, peakMpcKw: 5 }),
        hourPoint("2026-06-24T11:00:00.000Z", { peakEmulatedKw: 4, peakMpcKw: 4.5 }),
      ],
      monthlyTariffs,
    });

    expect(analysis?.evalPeakKw.emulated).toBe(6);
    expect(analysis?.evalPeakKw.mpc).toBe(5);
    expect(analysis?.evalPeakDeltaKw).toBe(-1);
    expect(analysis?.monthlyRows[0]?.capacityLinkKrPerKw).toBe(50);
  });

  test("estimerer effektkost per måned med capacityLink", () => {
    const monthlyTariffs = new Map([
      ["2026-06", tariff("2026-06", 10)],
      ["2026-07", tariff("2026-07", 10)],
    ]);
    const analysis =     buildCapacityTariffAnalysis({
      loadProfile: [
        hourPoint("2026-06-24T10:00:00.000Z", { peakEmulatedKw: 10, peakMpcKw: 8 }),
        hourPoint("2026-07-01T10:00:00.000Z", { peakEmulatedKw: 12, peakMpcKw: 11 }),
      ],
      monthlyTariffs,
      bhccByMonth: new Map([
        [
          "2026-06",
          {
            month: "2026-06",
            electricityKwh: 5000,
            districtHeatingKwh: 1000,
            totalCostKr: 8000,
            peakElectricKw: 85,
          },
        ],
        [
          "2026-07",
          {
            month: "2026-07",
            electricityKwh: 4800,
            districtHeatingKwh: 900,
            totalCostKr: 7500,
            peakElectricKw: 92,
          },
        ],
      ]),
    });

    expect(analysis?.monthlyRows).toHaveLength(2);
    expect(analysis?.estimatedCapacityCostKr.emulated).toBe(220);
    expect(analysis?.estimatedCapacityCostKr.mpc).toBe(190);
    expect(analysis?.estimatedCapacityCostKr.deltaKr).toBe(30);
    expect(analysis?.bhccEvalPeakKw).toBe(92);
    expect(analysis?.monthlyRows[0]?.bhccPeakElectricKw).toBe(85);
  });
});

describe("loadProfileMissingPeakFields", () => {
  test("true når ingen peak-felter finnes", () => {
    expect(
      loadProfileMissingPeakFields([
        hourPoint("2026-06-24T10:00:00.000Z", {
          peakObservedKw: undefined,
          peakEmulatedKw: undefined,
          peakMpcKw: undefined,
        }),
      ]),
    ).toBe(true);
  });

  test("false når minst ett peak-felt finnes", () => {
    expect(
      loadProfileMissingPeakFields([
        hourPoint("2026-06-24T10:00:00.000Z", { peakMpcKw: 5 }),
      ]),
    ).toBe(false);
  });
});
